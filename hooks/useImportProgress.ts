import { useEffect, useState } from 'react';
import { createClient } from '@/lib/external/supabase/client';

export interface ImportProgress {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  overallProgress: number;
  currentStage: string;
  stage?: string; // Legacy field for compatibility
  percentage?: number; // Legacy field for compatibility
  message?: string;
  processed?: number;
  total?: number;
  estimatedTime?: number;
  stages: Array<{
    name: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    startTime?: string;
    endTime?: string;
  }>;
  metrics: {
    urlsDiscovered: number;
    pagesScraped: number;
    errorsEncountered: number;
    estimatedTimeRemaining: number;
  };
  recentActivity: Array<{
    timestamp: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
  }>;
  summary?: any;
  error?: string;
}

export default function useImportProgress(importId: string) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let pollInterval: NodeJS.Timeout;
    let subscription: any;

    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/import/${importId}/progress`);
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }
        
        const data = await response.json();
        setProgress(data);
        
        if (data.status === 'completed') {
          setIsComplete(true);
          if (pollInterval) {
            clearInterval(pollInterval);
          }
          if (subscription) {
            subscription.unsubscribe();
          }
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          setError(data.error || `Import ${data.status}`);
          if (pollInterval) {
            clearInterval(pollInterval);
          }
          if (subscription) {
            subscription.unsubscribe();
          }
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    const startPolling = () => {
      fetchProgress();
      pollInterval = setInterval(fetchProgress, 2000);
    };

    const setupRealtimeSubscription = () => {
      const channel = supabase
        .channel(`import:${importId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'import_jobs',
            filter: `id=eq.${importId}`,
          },
          (payload) => {
            const newProgress = payload.new as any;
            setProgress(prev => ({
              ...prev,
              ...newProgress,
              metrics: newProgress.metrics || prev?.metrics || {
                urlsDiscovered: 0,
                pagesScraped: 0,
                errorsEncountered: 0,
                estimatedTimeRemaining: 0,
              },
              stages: newProgress.stages || prev?.stages || [],
              recentActivity: newProgress.recent_activity || prev?.recentActivity || [],
            }));

            if (newProgress.status === 'completed') {
              setIsComplete(true);
            } else if (newProgress.status === 'failed' || newProgress.status === 'cancelled') {
              setError(newProgress.error || `Import ${newProgress.status}`);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to real-time updates for import:', importId);
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('Real-time subscription failed, falling back to polling');
            startPolling();
          }
        });

      subscription = channel;
    };

    if (importId) {
      fetchProgress();
      
      try {
        setupRealtimeSubscription();
      } catch (err) {
        console.warn('Real-time subscription setup failed, using polling fallback');
        startPolling();
      }

      const backupInterval = setTimeout(() => {
        if (!progress) {
          console.log('No progress received via real-time, starting polling backup');
          startPolling();
        }
      }, 5000);

      return () => {
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        if (subscription) {
          subscription.unsubscribe();
        }
        if (backupInterval) {
          clearTimeout(backupInterval);
        }
      };
    }
  }, [importId, progress]);

  return {
    progress,
    error,
    isComplete,
  };
}