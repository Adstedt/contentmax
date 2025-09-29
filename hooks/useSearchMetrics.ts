import { useState, useEffect } from 'react';
import { supabase } from '@/lib/external/supabase/client';
import type { SearchMetrics } from '@/components/taxonomy/D3Visualization/NodeTooltip';

interface UseSearchMetricsOptions {
  nodeId?: string;
  url?: string;
  enabled?: boolean;
  dateRange?: number; // days
}

interface UseSearchMetricsReturn {
  metrics: SearchMetrics | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSearchMetrics({
  nodeId,
  url,
  enabled = true,
  dateRange = 30
}: UseSearchMetricsOptions): UseSearchMetricsReturn {
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = async () => {
    if (!enabled || (!nodeId && !url)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate date range
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      // Build query
      let query = supabase
        .from('search_metrics')
        .select('clicks, impressions, ctr, position, date');

      if (nodeId) {
        query = query.eq('node_id', nodeId);
      } else if (url) {
        query = query.eq('url', url);
      }

      query = query
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      if (!data || data.length === 0) {
        setMetrics(null);
        return;
      }

      // Aggregate metrics for the period
      const currentMetrics = aggregateMetrics(data.slice(0, Math.ceil(data.length / 2)));
      const previousMetrics = aggregateMetrics(data.slice(Math.ceil(data.length / 2)));

      setMetrics({
        clicks: currentMetrics.clicks,
        impressions: currentMetrics.impressions,
        ctr: currentMetrics.ctr,
        position: currentMetrics.position,
        previousClicks: previousMetrics.clicks,
        previousImpressions: previousMetrics.impressions,
        previousCtr: previousMetrics.ctr,
        previousPosition: previousMetrics.position,
      });

    } catch (err) {
      console.error('Error fetching search metrics:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [nodeId, url, enabled, dateRange]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
}

function aggregateMetrics(data: any[]): {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
} {
  if (!data || data.length === 0) {
    return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  }

  const totals = data.reduce(
    (acc, item) => ({
      clicks: acc.clicks + (item.clicks || 0),
      impressions: acc.impressions + (item.impressions || 0),
      positionSum: acc.positionSum + (item.position || 0) * (item.impressions || 0),
      impressionsWithPosition: acc.impressionsWithPosition + (item.position > 0 ? item.impressions : 0),
    }),
    { clicks: 0, impressions: 0, positionSum: 0, impressionsWithPosition: 0 }
  );

  return {
    clicks: totals.clicks,
    impressions: totals.impressions,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
    position: totals.impressionsWithPosition > 0
      ? totals.positionSum / totals.impressionsWithPosition
      : 0,
  };
}

/**
 * Hook for fetching aggregated search metrics for multiple nodes
 */
export function useAggregatedSearchMetrics(
  nodeIds: string[],
  options: { enabled?: boolean; dateRange?: number } = {}
): {
  metrics: Map<string, SearchMetrics>;
  loading: boolean;
  error: Error | null;
} {
  const [metrics, setMetrics] = useState<Map<string, SearchMetrics>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { enabled = true, dateRange = 30 } = options;

  useEffect(() => {
    if (!enabled || nodeIds.length === 0) {
      return;
    }

    const fetchAllMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        // Use the aggregated view for better performance
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];

        const { data, error: fetchError } = await supabase
          .from('aggregated_search_metrics')
          .select('*')
          .in('node_id', nodeIds)
          .gte('date', startDate)
          .lte('date', endDate);

        if (fetchError) {
          throw fetchError;
        }

        // Process data into metrics map
        const metricsMap = new Map<string, SearchMetrics>();

        if (data) {
          // Group by node_id
          const nodeGroups = data.reduce((acc, item) => {
            if (!acc[item.node_id]) {
              acc[item.node_id] = [];
            }
            acc[item.node_id].push(item);
            return acc;
          }, {} as Record<string, any[]>);

          // Calculate metrics for each node
          for (const [nodeId, nodeData] of Object.entries(nodeGroups)) {
            const currentMetrics = aggregateMetrics(nodeData.slice(0, Math.ceil(nodeData.length / 2)));
            const previousMetrics = aggregateMetrics(nodeData.slice(Math.ceil(nodeData.length / 2)));

            metricsMap.set(nodeId, {
              clicks: currentMetrics.clicks,
              impressions: currentMetrics.impressions,
              ctr: currentMetrics.ctr,
              position: currentMetrics.position,
              previousClicks: previousMetrics.clicks,
              previousImpressions: previousMetrics.impressions,
              previousCtr: previousMetrics.ctr,
              previousPosition: previousMetrics.position,
            });
          }
        }

        setMetrics(metricsMap);

      } catch (err) {
        console.error('Error fetching aggregated metrics:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch aggregated metrics'));
      } finally {
        setLoading(false);
      }
    };

    fetchAllMetrics();
  }, [nodeIds.join(','), enabled, dateRange]);

  return { metrics, loading, error };
}

/**
 * Hook for sync status
 */
export function useGSCSyncStatus(): {
  syncStatus: any;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/metrics/gsc/sync');
      if (!response.ok) {
        throw new Error('Failed to fetch sync status');
      }

      const data = await response.json();
      setSyncStatus(data);

    } catch (err) {
      console.error('Error fetching sync status:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch sync status'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return {
    syncStatus,
    loading,
    error,
    refetch: fetchStatus,
  };
}

/**
 * Hook for triggering GSC sync
 */
export function useGSCSync() {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const syncData = async (options: {
    dateRange?: number;
    siteUrl?: string;
    forceRefresh?: boolean;
  } = {}) => {
    setSyncing(true);
    setError(null);

    try {
      const response = await fetch('/api/metrics/gsc/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync GSC data');
      }

      const result = await response.json();
      return result;

    } catch (err) {
      console.error('Error syncing GSC data:', err);
      setError(err instanceof Error ? err : new Error('Failed to sync GSC data'));
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  return {
    syncData,
    syncing,
    error,
  };
}