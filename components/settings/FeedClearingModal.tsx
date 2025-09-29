'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  X,
  Database,
  Package,
  FolderTree,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/external/supabase/client';
import { toast } from 'sonner';

interface FeedClearingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  feedName?: string;
  feedId?: string;
}

export function FeedClearingModal({
  isOpen,
  onClose,
  onComplete,
  feedName = 'All Feeds',
  feedId,
}: FeedClearingModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [clearingProgress, setClearingProgress] = useState<string>('');
  const supabase = createClient();

  const CONFIRM_PHRASE = 'DELETE ALL DATA';

  const handleClearFeed = async () => {
    if (confirmText !== CONFIRM_PHRASE) {
      toast.error('Please type the confirmation phrase exactly');
      return;
    }

    setIsClearing(true);
    setClearingProgress('Starting data deletion...');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Clear data in order to maintain referential integrity
      // Note: product_categories is a junction table without user_id, so handle it differently

      // First, delete from junction table (references products)
      setClearingProgress('Deleting product category relationships...');
      const { data: userProducts } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', user.id);

      if (userProducts && userProducts.length > 0) {
        const productIds = userProducts.map((p) => p.id);
        const { error: catError } = await supabase
          .from('product_categories')
          .delete()
          .in('product_id', productIds);

        if (catError && catError.code !== 'PGRST116') {
          console.error('Error clearing product categories:', catError);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Now delete the main tables and any related import history
      const steps = [
        { name: 'products', table: 'products' },
        { name: 'taxonomy nodes', table: 'taxonomy_nodes' },
        { name: 'import history', table: 'import_history' },
        { name: 'import progress', table: 'import_progress' },
        { name: 'sync history', table: 'sync_history' },
        // Tables that might exist but not critical
        { name: 'scraped content', table: 'scraped_content', optional: true },
        { name: 'node metrics', table: 'node_metrics', optional: true },
        { name: 'performance history', table: 'performance_history', optional: true },
      ];

      for (const step of steps) {
        setClearingProgress(`Deleting ${step.name}...`);

        try {
          // Delete data based on user_id
          const { error } = await supabase.from(step.table).delete().eq('user_id', user.id);

          if (error) {
            // Check if it's a "no rows" error (PGRST116) or table doesn't exist
            const isNoRowsError = error.code === 'PGRST116';
            const isTableMissing =
              error.message?.includes('relation') ||
              error.message?.includes('does not exist') ||
              error.code === '42P01';

            if (!isNoRowsError && !isTableMissing) {
              // This is a real error, but only throw if it's not an optional table
              if (!step.optional) {
                console.error(`Error clearing ${step.name}:`, error);
                throw new Error(`Failed to clear ${step.name}`);
              } else {
                console.warn(
                  `Warning: Could not clear optional table ${step.name}:`,
                  error.message
                );
              }
            } else if (isTableMissing && !step.optional) {
              console.warn(`Table ${step.table} doesn't exist, skipping...`);
            }
          }
        } catch (error) {
          // If it's an optional table, just log and continue
          if (step.optional) {
            console.warn(`Optional table ${step.name} could not be cleared:`, error);
          } else {
            throw error;
          }
        }

        // Small delay to show progress
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // If a specific feed ID was provided, also try to remove the connection record
      if (feedId && feedId !== 'imported-feed') {
        setClearingProgress('Removing feed connection...');
        try {
          const { error } = await supabase
            .from('data_source_connections')
            .delete()
            .eq('id', feedId);

          if (error && error.code !== 'PGRST116' && !error.message?.includes('does not exist')) {
            console.error('Error removing feed connection:', error);
          }
        } catch (error) {
          console.error('Warning: Could not remove feed connection:', error);
        }
      }

      setClearingProgress('Complete!');
      toast.success('All feed data has been cleared successfully');

      // Call onComplete immediately to update UI
      onComplete();

      // Wait a moment before closing modal
      setTimeout(() => {
        onClose();
        setConfirmText('');
        setClearingProgress('');
      }, 1000);
    } catch (error) {
      console.error('Error clearing feed data:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to clear feed data');
      setClearingProgress('');
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={!isClearing ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-[#1a1a1a] border border-red-500/30 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Close button */}
        {!isClearing && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#666] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-red-500/20 rounded-full">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-white text-center mb-2">Clear Feed Data</h2>

        <p className="text-[#999] text-center mb-6">
          {feedName !== 'All Feeds'
            ? `Clear data for "${feedName}"`
            : 'Clear all imported feed data'}
        </p>

        {/* Warning Box */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-400">
                ⚠️ This action is IRREVERSIBLE and will permanently delete:
              </p>
              <ul className="space-y-1 text-sm text-red-300">
                <li className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  All imported products
                </li>
                <li className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4" />
                  All taxonomy/category data
                </li>
                <li className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  All performance metrics and analytics
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Confirmation Input */}
        <div className="space-y-2 mb-6">
          <label className="text-sm text-[#999]">
            Type <span className="font-mono text-red-400">{CONFIRM_PHRASE}</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isClearing}
            placeholder="Type confirmation phrase"
            className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md text-white placeholder-[#666] focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
          />
        </div>

        {/* Progress Message */}
        {clearingProgress && (
          <div className="mb-4 p-3 bg-[#0a0a0a] rounded-md">
            <div className="flex items-center gap-2 text-sm text-[#999]">
              <Loader2 className="h-4 w-4 animate-spin" />
              {clearingProgress}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isClearing}
            className="flex-1 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleClearFeed}
            disabled={isClearing || confirmText !== CONFIRM_PHRASE}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
          >
            {isClearing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Clear All Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
