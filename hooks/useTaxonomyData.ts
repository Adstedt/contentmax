'use client';

import useSWR from 'swr';
import type { TaxonomyNode, TaxonomyLink } from '@/components/taxonomy/D3Visualization';

interface TaxonomyData {
  nodes: TaxonomyNode[];
  links: TaxonomyLink[];
}

interface UseTaxonomyDataOptions {
  projectId?: string;
  fallbackData?: TaxonomyData;
  revalidateOnMount?: boolean;
}

// Fetcher function for SWR
const fetcher = async (url: string): Promise<TaxonomyData> => {
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      // No data found, return empty structure
      return { nodes: [], links: [] };
    }
    throw new Error(`Failed to fetch taxonomy data: ${response.statusText}`);
  }

  return response.json();
};

export function useTaxonomyData(options: UseTaxonomyDataOptions = {}) {
  const { projectId = '', fallbackData, revalidateOnMount = true } = options;

  const { data, error, isLoading, isValidating, mutate } = useSWR<TaxonomyData>(
    `/api/taxonomy/data?projectId=${projectId}`,
    fetcher,
    {
      // SWR Configuration optimized for performance
      revalidateOnFocus: false, // Don't refetch when tab gains focus
      revalidateOnReconnect: true, // Refetch when reconnecting to internet
      revalidateOnMount, // Control whether to fetch on mount
      dedupingInterval: 10 * 60 * 1000, // Cache for 10 minutes (increased)
      fallbackData, // Use previous data while loading
      keepPreviousData: true, // Keep showing old data while revalidating
      errorRetryCount: 2, // Retry failed requests twice
      errorRetryInterval: 5000, // Wait 5 seconds between retries

      // Performance optimizations
      revalidateIfStale: false, // Don't revalidate stale data automatically
      shouldRetryOnError: false, // Don't retry on error automatically

      // Smooth loading experience
      loadingTimeout: 3000, // Show loading after 3 seconds
      suspense: false, // Don't use React Suspense

      // Performance optimizations
      compare: (a, b) => {
        // Custom comparison to prevent unnecessary re-renders
        if (!a && !b) return true;
        if (!a || !b) return false;
        return a.nodes.length === b.nodes.length && a.links.length === b.links.length;
      },

      // Success/error callbacks
      onSuccess: (data) => {
        console.info(
          `Taxonomy data loaded: ${data.nodes.length} nodes, ${data.links.length} links`
        );
      },
      onError: (error) => {
        console.error('Failed to load taxonomy data:', error);
      },
    }
  );

  // Calculate if we have data (either fresh or cached)
  const hasData = data && data.nodes && data.nodes.length > 0;

  // Determine loading state more accurately
  const isInitialLoading = !data && isLoading;
  const isRefreshing = data && isValidating;

  return {
    data,
    error,
    isLoading: isInitialLoading,
    isRefreshing,
    isValidating,
    hasData,
    isEmpty: data && data.nodes.length === 0,
    mutate, // Function to manually update the cache

    // Helper functions
    refresh: () => mutate(),
    clearCache: () => mutate(undefined, false),
  };
}

// Prefetch function for navigation
export async function prefetchTaxonomyData(projectId?: string) {
  const url = `/api/taxonomy/data?projectId=${projectId || ''}`;

  try {
    const data = await fetcher(url);

    // Pre-populate the SWR cache
    if (typeof window !== 'undefined' && (window as any).swr) {
      (window as any).swr.cache.set(url, data);
    }

    return data;
  } catch (error) {
    console.error('Failed to prefetch taxonomy data:', error);
    return null;
  }
}

// Manual cache management utilities
export const taxonomyCache = {
  // Get cached data without triggering a fetch
  getCached: (projectId?: string) => {
    if (typeof window === 'undefined') return null;
    const key = `/api/taxonomy/data?projectId=${projectId || ''}`;
    return (window as any).swr?.cache?.get(key);
  },

  // Clear specific cache
  clear: (projectId?: string) => {
    if (typeof window === 'undefined') return;
    const key = `/api/taxonomy/data?projectId=${projectId || ''}`;
    (window as any).swr?.cache?.delete(key);
  },

  // Clear all taxonomy caches
  clearAll: () => {
    if (typeof window === 'undefined') return;
    const cache = (window as any).swr?.cache;
    if (!cache) return;

    // Clear all keys that match taxonomy API pattern
    for (const key of cache.keys()) {
      if (key.includes('/api/taxonomy/data')) {
        cache.delete(key);
      }
    }
  },
};
