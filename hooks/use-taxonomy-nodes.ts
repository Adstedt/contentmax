import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/external/supabase/client';
import { HierarchicalNode } from '@/lib/processing/hierarchy-builder';

interface UseTaxonomyNodesOptions {
  projectId: string;
  realtime?: boolean;
}

interface UseTaxonomyNodesReturn {
  nodes: HierarchicalNode[];
  loading: boolean;
  error: Error | null;
  updateNode: (nodeId: string, updates: Partial<HierarchicalNode>) => Promise<void>;
  deleteNode: (nodeId: string, cascade?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTaxonomyNodes({
  projectId,
  realtime = false,
}: UseTaxonomyNodesOptions): UseTaxonomyNodesReturn {
  const [nodes, setNodes] = useState<HierarchicalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  // Fetch nodes from API
  const fetchNodes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/taxonomy/hierarchy?project_id=${projectId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch nodes: ${response.statusText}`);
      }

      const data = await response.json();
      setNodes(data.nodes || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch nodes'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Update a single node
  const updateNode = useCallback(
    async (nodeId: string, updates: Partial<HierarchicalNode>) => {
      try {
        const response = await fetch(`/api/taxonomy/hierarchy/node/${nodeId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error(`Failed to update node: ${response.statusText}`);
        }

        const updatedNode = await response.json();

        // Optimistic update
        setNodes((prev) =>
          prev.map((node) => (node.id === nodeId ? { ...node, ...updatedNode } : node))
        );

        // Refresh to ensure consistency
        await fetchNodes();
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update node'));
        throw err;
      }
    },
    [fetchNodes]
  );

  // Delete a node
  const deleteNode = useCallback(
    async (nodeId: string, cascade = false) => {
      try {
        const response = await fetch(`/api/taxonomy/hierarchy/node/${nodeId}?cascade=${cascade}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error(`Failed to delete node: ${response.statusText}`);
        }

        // Optimistic update
        if (cascade) {
          // Remove node and all descendants
          const removeDescendants = (id: string, nodeList: HierarchicalNode[]) => {
            const node = nodeList.find((n) => n.id === id);
            if (!node) return [];

            let toRemove = [id];
            for (const childId of node.children) {
              toRemove = [...toRemove, ...removeDescendants(childId, nodeList)];
            }
            return toRemove;
          };

          const idsToRemove = removeDescendants(nodeId, nodes);
          setNodes((prev) => prev.filter((node) => !idsToRemove.includes(node.id)));
        } else {
          // Just remove the single node and orphan children
          setNodes(
            (prev) =>
              prev
                .map((node) => {
                  if (node.id === nodeId) {
                    return null;
                  }
                  if (node.parent_id === nodeId) {
                    return { ...node, parent_id: null };
                  }
                  return node;
                })
                .filter(Boolean) as HierarchicalNode[]
          );
        }

        // Refresh to ensure consistency
        await fetchNodes();
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to delete node'));
        throw err;
      }
    },
    [nodes, fetchNodes]
  );

  // Initial fetch
  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // Set up real-time subscription if enabled
  useEffect(() => {
    if (!realtime) return;

    const channel = supabase
      .channel(`taxonomy:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'taxonomy_nodes',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          // Refresh nodes when any change occurs
          fetchNodes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, realtime, supabase, fetchNodes]);

  return {
    nodes,
    loading,
    error,
    updateNode,
    deleteNode,
    refresh: fetchNodes,
  };
}
