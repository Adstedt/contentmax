'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tree, NodeModel, TreeMethods, DragLayerMonitorProps } from '@minoru/react-dnd-treeview';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import {
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useTaxonomyNodes } from '@/hooks/use-taxonomy-nodes';
import { HierarchicalNode } from '@/lib/processing/hierarchy-builder';
import { cn } from '@/lib/utils';

interface HierarchyBuilderProps {
  projectId: string;
  onNodeSelect?: (node: HierarchicalNode) => void;
  onHierarchyChange?: (nodes: HierarchicalNode[]) => void;
  className?: string;
}

interface TreeNode extends NodeModel<HierarchicalNode> {
  id: string | number;
  parent: string | number;
  text: string;
  droppable?: boolean;
  data?: HierarchicalNode;
}

export function HierarchyBuilder({
  projectId,
  onNodeSelect,
  onHierarchyChange,
  className,
}: HierarchyBuilderProps) {
  const { nodes, loading, error, updateNode, deleteNode, refresh } = useTaxonomyNodes({
    projectId,
    realtime: true,
  });

  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string | number>>(new Set());

  // Convert HierarchicalNode[] to TreeNode[] format for react-dnd-treeview
  useEffect(() => {
    const treeNodes: TreeNode[] = nodes.map((node) => ({
      id: node.id,
      parent: node.parent_id || 0, // Use 0 as root parent
      text: node.title,
      droppable: true,
      data: node,
    }));
    setTreeData(treeNodes);
  }, [nodes]);

  // Filter tree data based on search
  const filteredTreeData = useMemo(() => {
    if (!searchQuery) return treeData;

    const query = searchQuery.toLowerCase();
    const matchingNodes = new Set<string | number>();
    const ancestorNodes = new Set<string | number>();

    // Find matching nodes
    treeData.forEach((node) => {
      if (node.text.toLowerCase().includes(query)) {
        matchingNodes.add(node.id);

        // Add all ancestors
        let currentNode = node;
        while (currentNode.parent !== 0) {
          ancestorNodes.add(currentNode.parent);
          const parentNode = treeData.find((n) => n.id === currentNode.parent);
          if (!parentNode) break;
          currentNode = parentNode;
        }
      }
    });

    // Expand matching nodes and ancestors
    setExpandedNodes(new Set([...matchingNodes, ...ancestorNodes]));

    // Return all nodes but highlight matches
    return treeData.map((node) => ({
      ...node,
      isMatch: matchingNodes.has(node.id),
    }));
  }, [treeData, searchQuery]);

  // Handle drag and drop
  const handleDrop = useCallback(
    async (newTree: TreeNode[], options: any) => {
      if (!options.dragSourceId) return;

      setTreeData(newTree);

      // Update parent relationship in database
      const draggedNode = newTree.find((n) => n.id === options.dragSourceId);
      if (draggedNode && draggedNode.data) {
        const newParentId = options.dropTargetId === 0 ? null : String(options.dropTargetId);

        await updateNode(String(options.dragSourceId), {
          parent_id: newParentId,
        });

        // Notify parent component
        if (onHierarchyChange) {
          const updatedNodes = newTree.map((n) => n.data).filter(Boolean) as HierarchicalNode[];
          onHierarchyChange(updatedNodes);
        }
      }
    },
    [updateNode, onHierarchyChange]
  );

  // Handle node selection
  const handleNodeClick = useCallback(
    (node: TreeNode) => {
      setSelectedNodeId(String(node.id));
      if (onNodeSelect && node.data) {
        onNodeSelect(node.data);
      }
    },
    [onNodeSelect]
  );

  // Handle inline editing
  const startEditing = useCallback((node: TreeNode) => {
    setEditingNodeId(String(node.id));
    setEditingText(node.text);
  }, []);

  const saveEdit = useCallback(async () => {
    if (editingNodeId && editingText.trim()) {
      await updateNode(editingNodeId, { title: editingText.trim() });
      setEditingNodeId(null);
      setEditingText('');
    }
  }, [editingNodeId, editingText, updateNode]);

  const cancelEdit = useCallback(() => {
    setEditingNodeId(null);
    setEditingText('');
  }, []);

  // Handle node deletion
  const handleDeleteNode = useCallback(
    async (nodeId: string, cascade: boolean) => {
      const message = cascade
        ? 'Delete this node and all its children?'
        : 'Delete this node? (children will be orphaned)';

      if (confirm(message)) {
        await deleteNode(nodeId, cascade);
      }
    },
    [deleteNode]
  );

  // Custom node renderer
  const renderNode = useCallback(
    (node: TreeNode, { depth, isOpen, onToggle }: any) => {
      const isSelected = selectedNodeId === String(node.id);
      const isEditing = editingNodeId === String(node.id);
      const hasChildren = treeData.some((n) => n.parent === node.id);
      const isMatch = (node as any).isMatch;

      return (
        <div
          className={cn(
            'flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors',
            'hover:bg-accent',
            isSelected && 'bg-accent',
            isMatch && 'bg-yellow-100 dark:bg-yellow-900/20',
            depth > 0 && `ml-${Math.min(depth * 4, 20)}`
          )}
          onClick={() => handleNodeClick(node)}
        >
          {/* Expand/Collapse button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="p-0.5 hover:bg-accent-foreground/10 rounded"
            >
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          {!hasChildren && <div className="w-5" />}

          {/* Node content */}
          <div className="flex-1 flex items-center gap-2">
            {isEditing ? (
              <Input
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveEdit();
                  } else if (e.key === 'Escape') {
                    cancelEdit();
                  }
                }}
                className="h-7 text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm">{node.text}</span>
            )}
          </div>

          {/* Metadata badges */}
          <div className="flex items-center gap-1">
            {node.data?.depth !== undefined && (
              <Badge variant="outline" className="text-xs">
                L{node.data.depth}
              </Badge>
            )}

            {node.data?.metadata?.skuCount && node.data.metadata.skuCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {node.data.metadata.skuCount} SKUs
              </Badge>
            )}

            {/* Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(node);
                  }}
                >
                  <Edit2 size={14} className="mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async (e) => {
                    e.stopPropagation();
                    // TODO: Add new child node functionality
                    alert('Add child node functionality coming soon');
                  }}
                >
                  <Plus size={14} className="mr-2" />
                  Add Child
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async (e) => {
                    e.stopPropagation();
                    await handleDeleteNode(String(node.id), false);
                  }}
                  className="text-destructive"
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async (e) => {
                    e.stopPropagation();
                    await handleDeleteNode(String(node.id), true);
                  }}
                  className="text-destructive"
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete with Children
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      );
    },
    [
      selectedNodeId,
      editingNodeId,
      editingText,
      treeData,
      handleNodeClick,
      startEditing,
      saveEdit,
      cancelEdit,
      handleDeleteNode,
    ]
  );

  // Custom drag preview
  const renderDragPreview = useCallback((props: DragLayerMonitorProps<HierarchicalNode>) => {
    const item = props.item;
    return (
      <div className="bg-primary text-primary-foreground px-2 py-1 rounded shadow-lg">
        {item?.text}
      </div>
    );
  }, []);

  if (error) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="text-destructive">Error loading hierarchy: {error.message}</div>
        <Button onClick={refresh} size="sm" className="mt-2">
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <Card className={cn('p-4', className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Content Hierarchy</h3>
          <Button onClick={refresh} size="sm" variant="outline" disabled={loading}>
            <RefreshCw size={16} className={cn('mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
            size={16}
          />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tree */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading hierarchy...</div>
          </div>
        ) : filteredTreeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <div>No nodes found</div>
            <div className="text-sm mt-2">Import a sitemap to get started</div>
          </div>
        ) : (
          <div className="min-h-[400px] max-h-[600px] overflow-auto">
            <Tree
              tree={filteredTreeData}
              rootId={0}
              render={renderNode}
              onDrop={handleDrop}
              dragPreviewRender={renderDragPreview}
              initialOpen={Array.from(expandedNodes)}
              sort={false}
              insertDroppableFirst={false}
              canDrop={(tree, { dragSource, dropTargetId }) => {
                // Prevent dropping a node onto itself or its descendants
                if (dragSource?.id === dropTargetId) return false;

                const isDescendant = (
                  nodeId: string | number,
                  ancestorId: string | number
                ): boolean => {
                  const node = tree.find((n) => n.id === nodeId);
                  if (!node) return false;
                  if (node.parent === ancestorId) return true;
                  if (node.parent === 0) return false;
                  return isDescendant(node.parent, ancestorId);
                };

                if (dragSource && isDescendant(dropTargetId, dragSource.id)) return false;

                return true;
              }}
              classes={{
                root: 'hierarchy-tree',
                draggingSource: 'opacity-30',
                dropTarget: 'bg-primary/10',
              }}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
