'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { ForceSimulation, Node, Link, ForceConfig } from './ForceSimulation';
import { CanvasRenderer, RenderConfig } from './CanvasRenderer';
import { PerformanceMonitor } from '@/lib/visualization/performance-monitor';
import {
  ProgressiveLoader,
  LoadingProgress,
  ViewportBounds,
} from '@/lib/visualization/progressive-loader';
import { LoadingIndicator } from './LoadingIndicator';
import { ThemeSwitcher } from './ThemeSwitcher';

export interface TaxonomyNode {
  id: string;
  url: string;
  title: string;
  children: string[];
  depth?: number;
  skuCount?: number;
  traffic?: number;
  revenue?: number;
  status?: 'optimized' | 'outdated' | 'missing' | 'noContent';
}

export interface TaxonomyLink {
  source: string;
  target: string;
  strength?: number;
}

export interface ForceGraphProps {
  data: {
    nodes: TaxonomyNode[];
    links: TaxonomyLink[];
  };
  width?: number;
  height?: number;
  onNodeClick?: (node: Node) => void;
  onNodeHover?: (node: Node | null) => void;
  onSelectionChange?: (nodes: Node[]) => void;
  forceConfig?: Partial<ForceConfig>;
  renderConfig?: Partial<RenderConfig>;
  enableProgressiveLoading?: boolean;
  staticLayout?: boolean; // New option for static rendering
  className?: string;
}

// Color scheme matching dashboard
const getNodeColor = (status?: string): string => {
  switch (status) {
    case 'optimized':
      return '#10a37f';
    case 'outdated':
      return '#f59e0b';
    case 'missing':
      return '#ef4444';
    case 'noContent':
      return '#666666';
    default:
      return '#1a1a1a';
  }
};

// Calculate node radius based on metrics
const calculateNodeRadius = (node: TaxonomyNode): number => {
  const baseRadius = 5;
  const maxRadius = 20;

  // Use skuCount as primary metric, with fallbacks
  const metric = node.skuCount || node.traffic || 1;
  const scaledRadius = baseRadius + Math.sqrt(metric) * 0.5;

  return Math.min(scaledRadius, maxRadius);
};

export function ForceGraph({
  data,
  width = 800,
  height = 600,
  onNodeClick,
  onNodeHover,
  onSelectionChange: _onSelectionChange,
  forceConfig,
  renderConfig,
  enableProgressiveLoading = false, // Default to OFF
  staticLayout = true, // Default to static layout
  className = '',
}: ForceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ForceSimulation | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const performanceMonitorRef = useRef<PerformanceMonitor | null>(null);
  const progressiveLoaderRef = useRef<ProgressiveLoader | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const visibilityManagerRef = useRef<any | null>(null);

  const [isSimulating, setIsSimulating] = useState(false); // Start with simulation off
  const [fps, setFps] = useState(60);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const [currentNodes, setCurrentNodes] = useState<Node[]>([]);
  const [currentLinks, setCurrentLinks] = useState<Link[]>([]);
  const [productsEnabled, setProductsEnabled] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Convert taxonomy data to D3 format with hierarchical positioning
  const prepareData = () => {
    // First pass: create nodes
    const nodes: Node[] = data.nodes.map((node) => ({
      ...node,
      radius: calculateNodeRadius(node),
      color: getNodeColor(node.status),
      // Will set positions after
      x: undefined,
      y: undefined,
    }));

    // Create a map for quick lookup
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Second pass: position nodes hierarchically
    nodes.forEach((node) => {
      const depth = node.depth || 0;

      if (depth === 0) {
        // Root node at center
        node.x = width / 2;
        node.y = height / 2;
      } else if (depth === 1) {
        // Main categories in a circle around center
        const angle =
          (nodes.filter((n) => n.depth === 1).indexOf(node) /
            nodes.filter((n) => n.depth === 1).length) *
          2 *
          Math.PI;
        node.x = width / 2 + Math.cos(angle) * 200;
        node.y = height / 2 + Math.sin(angle) * 200;
      } else {
        // Find parent node from links
        const parentLink = data.links.find((l) => l.target === node.id);
        if (parentLink) {
          const parent = nodeMap.get(parentLink.source);
          if (parent && parent.x !== undefined && parent.y !== undefined) {
            // Position children in a circle around parent to avoid overlap
            const siblings = nodes.filter((n) => {
              const link = data.links.find((l) => l.target === n.id);
              return link && link.source === parentLink.source && n.depth === depth;
            });
            const siblingIndex = siblings.indexOf(node);
            const angleStep = (2 * Math.PI) / siblings.length;
            const angle = siblingIndex * angleStep;
            const distance = depth === 2 ? 80 : 60; // More space for subcategories
            node.x = parent.x + Math.cos(angle) * distance;
            node.y = parent.y + Math.sin(angle) * distance;
          } else {
            // Fallback positioning
            node.x = width / 2 + (Math.random() - 0.5) * 100;
            node.y = height / 2 + (Math.random() - 0.5) * 100;
          }
        } else {
          // Fallback positioning
          node.x = width / 2 + (Math.random() - 0.5) * 100;
          node.y = height / 2 + (Math.random() - 0.5) * 100;
        }
      }
    });

    const links: Link[] = data.links.map((link) => ({
      source: link.source,
      target: link.target,
      strength: link.strength || 0.5,
    }));

    return { nodes, links };
  };

  // Initialize simulation and renderer
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const { nodes, links } = prepareData();

    // Initialize performance monitor
    performanceMonitorRef.current = new PerformanceMonitor();

    // Initialize renderer
    rendererRef.current = new CanvasRenderer(canvasRef.current, renderConfig);
    visibilityManagerRef.current = rendererRef.current.getVisibilityManager();

    let nodesToRender = nodes;
    let linksToRender = links;

    // Skip progressive loading - just use all nodes
    setCurrentNodes(nodes);
    setCurrentLinks(links);

    // Initialize simulation
    simulationRef.current = new ForceSimulation(width, height, forceConfig);
    simulationRef.current.initialize(nodesToRender, linksToRender, false);

    // Define render function
    const render = () => {
      if (rendererRef.current) {
        rendererRef.current.render(nodesToRender, linksToRender);
      }
    };

    // Set up tick event to render on each simulation tick
    simulationRef.current.on('tick', render);

    // Run simulation for a fixed number of ticks then stop
    simulationRef.current.runAndStop(200);

    // Final render after simulation stops
    setTimeout(() => {
      render();
      setIsSimulating(false);
    }, 1000);

    // Set up zoom behavior
    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 20]) // Allow much deeper zoom for multi-level hierarchies
      .on('zoom', (event) => {
        if (rendererRef.current) {
          // Update zoom in renderer (which updates visibility manager)
          rendererRef.current.setZoom(event.transform);

          // Update viewport for progressive loading
          if (progressiveLoaderRef.current && enableProgressiveLoading) {
            const canvas = canvasRef.current!;
            const rect = canvas.getBoundingClientRect();
            const viewport: ViewportBounds = {
              x: -event.transform.x / event.transform.k,
              y: -event.transform.y / event.transform.k,
              width: rect.width / event.transform.k,
              height: rect.height / event.transform.k,
              zoom: event.transform.k,
            };
            progressiveLoaderRef.current.updateViewport(viewport);
          }

          // Re-render with updated zoom visibility
          rendererRef.current.render(
            currentNodes.length > 0 ? currentNodes : nodes,
            currentLinks.length > 0 ? currentLinks : links
          );
        }
      });

    zoomRef.current = zoom;
    d3.select(canvasRef.current).call(zoom);

    // No continuous animation loop needed

    // Render function is defined above and connected to tick events

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      simulationRef.current?.destroy();
      rendererRef.current?.destroy();
      progressiveLoaderRef.current?.destroy();
      performanceMonitorRef.current = null;
    };
  }, [
    // Only re-run when data structure changes significantly
    data.nodes.length,
    data.links.length,
    width,
    height,
  ]);

  // Handle mouse interactions
  useEffect(() => {
    if (!canvasRef.current || !simulationRef.current || !rendererRef.current) return;

    const canvas = canvasRef.current;
    const simulation = simulationRef.current;
    const renderer = rendererRef.current;

    let isDragging = false;
    let draggedNode: Node | null = null;

    const getMousePosition = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const transform = d3.zoomTransform(canvas);
      const x = (event.clientX - rect.left - transform.x) / transform.k;
      const y = (event.clientY - rect.top - transform.y) / transform.k;
      return { x, y };
    };

    const handleMouseDown = (event: MouseEvent) => {
      const { x, y } = getMousePosition(event);
      const node = simulation.findNode(x, y);

      if (node) {
        isDragging = true;
        draggedNode = node;
        simulation.dragStart(node);

        // Handle selection
        if (event.shiftKey) {
          if (selectedNodes.has(node.id)) {
            const newSelection = new Set(selectedNodes);
            newSelection.delete(node.id);
            setSelectedNodes(newSelection);
            renderer.removeSelectedNode(node.id);
          } else {
            const newSelection = new Set(selectedNodes);
            newSelection.add(node.id);
            setSelectedNodes(newSelection);
            renderer.addSelectedNode(node.id);
          }
        } else if (!selectedNodes.has(node.id)) {
          setSelectedNodes(new Set([node.id]));
          renderer.clearSelection();
          renderer.addSelectedNode(node.id);
        }

        // Load connected nodes on click if progressive loading is enabled
        if (progressiveLoaderRef.current && enableProgressiveLoading && event.ctrlKey) {
          progressiveLoaderRef.current.loadConnectedNodes(node.id, 2);
        }

        onNodeClick?.(node);
      } else {
        // Clear selection when clicking empty space
        setSelectedNodes(new Set());
        renderer.clearSelection();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const { x, y } = getMousePosition(event);

      if (isDragging && draggedNode) {
        simulation.drag(draggedNode, x, y);
      } else {
        const node = simulation.findNode(x, y);
        if (node !== hoveredNode) {
          setHoveredNode(node);
          renderer.setHoveredNode(node);
          onNodeHover?.(node);
        }
        canvas.style.cursor = node ? 'pointer' : 'default';
      }
    };

    const handleMouseUp = () => {
      if (isDragging && draggedNode) {
        simulation.dragEnd(draggedNode);
        isDragging = false;
        draggedNode = null;
      }
    };

    const handleMouseLeave = () => {
      handleMouseUp();
      setHoveredNode(null);
      renderer.setHoveredNode(null);
      onNodeHover?.(null);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [selectedNodes, hoveredNode, onNodeClick, onNodeHover, enableProgressiveLoading]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (rendererRef.current && containerRef.current) {
        containerRef.current.getBoundingClientRect();
        rendererRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-lg border border-[#1a1a1a] ${className}`}
      style={{ width, height }}
    >
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />

      {/* Controls Overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        {/* Product Toggle Button */}
        <button
          onClick={() => {
            const newState = !productsEnabled;
            setProductsEnabled(newState);
            rendererRef.current?.toggleProducts(newState);
            if (rendererRef.current) {
              rendererRef.current.render(currentNodes, currentLinks);
            }
          }}
          className="px-3 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-xs text-[#999] hover:border-[#2a2a2a] hover:text-white transition-colors"
          title="Toggle product visibility"
        >
          {productsEnabled ? 'Hide Products' : 'Show Products'}
        </button>

        {/* Focus Mode Toggle */}
        <button
          onClick={() => {
            const newState = !focusMode;
            setFocusMode(newState);
            if (visibilityManagerRef.current) {
              visibilityManagerRef.current.setFocusMode(newState);
              if (rendererRef.current) {
                rendererRef.current.render(currentNodes, currentLinks);
              }
            }
          }}
          className="px-3 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-xs text-[#999] hover:border-[#2a2a2a] hover:text-white transition-colors"
          title="Toggle focus mode to isolate branches"
        >
          {focusMode ? 'Disable Focus' : 'Enable Focus'}
        </button>

        <button
          onClick={() => setIsSimulating(!isSimulating)}
          className="px-3 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-xs text-[#999] hover:border-[#2a2a2a] hover:text-white transition-colors"
        >
          {isSimulating ? 'Pause' : 'Resume'}
        </button>

        <button
          onClick={() => {
            simulationRef.current?.restart();
            setIsSimulating(true);
          }}
          className="px-3 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-xs text-[#999] hover:border-[#2a2a2a] hover:text-white transition-colors"
        >
          Restart
        </button>

        {/* Progressive Loading Controls */}
        {enableProgressiveLoading && progressiveLoaderRef.current && (
          <>
            <button
              onClick={() => progressiveLoaderRef.current?.loadAllNodes()}
              className="px-3 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-xs text-[#999] hover:border-[#2a2a2a] hover:text-white transition-colors"
              disabled={loadingProgress?.isComplete}
            >
              Load All
            </button>

            <div className="px-2 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded">
              <span className="text-xs text-[#666]">Ctrl+Click: Load connected</span>
            </div>
          </>
        )}
      </div>

      {/* Performance Metrics and Theme Switcher */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeSwitcher />

        <div className="px-2 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded">
          <span className="text-xs text-[#666]">FPS: </span>
          <span className={`text-xs font-mono ${fps >= 30 ? 'text-[#10a37f]' : 'text-[#ef4444]'}`}>
            {fps}
          </span>
        </div>

        {selectedNodes.size > 0 && (
          <div className="px-2 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded">
            <span className="text-xs text-[#666]">Selected: </span>
            <span className="text-xs text-white font-mono">{selectedNodes.size}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-4 p-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#10a37f]" />
          <span className="text-xs text-[#999]">Optimized</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
          <span className="text-xs text-[#999]">Outdated</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
          <span className="text-xs text-[#999]">Missing</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#666666]" />
          <span className="text-xs text-[#999]">No Content</span>
        </div>
      </div>

      {/* Loading Indicator */}
      {loadingProgress && !loadingProgress.isComplete && (
        <LoadingIndicator progress={loadingProgress} />
      )}
    </div>
  );
}
