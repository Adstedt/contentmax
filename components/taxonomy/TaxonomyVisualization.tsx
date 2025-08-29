'use client';

import React from 'react';
import { ForceGraph } from '@/components/taxonomy/D3Visualization';
import type { TaxonomyNode, TaxonomyLink } from '@/components/taxonomy/D3Visualization';

interface TaxonomyVisualizationProps {
  data: {
    nodes: TaxonomyNode[];
    links: TaxonomyLink[];
  };
}

export function TaxonomyVisualization({ data }: TaxonomyVisualizationProps) {
  return (
    <>
      {/* Controls Bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-sm text-[#999] hover:border-[#2a2a2a] hover:text-white transition-colors">
            Import Taxonomy
          </button>
          <button className="px-4 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-sm text-[#999] hover:border-[#2a2a2a] hover:text-white transition-colors">
            Export Data
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-[#666]">
            Nodes: <span className="text-white font-mono">{data.nodes.length}</span>
          </div>
          <div className="text-sm text-[#666]">
            Links: <span className="text-white font-mono">{data.links.length}</span>
          </div>
        </div>
      </div>

      {/* Visualization Container */}
      <div className="flex-1 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] p-4">
        <ForceGraph
          data={data}
          width={1200}
          height={700}
          className="w-full h-full"
          onNodeClick={(node) => {
            console.log('Node clicked:', node);
          }}
          onNodeHover={(node) => {
            console.log('Node hovered:', node);
          }}
          onSelectionChange={(nodes) => {
            console.log('Selection changed:', nodes);
          }}
        />
      </div>

      {/* Info Panel */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] p-4">
          <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-2">
            Navigation
          </h3>
          <ul className="space-y-1 text-xs text-[#666]">
            <li>• Click and drag nodes to reposition</li>
            <li>• Scroll to zoom in/out</li>
            <li>• Click empty space to deselect</li>
            <li>• Shift+click for multi-select</li>
          </ul>
        </div>
        
        <div className="bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] p-4">
          <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-2">
            Node Size
          </h3>
          <ul className="space-y-1 text-xs text-[#666]">
            <li>• Larger nodes = more SKUs</li>
            <li>• Size indicates importance</li>
            <li>• Root nodes are emphasized</li>
            <li>• Hover for details</li>
          </ul>
        </div>
        
        <div className="bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] p-4">
          <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-2">
            Performance
          </h3>
          <ul className="space-y-1 text-xs text-[#666]">
            <li>• Canvas rendering for speed</li>
            <li>• Handles 3000+ nodes</li>
            <li>• Auto performance mode</li>
            <li>• 60 FPS target</li>
          </ul>
        </div>
      </div>
    </>
  );
}