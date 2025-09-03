# TASK-002: Hierarchy Builder Implementation

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 8 hours  
**Owner**: Full-Stack Developer  
**Dependencies**: TASK-001 (Database Schema) ✅ Complete  
**Status**: Ready to Start

## Executive Summary

The Hierarchy Builder is a critical component that transforms flat URL lists into structured taxonomies. Our codebase already has excellent foundations with `TaxonomyBuilder` and `HierarchyAnalyzer` classes, but we need to create a unified hierarchy management system with UI components and API endpoints for real-time manipulation.

## Context & Current State

### What We Have ✅

- **Database**: `taxonomy_nodes` table with hierarchical fields (`parent_id`, `depth`, `position`)
- **Processing**: `TaxonomyBuilder` class with `buildHierarchy()` method
- **Analysis**: `HierarchyAnalyzer` with relationship detection and health metrics
- **Ingestion**: Complete sitemap fetching and parsing pipeline
- **Types**: Strong TypeScript definitions for all entities

### What We Need 🎯

- **UI Components**: Interactive hierarchy builder interface
- **API Layer**: CRUD endpoints for taxonomy node management
- **Real-time Updates**: Live hierarchy manipulation
- **Validation**: Business rules for hierarchy constraints
- **Batch Operations**: Bulk import/export and modifications

## User Story

**As a** content strategist  
**I want to** build and manage content hierarchies from imported sitemaps  
**So that I can** identify content gaps, optimize site structure, and improve SEO performance

### Acceptance Criteria

✅ User can view imported URLs in a hierarchical tree structure  
✅ User can drag-and-drop nodes to reorganize hierarchy  
✅ User can edit node properties (title, meta, status)  
✅ User can bulk import/export hierarchies  
✅ System automatically detects parent-child relationships  
✅ System validates hierarchy integrity in real-time  
✅ Performance: Handle 10,000+ nodes smoothly

## Technical Requirements

### 1. Enhanced Core Implementation

#### Update: `lib/processing/hierarchy-builder.ts` (New unified builder)

```typescript
import { z } from 'zod';

// Input/Output Types
export interface RawNode {
  url: string;
  title: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface HierarchicalNode {
  id: string;
  url: string;
  path: string;
  title: string;
  parent_id: string | null;
  depth: number;
  children: string[];
  slug: string;
  breadcrumb: string[];
}

export interface HierarchyResult {
  nodes: HierarchicalNode[];
  rootNodes: string[];
  maxDepth: number;
  stats: {
    totalNodes: number;
    rootNodes: number;
    leafNodes: number;
    averageChildren: number;
    maxChildren: number;
  };
  warnings: string[];
}

/**
 * HierarchyBuilder - Constructs hierarchical relationships from flat URL lists
 */
export class HierarchyBuilder {
  private warnings: string[] = [];
  private nodeMap: Map<string, HierarchicalNode> = new Map();

  /**
   * Main entry point - builds hierarchy from raw nodes
   */
  public buildFromUrls(rawNodes: RawNode[]): HierarchyResult {
    // Reset state
    this.warnings = [];
    this.nodeMap = new Map();

    // Step 1: Normalize and create nodes
    const nodes = this.createNodes(rawNodes);

    // Step 2: Build parent-child relationships
    this.buildRelationships(nodes);

    // Step 3: Calculate depths
    this.calculateDepths();

    // Step 4: Validate hierarchy
    const validation = this.validateHierarchy();

    // Step 5: Gather statistics
    const stats = this.calculateStats();

    return {
      nodes: Array.from(this.nodeMap.values()),
      rootNodes: this.findRootNodes(),
      maxDepth: this.findMaxDepth(),
      stats,
      warnings: [...this.warnings, ...validation.warnings],
    };
  }

  /**
   * Create normalized nodes from raw URLs
   */
  private createNodes(rawNodes: RawNode[]): HierarchicalNode[] {
    const nodes: HierarchicalNode[] = [];
    const urlSet = new Set<string>();

    for (const raw of rawNodes) {
      // Normalize URL
      const normalized = this.normalizeUrl(raw.url);

      // Skip duplicates
      if (urlSet.has(normalized)) {
        this.warnings.push(`Duplicate URL skipped: ${raw.url}`);
        continue;
      }
      urlSet.add(normalized);

      // Create node
      const node: HierarchicalNode = {
        id: this.generateId(normalized),
        url: normalized,
        path: this.extractPath(normalized),
        title: raw.title || this.generateTitle(normalized),
        parent_id: null,
        depth: 0,
        children: [],
        slug: this.extractSlug(normalized),
        breadcrumb: this.extractBreadcrumb(normalized),
      };

      nodes.push(node);
      this.nodeMap.set(node.id, node);
    }

    return nodes;
  }

  /**
   * Build parent-child relationships based on URL structure
   */
  private buildRelationships(nodes: HierarchicalNode[]): void {
    // Sort nodes by path length (shorter paths first)
    const sorted = [...nodes].sort((a, b) => {
      const aSegments = a.path.split('/').filter(Boolean).length;
      const bSegments = b.path.split('/').filter(Boolean).length;
      return aSegments - bSegments;
    });

    for (const node of sorted) {
      const parentUrl = this.findParentUrl(node.url, nodes);

      if (parentUrl) {
        const parent = nodes.find((n) => n.url === parentUrl);
        if (parent) {
          node.parent_id = parent.id;
          parent.children.push(node.id);
        }
      }
    }
  }

  /**
   * Find the best parent URL for a given URL
   */
  private findParentUrl(url: string, allNodes: HierarchicalNode[]): string | null {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);

    // No parent for root or single-segment paths
    if (pathSegments.length <= 1) {
      return null;
    }

    // Try progressively shorter paths to find parent
    for (let i = pathSegments.length - 1; i > 0; i--) {
      const parentPath = '/' + pathSegments.slice(0, i).join('/');
      const parentUrl = `${urlObj.protocol}//${urlObj.host}${parentPath}`;

      // Check if this potential parent exists in our nodes
      if (allNodes.some((n) => n.url === parentUrl || n.url === parentUrl + '/')) {
        return parentUrl;
      }
    }

    // Check for homepage parent
    const homepageUrl = `${urlObj.protocol}//${urlObj.host}`;
    if (allNodes.some((n) => n.url === homepageUrl || n.url === homepageUrl + '/')) {
      return homepageUrl;
    }

    return null;
  }

  /**
   * Calculate depth for each node
   */
  private calculateDepths(): void {
    const visited = new Set<string>();
    const rootNodes = this.findRootNodes();

    for (const rootId of rootNodes) {
      this.calculateDepthRecursive(rootId, 0, visited);
    }
  }

  private calculateDepthRecursive(nodeId: string, depth: number, visited: Set<string>): void {
    // Prevent infinite loops
    if (visited.has(nodeId)) {
      this.warnings.push(`Circular reference detected at node: ${nodeId}`);
      return;
    }
    visited.add(nodeId);

    const node = this.nodeMap.get(nodeId);
    if (!node) return;

    node.depth = depth;

    for (const childId of node.children) {
      this.calculateDepthRecursive(childId, depth + 1, visited);
    }
  }

  /**
   * Validate hierarchy for issues
   */
  private validateHierarchy(): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Check for circular references
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const node of this.nodeMap.values()) {
      if (!visited.has(node.id)) {
        this.detectCycles(node.id, visited, recursionStack, warnings);
      }
    }

    // Check for orphaned nodes (non-root nodes without parents)
    for (const node of this.nodeMap.values()) {
      if (node.parent_id && !this.nodeMap.has(node.parent_id)) {
        warnings.push(`Orphaned node detected: ${node.url}`);
      }
    }

    // Check for extremely deep hierarchies
    const maxDepth = this.findMaxDepth();
    if (maxDepth > 10) {
      warnings.push(`Very deep hierarchy detected: ${maxDepth} levels`);
    }

    return {
      valid: warnings.length === 0,
      warnings,
    };
  }

  private detectCycles(
    nodeId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    warnings: string[]
  ): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = this.nodeMap.get(nodeId);
    if (!node) return false;

    for (const childId of node.children) {
      if (!visited.has(childId)) {
        if (this.detectCycles(childId, visited, recursionStack, warnings)) {
          return true;
        }
      } else if (recursionStack.has(childId)) {
        warnings.push(`Cycle detected: ${nodeId} -> ${childId}`);
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  /**
   * Utility methods
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove trailing slash except for homepage
      let normalized = urlObj.href;
      if (normalized.endsWith('/') && urlObj.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }
      return normalized.toLowerCase();
    } catch {
      this.warnings.push(`Invalid URL: ${url}`);
      return url.toLowerCase();
    }
  }

  private extractPath(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return '/';
    }
  }

  private extractSlug(url: string): string {
    const path = this.extractPath(url);
    const segments = path.split('/').filter(Boolean);
    return segments[segments.length - 1] || 'home';
  }

  private extractBreadcrumb(url: string): string[] {
    const path = this.extractPath(url);
    return path.split('/').filter(Boolean);
  }

  private generateTitle(url: string): string {
    const slug = this.extractSlug(url);
    return slug
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateId(url: string): string {
    // Simple hash function for consistent IDs
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `node_${Math.abs(hash).toString(16)}`;
  }

  private findRootNodes(): string[] {
    return Array.from(this.nodeMap.values())
      .filter((node) => !node.parent_id)
      .map((node) => node.id);
  }

  private findMaxDepth(): number {
    let maxDepth = 0;
    for (const node of this.nodeMap.values()) {
      maxDepth = Math.max(maxDepth, node.depth);
    }
    return maxDepth;
  }

  private calculateStats() {
    const nodes = Array.from(this.nodeMap.values());
    const rootNodes = nodes.filter((n) => !n.parent_id);
    const leafNodes = nodes.filter((n) => n.children.length === 0);

    const childCounts = nodes.map((n) => n.children.length);
    const totalChildren = childCounts.reduce((sum, count) => sum + count, 0);
    const averageChildren = nodes.length > 0 ? totalChildren / nodes.length : 0;
    const maxChildren = Math.max(...childCounts, 0);

    return {
      totalNodes: nodes.length,
      rootNodes: rootNodes.length,
      leafNodes: leafNodes.length,
      averageChildren: Math.round(averageChildren * 100) / 100,
      maxChildren,
    };
  }
}
```

### 2. API Layer Implementation

#### New File: `app/api/taxonomy/hierarchy/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { HierarchyBuilder } from '@/lib/processing/hierarchy-builder';
import { HierarchyAnalyzer } from '@/lib/processing/hierarchy-analyzer';

// GET /api/taxonomy/hierarchy?project_id=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch all nodes for project
  const { data: nodes, error } = await supabase
    .from('taxonomy_nodes')
    .select('*')
    .eq('project_id', projectId)
    .order('depth', { ascending: true })
    .order('position', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Analyze hierarchy health
  const analyzer = new HierarchyAnalyzer();
  const analysis = analyzer.analyzeHierarchy(nodes);

  return NextResponse.json({
    nodes,
    analysis,
    stats: {
      total: nodes.length,
      maxDepth: Math.max(...nodes.map((n) => n.depth || 0)),
      orphaned: analysis.orphanNodes.length,
      duplicates: analysis.duplicateUrls.length,
    },
  });
}

// POST /api/taxonomy/hierarchy/build
export async function POST(request: NextRequest) {
  const body = await request.json();

  const schema = z.object({
    projectId: z.string().uuid(),
    urls: z.array(
      z.object({
        url: z.string().url(),
        title: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })
    ),
    options: z
      .object({
        autoDetectRelationships: z.boolean().default(true),
        validateIntegrity: z.boolean().default(true),
        preserveExisting: z.boolean().default(false),
      })
      .optional(),
  });

  const validated = schema.parse(body);
  const supabase = await createClient();

  // Build hierarchy
  const builder = new HierarchyBuilder();
  const hierarchy = await builder.buildFromUrls(validated.urls, {
    projectId: validated.projectId,
    ...validated.options,
  });

  // Validate if requested
  if (validated.options?.validateIntegrity) {
    const analyzer = new HierarchyAnalyzer();
    const validation = analyzer.validateHierarchy(hierarchy.nodes);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Hierarchy validation failed',
          issues: validation.issues,
        },
        { status: 400 }
      );
    }
  }

  // Batch upsert nodes
  const { error: upsertError } = await supabase.from('taxonomy_nodes').upsert(hierarchy.nodes, {
    onConflict: validated.options?.preserveExisting ? 'url,project_id' : undefined,
  });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    hierarchy,
    stats: hierarchy.stats,
  });
}

// PATCH /api/taxonomy/hierarchy/node/:id
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const nodeId = request.url.split('/').pop();

  const schema = z.object({
    parent_id: z.string().uuid().nullable().optional(),
    title: z.string().optional(),
    position: z.number().optional(),
    metadata: z.record(z.any()).optional(),
  });

  const validated = schema.parse(body);
  const supabase = await createClient();

  // Update node
  const { data, error } = await supabase
    .from('taxonomy_nodes')
    .update(validated)
    .eq('id', nodeId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recalculate depths if parent changed
  if (validated.parent_id !== undefined) {
    const builder = new HierarchyBuilder();
    await builder.recalculateDepths(data.project_id);
  }

  return NextResponse.json(data);
}

// DELETE /api/taxonomy/hierarchy/node/:id
export async function DELETE(request: NextRequest) {
  const nodeId = request.url.split('/').pop();
  const { searchParams } = new URL(request.url);
  const cascade = searchParams.get('cascade') === 'true';

  const supabase = await createClient();

  if (cascade) {
    // Delete node and all descendants
    const { error } = await supabase.rpc('delete_node_cascade', {
      node_id: nodeId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // Orphan children by setting their parent_id to null
    const { error: orphanError } = await supabase
      .from('taxonomy_nodes')
      .update({ parent_id: null })
      .eq('parent_id', nodeId);

    if (orphanError) {
      return NextResponse.json({ error: orphanError.message }, { status: 500 });
    }

    // Delete the node
    const { error: deleteError } = await supabase.from('taxonomy_nodes').delete().eq('id', nodeId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
```

### 3. UI Components

#### New File: `components/taxonomy/hierarchy-builder.tsx`

```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Tree, NodeModel, NodeApi } from '@minoru/react-dnd-treeview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronRight, ChevronDown, MoreVertical, Plus, Trash2, Edit2 } from 'lucide-react';
import { useTaxonomyNodes } from '@/hooks/use-taxonomy-nodes';
import { cn } from '@/lib/utils';

interface HierarchyBuilderProps {
  projectId: string;
  onNodeSelect?: (node: TaxonomyNode) => void;
  onHierarchyChange?: (nodes: TaxonomyNode[]) => void;
}

export function HierarchyBuilder({
  projectId,
  onNodeSelect,
  onHierarchyChange
}: HierarchyBuilderProps) {
  const { nodes, loading, updateNode, deleteNode, refresh } = useTaxonomyNodes(projectId);
  const [treeData, setTreeData] = useState<NodeModel[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Convert taxonomy nodes to tree data format
  useEffect(() => {
    if (nodes) {
      const treeNodes: NodeModel[] = nodes.map(node => ({
        id: node.id,
        parent: node.parent_id || 0,
        text: node.title,
        droppable: true,
        data: node
      }));
      setTreeData(treeNodes);
    }
  }, [nodes]);

  // Handle drag and drop
  const handleDrop = useCallback(
    async (newTree: NodeModel[], options: { dropTargetId: string; dragSourceId: string }) => {
      setTreeData(newTree);

      // Update parent relationship in database
      await updateNode(options.dragSourceId, {
        parent_id: options.dropTargetId === '0' ? null : options.dropTargetId
      });

      // Notify parent component
      if (onHierarchyChange) {
        const updatedNodes = newTree.map(n => n.data as TaxonomyNode);
        onHierarchyChange(updatedNodes);
      }
    },
    [updateNode, onHierarchyChange]
  );

  // Node renderer
  const renderNode = (node: NodeModel, { depth, isOpen, onToggle }: NodeApi) => {
    const isSelected = selectedNode === node.id;
    const isEditing = editingNode === node.id;
    const hasChildren = treeData.some(n => n.parent === node.id);

    return (
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-accent',
          isSelected && 'bg-accent',
          `ml-${depth * 4}`
        )}
        onClick={() => {
          setSelectedNode(node.id as string);
          if (onNodeSelect) {
            onNodeSelect(node.data as TaxonomyNode);
          }
        }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="p-0.5"
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}

        {isEditing ? (
          <Input
            value={node.text}
            onChange={(e) => {
              const updated = treeData.map(n =>
                n.id === node.id ? { ...n, text: e.target.value } : n
              );
              setTreeData(updated);
            }}
            onBlur={async () => {
              await updateNode(node.id as string, { title: node.text });
              setEditingNode(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="h-6 text-sm"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm">{node.text}</span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {node.data?.depth !== undefined && (
            <Badge variant="outline" className="text-xs">
              L{node.data.depth}
            </Badge>
          )}

          {node.data?.sku_count > 0 && (
            <Badge variant="secondary" className="text-xs">
              {node.data.sku_count} SKUs
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingNode(node.id as string);
                }}
              >
                <Edit2 size={14} className="mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async (e) => {
                  e.stopPropagation();
                  // Add new child node
                  // Implementation here
                }}
              >
                <Plus size={14} className="mr-2" />
                Add Child
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm('Delete this node and all children?')) {
                    await deleteNode(node.id as string, true);
                  }
                }}
                className="text-destructive"
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div>Loading hierarchy...</div>;
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold">Content Hierarchy</h3>
        <Button onClick={refresh} size="sm" variant="outline">
          Refresh
        </Button>
      </div>

      <Tree
        tree={treeData}
        rootId={0}
        render={renderNode}
        onDrop={handleDrop}
        initialOpen={Array.from(expandedNodes)}
        classes={{
          root: 'hierarchy-tree',
          draggingSource: 'opacity-50',
          dropTarget: 'bg-primary/10'
        }}
      />
    </Card>
  );
}
```

### 4. Test Suite

#### File: `lib/processing/hierarchy-builder.test.ts`

```typescript
import { HierarchyBuilder } from './hierarchy-builder';
import { HierarchyAnalyzer } from './hierarchy-analyzer';
import { createClient } from '@/lib/supabase/server';

describe('HierarchyBuilder', () => {
  let builder: HierarchyBuilder;

  beforeEach(() => {
    builder = new HierarchyBuilder();
  });

  describe('buildFromUrls', () => {
    it('should build simple hierarchy', () => {
      const input = [
        { url: 'https://example.com', title: 'Home' },
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/products/shoes', title: 'Shoes' },
        { url: 'https://example.com/products/shoes/running', title: 'Running Shoes' },
      ];

      const result = builder.buildFromUrls(input);

      expect(result.nodes).toHaveLength(4);
      expect(result.rootNodes).toHaveLength(1);
      expect(result.maxDepth).toBe(3);

      const home = result.nodes.find((n) => n.slug === 'home');
      expect(home?.depth).toBe(0);
      expect(home?.children).toHaveLength(1);

      const running = result.nodes.find((n) => n.slug === 'running');
      expect(running?.depth).toBe(3);
      expect(running?.breadcrumb).toEqual(['products', 'shoes', 'running']);
    });

    it('should handle multiple root nodes', () => {
      const input = [
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/blog', title: 'Blog' },
        { url: 'https://example.com/about', title: 'About' },
      ];

      const result = builder.buildFromUrls(input);

      expect(result.rootNodes).toHaveLength(3);
      expect(result.stats.rootNodes).toBe(3);
    });

    it('should detect circular references', () => {
      // This would require manual manipulation since URLs can't naturally be circular
      // Testing validation logic
      const result = builder.buildFromUrls([
        { url: 'https://example.com/a', title: 'A' },
        { url: 'https://example.com/a/b', title: 'B' },
      ]);

      // Manually create circular reference for testing
      if (result.nodes[0] && result.nodes[1]) {
        result.nodes[0].parent_id = result.nodes[1].id;
      }

      // Validation should detect this
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should normalize URLs correctly', () => {
      const input = [
        { url: 'https://EXAMPLE.com/Products/', title: 'Products' },
        { url: 'https://example.com/products', title: 'Products Duplicate' },
      ];

      const result = builder.buildFromUrls(input);

      expect(result.nodes).toHaveLength(1);
      expect(result.warnings).toContain('Duplicate URL skipped: https://example.com/products');
    });

    it('should generate titles from URLs when missing', () => {
      const input = [
        { url: 'https://example.com/winter-jackets' },
        { url: 'https://example.com/running_shoes' },
      ];

      const result = builder.buildFromUrls(input);

      const winterJackets = result.nodes.find((n) => n.slug === 'winter-jackets');
      expect(winterJackets?.title).toBe('Winter Jackets');

      const runningShoes = result.nodes.find((n) => n.slug === 'running_shoes');
      expect(runningShoes?.title).toBe('Running Shoes');
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const result = builder.buildFromUrls([]);
      expect(result.nodes).toHaveLength(0);
      expect(result.rootNodes).toHaveLength(0);
    });

    it('should handle invalid URLs', () => {
      const input = [
        { url: 'not-a-url', title: 'Invalid' },
        { url: 'https://example.com', title: 'Valid' },
      ];

      const result = builder.buildFromUrls(input);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle very deep hierarchies', () => {
      const input = [];
      let path = 'https://example.com';

      // Create 12 levels deep
      for (let i = 0; i < 12; i++) {
        path += `/level${i}`;
        input.push({ url: path, title: `Level ${i}` });
      }

      const result = builder.buildFromUrls(input);
      expect(result.maxDepth).toBe(11);
      expect(result.warnings).toContainEqual(expect.stringContaining('Very deep hierarchy'));
    });
  });

  describe('performance', () => {
    it('should handle 1000+ URLs efficiently', () => {
      const input = [];

      // Generate 1000 URLs
      for (let i = 0; i < 1000; i++) {
        const category = Math.floor(i / 100);
        const subcategory = Math.floor(i / 10) % 10;
        input.push({
          url: `https://example.com/cat${category}/sub${subcategory}/item${i}`,
          title: `Item ${i}`,
        });
      }

      const start = Date.now();
      const result = builder.buildFromUrls(input);
      const duration = Date.now() - start;

      expect(result.nodes).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
```

### 5. Real-time Updates with WebSockets

#### New File: `lib/realtime/hierarchy-sync.ts`

```typescript
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export class HierarchyRealtimeSync {
  private channel: RealtimeChannel | null = null;
  private listeners: Map<string, Set<(payload: any) => void>> = new Map();

  constructor(private supabase: SupabaseClient) {}

  /**
   * Subscribe to hierarchy changes for a project
   */
  subscribeToProject(
    projectId: string,
    callbacks: {
      onInsert?: (node: TaxonomyNode) => void;
      onUpdate?: (node: TaxonomyNode) => void;
      onDelete?: (nodeId: string) => void;
    }
  ) {
    // Clean up existing subscription
    this.unsubscribe();

    // Create new channel
    this.channel = this.supabase
      .channel(`hierarchy:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'taxonomy_nodes',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (callbacks.onInsert) {
            callbacks.onInsert(payload.new as TaxonomyNode);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'taxonomy_nodes',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (callbacks.onUpdate) {
            callbacks.onUpdate(payload.new as TaxonomyNode);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'taxonomy_nodes',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (callbacks.onDelete) {
            callbacks.onDelete(payload.old.id);
          }
        }
      )
      .subscribe();

    return this;
  }

  /**
   * Broadcast hierarchy operation to other clients
   */
  async broadcastOperation(operation: {
    type: 'move' | 'edit' | 'delete' | 'add';
    nodeId: string;
    data?: any;
  }) {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'hierarchy_operation',
      payload: operation,
    });
  }

  /**
   * Listen for operations from other clients
   */
  onRemoteOperation(callback: (operation: any) => void) {
    if (!this.channel) return;

    this.channel.on('broadcast', { event: 'hierarchy_operation' }, (payload) =>
      callback(payload.payload)
    );
  }

  /**
   * Clean up subscriptions
   */
  unsubscribe() {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.listeners.clear();
  }
}
```

### 6. Usage Examples

```typescript
// Example 1: Basic usage
const builder = new HierarchyBuilder();
const hierarchy = builder.buildFromUrls([
  { url: 'https://store.com', title: 'Home' },
  { url: 'https://store.com/clothing', title: 'Clothing' },
  { url: 'https://store.com/clothing/mens', title: "Men's Clothing" },
  { url: 'https://store.com/clothing/womens', title: "Women's Clothing" },
]);

console.log(hierarchy.stats);
// {
//   totalNodes: 4,
//   rootNodes: 1,
//   leafNodes: 2,
//   averageChildren: 0.75,
//   maxChildren: 2
// }

// Example 2: With validation warnings
const hierarchy2 = builder.buildFromUrls([
  { url: 'https://store.com/a/b/c/d/e/f/g/h/i/j/k/l', title: 'Deep' },
]);

console.log(hierarchy2.warnings);
// ["Very deep hierarchy detected: 11 levels"]
```

## Development Checklist

### Phase 1: Backend (Hours 1-3)

- [ ] Enhance `HierarchyBuilder` class with batch operations
- [ ] Create API endpoints for CRUD operations
- [ ] Implement validation and integrity checks
- [ ] Add database functions for cascade operations
- [ ] Write comprehensive test suite

### Phase 2: Frontend (Hours 4-6)

- [ ] Build `HierarchyBuilder` React component
- [ ] Implement drag-and-drop functionality
- [ ] Add inline editing capabilities
- [ ] Create context menus for node operations
- [ ] Style with Tailwind and shadcn/ui

### Phase 3: Real-time (Hours 7-8)

- [ ] Set up Supabase real-time subscriptions
- [ ] Implement optimistic UI updates
- [ ] Add conflict resolution for concurrent edits
- [ ] Create activity feed for hierarchy changes
- [ ] Test multi-user scenarios

## Implementation Strategy

### Day 1: Foundation

1. **Morning (2-3 hours)**
   - Enhance existing `TaxonomyBuilder` with new methods
   - Create unified `HierarchyBuilder` class
   - Implement batch operations and validation

2. **Afternoon (2-3 hours)**
   - Build REST API endpoints
   - Add authentication and authorization
   - Write integration tests

### Day 2: User Interface

3. **Morning (2-3 hours)**
   - Create React components for hierarchy visualization
   - Implement drag-and-drop with react-dnd-treeview
   - Add inline editing and context menus

4. **Afternoon (2-3 hours)**
   - Connect frontend to API
   - Add real-time updates
   - Implement optimistic UI
   - End-to-end testing

## Performance & Scalability

### Optimization Strategies

- **Database**: Use CTEs for recursive queries, indexed on `parent_id` and `project_id`
- **Caching**: Redis for frequently accessed hierarchies
- **Pagination**: Virtual scrolling for large trees (10,000+ nodes)
- **Batch Operations**: Process in chunks of 500 nodes
- **Debouncing**: 300ms delay on drag-drop operations

### Benchmarks

- Load 1,000 nodes: <500ms
- Load 10,000 nodes: <2s
- Drag-drop operation: <100ms
- Search within tree: <50ms
- Bulk import 5,000 URLs: <5s

## Integration Points

### Downstream Dependencies

- **TASK-003**: Batch Import API will use hierarchy builder
- **TASK-004**: Visualization renders hierarchical data
- **TASK-005**: Scoring algorithms traverse hierarchy
- **TASK-006**: Export includes hierarchy metadata

### Upstream Dependencies

- **Database Schema**: ✅ Complete (taxonomy_nodes table ready)
- **Authentication**: ✅ Using Supabase Auth
- **Project Management**: ✅ Projects table exists

## Technical Decisions

### Architecture Choices

- **Pattern**: Repository pattern for data access
- **State Management**: React Query for server state
- **UI Library**: shadcn/ui for consistent design
- **Tree Component**: @minoru/react-dnd-treeview for drag-drop
- **Validation**: Zod for runtime type checking
- **Testing**: Vitest for unit tests, Playwright for E2E

### Data Model Decisions

- **ID Generation**: UUID v4 for node IDs
- **URL Normalization**: Lowercase, remove trailing slashes
- **Depth Limit**: Max 10 levels (configurable)
- **Position**: 0-based indexing for siblings
- **Soft Delete**: Add `deleted_at` for recovery

## Risk Mitigation

### Technical Risks

1. **Large Dataset Performance**
   - Mitigation: Virtual scrolling, pagination, lazy loading

2. **Concurrent Edit Conflicts**
   - Mitigation: Optimistic locking, real-time sync

3. **Data Integrity Issues**
   - Mitigation: Database constraints, validation layer

4. **Browser Memory Limits**
   - Mitigation: Virtualization, progressive loading

## Success Metrics

- **Performance**: 95% of operations complete in <500ms
- **Reliability**: 99.9% uptime for hierarchy API
- **Usability**: Users can build 100-node hierarchy in <5 minutes
- **Quality**: Zero data corruption incidents
- **Adoption**: 80% of imported sitemaps use hierarchy builder

## Future Enhancements

### Version 2.0

- AI-powered hierarchy suggestions
- Bulk operations with preview
- Version control for hierarchies
- Template library for common structures
- Advanced filtering and search
- Hierarchy comparison tools
- Performance insights dashboard
- Export to various formats (JSON, CSV, XML)
- Import from competitor sitemaps
- Collaborative editing with presence
