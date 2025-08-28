import { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { ForceSimulation, Node, Link, ForceConfig } from './ForceSimulation';
import { TaxonomyNode, TaxonomyLink } from './ForceGraph';

export interface UseForceSimulationOptions {
  width: number;
  height: number;
  forceConfig?: Partial<ForceConfig>;
  autoStart?: boolean;
}

export function useForceSimulation(
  data: { nodes: TaxonomyNode[]; links: TaxonomyLink[] },
  options: UseForceSimulationOptions
) {
  const simulationRef = useRef<ForceSimulation | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);
  
  // Convert taxonomy data to simulation format
  const prepareData = useCallback(() => {
    const nodes: Node[] = data.nodes.map(node => ({
      ...node,
      radius: calculateNodeRadius(node),
      color: getNodeColor(node.status),
      x: node.x || Math.random() * options.width,
      y: node.y || Math.random() * options.height,
    } as Node));
    
    const links: Link[] = data.links.map(link => ({
      source: link.source,
      target: link.target,
      strength: link.strength || 0.5,
    }));
    
    nodesRef.current = nodes;
    linksRef.current = links;
    
    return { nodes, links };
  }, [data, options.width, options.height]);
  
  // Initialize simulation
  useEffect(() => {
    const { nodes, links } = prepareData();
    
    simulationRef.current = new ForceSimulation(
      options.width,
      options.height,
      options.forceConfig
    );
    
    simulationRef.current.initialize(nodes, links);
    
    if (options.autoStart !== false) {
      simulationRef.current.restart();
    }
    
    return () => {
      simulationRef.current?.destroy();
    };
  }, [prepareData, options.width, options.height, options.forceConfig, options.autoStart]);
  
  // Control methods
  const start = useCallback(() => {
    simulationRef.current?.restart();
  }, []);
  
  const stop = useCallback(() => {
    simulationRef.current?.stop();
  }, []);
  
  const tick = useCallback(() => {
    simulationRef.current?.tick();
  }, []);
  
  const findNode = useCallback((x: number, y: number, radius?: number) => {
    return simulationRef.current?.findNode(x, y, radius) || null;
  }, []);
  
  const dragStart = useCallback((node: Node) => {
    simulationRef.current?.dragStart(node);
  }, []);
  
  const drag = useCallback((node: Node, x: number, y: number) => {
    simulationRef.current?.drag(node, x, y);
  }, []);
  
  const dragEnd = useCallback((node: Node) => {
    simulationRef.current?.dragEnd(node);
  }, []);
  
  const updateConfig = useCallback((config: Partial<ForceConfig>) => {
    simulationRef.current?.updateConfig(config);
  }, []);
  
  const on = useCallback((event: string, callback: () => void) => {
    simulationRef.current?.on(event, callback);
  }, []);
  
  return {
    simulation: simulationRef.current,
    nodes: nodesRef.current,
    links: linksRef.current,
    start,
    stop,
    tick,
    findNode,
    dragStart,
    drag,
    dragEnd,
    updateConfig,
    on,
  };
}

// Helper functions
function getNodeColor(status?: string): string {
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
}

function calculateNodeRadius(node: TaxonomyNode): number {
  const baseRadius = 5;
  const maxRadius = 20;
  
  const metric = node.skuCount || node.traffic || 1;
  const scaledRadius = baseRadius + Math.sqrt(metric) * 0.5;
  
  return Math.min(scaledRadius, maxRadius);
}