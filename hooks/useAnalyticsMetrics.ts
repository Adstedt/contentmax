import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { AnalyticsMetrics } from '@/components/taxonomy/D3Visualization/NodeTooltip';

interface UseAnalyticsMetricsOptions {
  nodeId?: string;
  enabled?: boolean;
  dateRange?: number; // days
}

interface UseAnalyticsMetricsReturn {
  metrics: AnalyticsMetrics | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAnalyticsMetrics({
  nodeId,
  enabled = true,
  dateRange = 30
}: UseAnalyticsMetricsOptions): UseAnalyticsMetricsReturn {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = async () => {
    if (!enabled || !nodeId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate date range
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      // Fetch aggregated metrics from view
      const { data, error: fetchError } = await supabase
        .from('aggregated_analytics_metrics')
        .select('*')
        .eq('node_id', nodeId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (fetchError) {
        throw fetchError;
      }

      if (!data || data.length === 0) {
        setMetrics(null);
        return;
      }

      // Aggregate metrics for the period
      const currentMetrics = aggregateAnalytics(data.slice(0, Math.ceil(data.length / 2)));
      const previousMetrics = aggregateAnalytics(data.slice(Math.ceil(data.length / 2)));

      setMetrics({
        revenue: currentMetrics.revenue,
        transactions: currentMetrics.transactions,
        sessions: currentMetrics.sessions,
        conversionRate: currentMetrics.conversionRate,
        avgOrderValue: currentMetrics.avgOrderValue,
        engagementRate: currentMetrics.engagementRate,
        previousRevenue: previousMetrics.revenue,
        previousTransactions: previousMetrics.transactions,
        previousSessions: previousMetrics.sessions,
        previousConversionRate: previousMetrics.conversionRate,
      });

    } catch (err) {
      console.error('Error fetching analytics metrics:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch analytics'));
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [nodeId, enabled, dateRange]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
}

function aggregateAnalytics(data: any[]): {
  revenue: number;
  transactions: number;
  sessions: number;
  conversionRate: number;
  avgOrderValue: number;
  engagementRate: number;
} {
  if (!data || data.length === 0) {
    return {
      revenue: 0,
      transactions: 0,
      sessions: 0,
      conversionRate: 0,
      avgOrderValue: 0,
      engagementRate: 0,
    };
  }

  const totals = data.reduce(
    (acc, item) => ({
      revenue: acc.revenue + (item.total_revenue || 0),
      transactions: acc.transactions + (item.total_transactions || 0),
      sessions: acc.sessions + (item.total_sessions || 0),
      engagementSum: acc.engagementSum + ((item.avg_engagement_rate || 0) * (item.total_sessions || 0)),
      sessionsWithEngagement: acc.sessionsWithEngagement + (item.avg_engagement_rate > 0 ? item.total_sessions : 0),
    }),
    { revenue: 0, transactions: 0, sessions: 0, engagementSum: 0, sessionsWithEngagement: 0 }
  );

  return {
    revenue: totals.revenue,
    transactions: totals.transactions,
    sessions: totals.sessions,
    conversionRate: totals.sessions > 0 ? totals.transactions / totals.sessions : 0,
    avgOrderValue: totals.transactions > 0 ? totals.revenue / totals.transactions : 0,
    engagementRate: totals.sessionsWithEngagement > 0
      ? totals.engagementSum / totals.sessionsWithEngagement
      : 0,
  };
}

/**
 * Hook for fetching aggregated analytics for multiple nodes
 */
export function useAggregatedAnalyticsMetrics(
  nodeIds: string[],
  options: { enabled?: boolean; dateRange?: number } = {}
): {
  metrics: Map<string, AnalyticsMetrics>;
  loading: boolean;
  error: Error | null;
} {
  const [metrics, setMetrics] = useState<Map<string, AnalyticsMetrics>>(new Map());
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
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];

        const { data, error: fetchError } = await supabase
          .from('aggregated_analytics_metrics')
          .select('*')
          .in('node_id', nodeIds)
          .gte('date', startDate)
          .lte('date', endDate);

        if (fetchError) {
          throw fetchError;
        }

        // Process data into metrics map
        const metricsMap = new Map<string, AnalyticsMetrics>();

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
            const currentMetrics = aggregateAnalytics(nodeData.slice(0, Math.ceil(nodeData.length / 2)));
            const previousMetrics = aggregateAnalytics(nodeData.slice(Math.ceil(nodeData.length / 2)));

            metricsMap.set(nodeId, {
              revenue: currentMetrics.revenue,
              transactions: currentMetrics.transactions,
              sessions: currentMetrics.sessions,
              conversionRate: currentMetrics.conversionRate,
              avgOrderValue: currentMetrics.avgOrderValue,
              engagementRate: currentMetrics.engagementRate,
              previousRevenue: previousMetrics.revenue,
              previousTransactions: previousMetrics.transactions,
              previousSessions: previousMetrics.sessions,
              previousConversionRate: previousMetrics.conversionRate,
            });
          }
        }

        setMetrics(metricsMap);

      } catch (err) {
        console.error('Error fetching aggregated analytics:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch aggregated analytics'));
      } finally {
        setLoading(false);
      }
    };

    fetchAllMetrics();
  }, [nodeIds.join(','), enabled, dateRange]);

  return { metrics, loading, error };
}

/**
 * Hook for triggering GA4 sync
 */
export function useGA4Sync() {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const syncData = async (options: {
    dateRange?: number;
    propertyId?: string;
    forceRefresh?: boolean;
  } = {}) => {
    setSyncing(true);
    setError(null);

    try {
      const response = await fetch('/api/metrics/ga4/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync GA4 data');
      }

      const result = await response.json();
      return result;

    } catch (err) {
      console.error('Error syncing GA4 data:', err);
      setError(err instanceof Error ? err : new Error('Failed to sync GA4 data'));
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