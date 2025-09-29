'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  CheckCircle,
  AlertCircle,
  PauseCircle,
  Plus,
  RefreshCw,
  Trash2,
  Loader2,
  Clock,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { createClient } from '@/lib/external/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { FeedClearingModal } from '@/components/settings/FeedClearingModal';

interface DataSource {
  id: string;
  workspace_id: string;
  name: string;
  type: 'google_merchant' | 'shopify' | 'api' | 'csv' | 'manual';
  config: Record<string, unknown>;
  status: 'active' | 'paused' | 'error' | 'disconnected';
  last_sync_at: string | null;
  next_sync_at: string | null;
  items_synced: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}

const statusConfig = {
  active: { color: 'text-green-500', bg: 'bg-green-500/10', icon: CheckCircle, label: 'Active' },
  paused: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: PauseCircle, label: 'Paused' },
  error: { color: 'text-red-500', bg: 'bg-red-500/10', icon: AlertCircle, label: 'Error' },
  disconnected: {
    color: 'text-gray-500',
    bg: 'bg-gray-500/10',
    icon: Database,
    label: 'Disconnected',
  },
};

export function DataSourcesTab() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedSourceForClear, setSelectedSourceForClear] = useState<DataSource | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const loadDataSources = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.warn('No user found');
        return;
      }
      console.info('Loading data sources for user:', user.id);

      // OPTIMIZATION: Remove expensive count queries
      // Instead, just check if any data exists with limit 1
      const { data: hasProducts } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const { data: hasTaxonomy } = await supabase
        .from('taxonomy_nodes')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const productsCount = hasProducts && hasProducts.length > 0 ? 1 : 0;
      const taxonomyCount = hasTaxonomy && hasTaxonomy.length > 0 ? 1 : 0;

      console.info('Has products:', productsCount > 0, 'Has taxonomy:', taxonomyCount > 0);

      // If we have data, create a mock data source for display
      if ((productsCount || 0) > 0 || (taxonomyCount || 0) > 0) {
        // Get the most recent import from import_history if available
        const { data: importHistory } = await supabase
          .from('import_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const mockDataSource: DataSource = {
          id: 'imported-feed',
          workspace_id: user.id,
          name: 'Imported Product Feed',
          type: 'google_merchant',
          config: {},
          status: 'active',
          last_sync_at: importHistory?.[0]?.completed_at || importHistory?.[0]?.created_at || null,
          next_sync_at: null,
          items_synced: productsCount || 0,
          error_message: null,
          created_at: importHistory?.[0]?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: user.id,
        };

        console.info('Creating mock data source:', mockDataSource);
        setDataSources([mockDataSource]);
      } else {
        console.info('No data found, showing empty state');
        setDataSources([]);
      }
    } catch (error) {
      console.error('Error loading data sources:', error);
      toast.error('Failed to load data sources');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDataSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleStatus = async (source: DataSource) => {
    setIsUpdating(source.id);
    const newStatus = source.status === 'active' ? 'paused' : 'active';

    try {
      // For mock data sources, just update the state
      setDataSources((prev) =>
        prev.map((ds) => (ds.id === source.id ? { ...ds, status: newStatus } : ds))
      );

      toast.success(`Data source ${newStatus === 'active' ? 'resumed' : 'paused'}`);
    } catch (error) {
      console.error('Error updating data source:', error);
      toast.error('Failed to update data source');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDelete = async (sourceId: string) => {
    try {
      // Since we're using mock data sources, just remove from state
      // In a real implementation, this would disconnect the actual feed
      setDataSources((prev) => prev.filter((ds) => ds.id !== sourceId));
      setShowDeleteConfirm(null);
      toast.success('Data source disconnected');
    } catch (error) {
      console.error('Error deleting data source:', error);
      toast.error('Failed to disconnect data source');
    }
  };

  const handleManualSync = async (source: DataSource) => {
    setIsUpdating(source.id);
    try {
      // For mock implementation, just update the UI
      setDataSources((prev) =>
        prev.map((ds) =>
          ds.id === source.id ? { ...ds, last_sync_at: new Date().toISOString() } : ds
        )
      );

      toast.success('Sync initiated successfully');

      // In a real implementation, this would trigger an actual import
      // You could redirect to the import page or trigger an API call
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast.error('Failed to trigger sync');
    } finally {
      setIsUpdating(null);
    }
  };

  // Memoize date formatting function to prevent recalculation
  const formatDate = useCallback((dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    return date.toLocaleDateString();
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#666]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Data Sources</h2>
          <p className="text-[#999] text-sm mt-1">Manage your imported product feeds and data</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Clear All Data Button - Only show if there are data sources */}
          {dataSources.length > 0 && (
            <button
              onClick={() => {
                setSelectedSourceForClear(null);
                setShowClearModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30"
              title="Clear all imported data"
            >
              <AlertTriangle className="h-4 w-4" />
              Clear All Data
            </button>
          )}
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm bg-[#10a37f] hover:bg-[#0e8a65] text-white">
            <Plus className="h-4 w-4" />
            Add Data Source
          </button>
        </div>
      </div>

      {/* Data Sources Grid */}
      {dataSources.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dataSources.map((source) => {
            const status = statusConfig[source.status];
            const StatusIcon = status.icon;

            return (
              <div
                key={source.id}
                className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-[#666]" />
                    <div>
                      <h3 className="font-medium text-white">{source.name}</h3>
                      <p className="text-sm text-[#999] capitalize">
                        {source.type.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color} mb-4`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {status.label}
                </div>

                {/* Stats */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#999]">Last Sync:</span>
                    <span className="text-white">{formatDate(source.last_sync_at)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#999]">Items Synced:</span>
                    <span className="text-white flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-[#10a37f]" />
                      {source.items_synced.toLocaleString()}
                    </span>
                  </div>
                  {source.next_sync_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#999]">Next Sync:</span>
                      <span className="text-white flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[#666]" />
                        {formatDate(source.next_sync_at)}
                      </span>
                    </div>
                  )}
                  {source.status === 'error' && source.error_message && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                      {source.error_message}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {/* Primary Actions Row */}
                  <div className="flex gap-2">
                    {source.status !== 'disconnected' && (
                      <button
                        onClick={() => handleToggleStatus(source)}
                        disabled={isUpdating === source.id}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded transition-colors font-medium text-xs bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 text-white"
                      >
                        {isUpdating === source.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : source.status === 'active' ? (
                          <>
                            <PauseCircle className="h-3.5 w-3.5" />
                            Pause
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3.5 w-3.5" />
                            Resume
                          </>
                        )}
                      </button>
                    )}
                    {source.type !== 'manual' && source.status === 'active' && (
                      <button
                        onClick={() => handleManualSync(source)}
                        disabled={isUpdating === source.id}
                        className="flex items-center justify-center p-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 text-white rounded transition-colors"
                        title="Manual sync"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Danger Zone Actions */}
                  <div className="flex gap-2 pt-2 border-t border-[#2a2a2a]">
                    <button
                      onClick={() => {
                        setSelectedSourceForClear(source);
                        setShowClearModal(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded transition-colors font-medium text-xs bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/30"
                      title="Clear all data for this feed"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Clear Data
                    </button>
                    {showDeleteConfirm === source.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(source.id)}
                          className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded text-xs transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded text-xs transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(source.id)}
                        className="flex items-center justify-center p-1.5 bg-[#2a2a2a] hover:bg-red-500/20 hover:text-red-500 text-white rounded transition-colors"
                        title="Disconnect feed"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Empty State */}
      {dataSources.length === 0 && (
        <div className="text-center py-12">
          <Database className="h-12 w-12 text-[#666] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No data sources connected</h3>
          <p className="text-[#999] mb-6">Connect a data source to start importing your products</p>
          <button
            onClick={() => router.push('/dashboard/import')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#10a37f] hover:bg-[#0e8a65] text-white rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Your First Data Source
          </button>
        </div>
      )}

      {/* Feed Clearing Modal */}
      <FeedClearingModal
        isOpen={showClearModal}
        onClose={() => {
          setShowClearModal(false);
          setSelectedSourceForClear(null);
        }}
        onComplete={() => {
          // Immediately remove the data source from state for instant UI update
          setDataSources((prev) => prev.filter((ds) => ds.id !== selectedSourceForClear?.id));
          toast.success('Data source and all associated data cleared successfully');
          setSelectedSourceForClear(null);
          // Reload in background to ensure consistency
          setTimeout(() => loadDataSources(), 500);
        }}
        feedName={selectedSourceForClear?.name}
        feedId={selectedSourceForClear?.id}
      />
    </div>
  );
}
