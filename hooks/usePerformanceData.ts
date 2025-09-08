import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface PerformanceData {
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  performanceScore?: number;
  lastSyncedAt?: string;
}

interface UsePerformanceDataOptions {
  autoSync?: boolean;
  syncInterval?: number; // in milliseconds
}

export function usePerformanceData(options: UsePerformanceDataOptions = {}) {
  const { autoSync = false, syncInterval = 3600000 } = options; // Default 1 hour
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if Google account is connected
  const checkGoogleConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/google/status');
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.connected && data.scopes?.includes('https://www.googleapis.com/auth/content');
    } catch {
      return false;
    }
  }, []);

  // Sync performance data from Google Merchant Center
  const syncPerformanceData = useCallback(async () => {
    setSyncing(true);
    setError(null);
    
    try {
      // Check connection first
      const isConnected = await checkGoogleConnection();
      if (!isConnected) {
        toast({
          title: 'Google Account Not Connected',
          description: 'Please connect your Google Merchant account to sync performance data.',
          variant: 'destructive',
        });
        return false;
      }

      // Trigger performance sync
      const response = await fetch('/api/integrations/google/merchant/performance', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync performance data');
      }

      const result = await response.json();
      
      toast({
        title: 'Performance Data Synced',
        description: `Updated ${result.stats.productsEnriched} products and ${result.stats.categoriesUpdated} categories`,
      });

      setLastSync(new Date());
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync performance data';
      setError(message);
      
      toast({
        title: 'Sync Failed',
        description: message,
        variant: 'destructive',
      });
      
      return false;
    } finally {
      setSyncing(false);
    }
  }, [checkGoogleConnection, toast]);

  // Get performance data for a specific entity
  const getPerformanceData = useCallback(async (
    entityType: 'product' | 'category',
    entityId: string
  ): Promise<PerformanceData | null> => {
    try {
      const response = await fetch(
        `/api/performance/${entityType}/${entityId}`
      );
      
      if (!response.ok) return null;
      
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  // Get aggregated performance for multiple entities
  const getAggregatedPerformance = useCallback(async (
    entityIds: string[]
  ): Promise<PerformanceData | null> => {
    try {
      const response = await fetch('/api/performance/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: entityIds }),
      });
      
      if (!response.ok) return null;
      
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  // Auto-sync if enabled
  useEffect(() => {
    if (!autoSync) return;

    // Initial sync
    syncPerformanceData();

    // Set up interval
    const interval = setInterval(() => {
      syncPerformanceData();
    }, syncInterval);

    return () => clearInterval(interval);
  }, [autoSync, syncInterval, syncPerformanceData]);

  return {
    loading,
    syncing,
    error,
    lastSync,
    syncPerformanceData,
    getPerformanceData,
    getAggregatedPerformance,
    checkGoogleConnection,
  };
}

/**
 * Hook to get performance insights and recommendations
 */
export function usePerformanceInsights(metrics: PerformanceData) {
  const getInsights = useCallback(() => {
    const insights = [];

    // CTR Analysis
    if (metrics.impressions > 100) {
      if (metrics.ctr < 1) {
        insights.push({
          type: 'critical',
          category: 'ctr',
          title: 'Very Low Click-Through Rate',
          description: 'Your CTR is significantly below industry average (2-3%)',
          action: 'Update product titles and descriptions to be more compelling',
          potentialImpact: 'Could increase traffic by 100-200%',
        });
      } else if (metrics.ctr < 2) {
        insights.push({
          type: 'warning',
          category: 'ctr',
          title: 'Below Average CTR',
          description: 'Your CTR could be improved',
          action: 'A/B test different titles and highlight key benefits',
          potentialImpact: 'Could increase traffic by 50%',
        });
      }
    }

    // Conversion Rate Analysis
    if (metrics.clicks > 50) {
      if (metrics.conversionRate < 0.5) {
        insights.push({
          type: 'critical',
          category: 'conversion',
          title: 'Poor Conversion Rate',
          description: 'Visitors are not converting to customers',
          action: 'Review pricing, shipping costs, and product descriptions',
          potentialImpact: 'Could double your revenue',
        });
      } else if (metrics.conversionRate < 2) {
        insights.push({
          type: 'warning',
          category: 'conversion',
          title: 'Conversion Rate Opportunity',
          description: 'Room for improvement in conversion',
          action: 'Add customer reviews and trust signals',
          potentialImpact: 'Could increase revenue by 30%',
        });
      }
    }

    // Revenue per Click Analysis
    const revenuePerClick = metrics.clicks > 0 ? metrics.revenue / metrics.clicks : 0;
    if (revenuePerClick < 1 && metrics.clicks > 100) {
      insights.push({
        type: 'info',
        category: 'revenue',
        title: 'Low Revenue per Click',
        description: 'Consider focusing on higher-value products',
        action: 'Promote premium products or bundles',
        potentialImpact: 'Could increase average order value by 40%',
      });
    }

    return insights;
  }, [metrics]);

  const getOpportunityScore = useCallback(() => {
    let score = 0;
    
    // CTR opportunity (0-40 points)
    if (metrics.impressions > 100) {
      const ctrGap = Math.max(0, 3 - metrics.ctr); // Assume 3% is good
      score += Math.min(40, ctrGap * 10);
    }
    
    // Conversion opportunity (0-40 points)
    if (metrics.clicks > 50) {
      const convGap = Math.max(0, 2 - metrics.conversionRate); // Assume 2% is good
      score += Math.min(40, convGap * 20);
    }
    
    // Scale opportunity (0-20 points)
    if (metrics.impressions < 1000) {
      score += 20; // High opportunity to scale
    } else if (metrics.impressions < 10000) {
      score += 10;
    }
    
    return Math.min(100, score);
  }, [metrics]);

  return {
    insights: getInsights(),
    opportunityScore: getOpportunityScore(),
  };
}