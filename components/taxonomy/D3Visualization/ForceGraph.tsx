'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { ForceSimulation, Node, Link, ForceConfig } from './ForceSimulation';
import { CanvasRenderer, RenderConfig } from './CanvasRenderer';
import { PerformanceMonitor } from '@/lib/visualization/performance-monitor';

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
  onSelectionChange,
  forceConfig,
  renderConfig,
  className = '',
}: ForceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ForceSimulation | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const performanceMonitorRef = useRef<PerformanceMonitor | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [isSimulating, setIsSimulating] = useState(true);
  const [fps, setFps] = useState(60);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);

  // Convert taxonomy data to D3 format
  const prepareData = useCallback(() => {
    const nodes: Node[] = data.nodes.map(node => ({
      ...node,
      radius: calculateNodeRadius(node),
      color: getNodeColor(node.status),
      x: Math.random() * width,
      y: Math.random() * height,
    }));
    
    const links: Link[] = data.links.map(link => ({
      source: link.source,
      target: link.target,
      strength: link.strength || 0.5,
    }));
    
    return { nodes, links };
  }, [data, width, height]);

  // Initialize simulation and renderer
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const { nodes, links } = prepareData();
    
    // Initialize performance monitor
    performanceMonitorRef.current = new PerformanceMonitor();
    
    // Initialize simulation
    simulationRef.current = new ForceSimulation(width, height, forceConfig);
    simulationRef.current.initialize(nodes, links);
    
    // Initialize renderer
    rendererRef.current = new CanvasRenderer(canvasRef.current, renderConfig);
    
    // Set up zoom behavior
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        if (rendererRef.current) {
          rendererRef.current.setTransform(event.transform);
          render();
        }
      });
    
    d3.select(canvasRef.current).call(zoom);
    
    // Animation loop
    const animate = () => {
      if (!simulationRef.current || !rendererRef.current || !performanceMonitorRef.current) return;
      
      // Update FPS
      const currentFps = performanceMonitorRef.current.measureFPS();
      setFps(Math.round(currentFps));
      
      // Enable performance mode if FPS is too low
      if (currentFps < 30) {
        rendererRef.current.setPerformanceMode(true);
      } else if (currentFps > 45) {
        rendererRef.current.setPerformanceMode(false);
      }
      
      // Render
      rendererRef.current.render(nodes, links);
      
      if (isSimulating) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    
    // Set up simulation events
    simulationRef.current.on('tick', () => {
      render();
    });
    
    // Helper function to render
    const render = () => {
      if (rendererRef.current) {
        rendererRef.current.render(nodes, links);
      }
    };
    
    // Start animation
    animate();
    
    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      simulationRef.current?.destroy();
      rendererRef.current?.destroy();
      performanceMonitorRef.current = null;
    };
  }, [data, width, height, forceConfig, renderConfig, isSimulating, prepareData]);

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
  }, [selectedNodes, hoveredNode, onNodeClick, onNodeHover]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (rendererRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
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
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
      
      {/* Controls Overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
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
      </div>
      
      {/* Performance Metrics */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
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
    </div>
  );
}