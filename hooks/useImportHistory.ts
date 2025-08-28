import { useState, useEffect } from 'react';

interface ImportHistoryItem {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  totalUrls: number;
  successfulUrls: number;
  failedUrls: number;
  duration?: number;
  sitemapUrl: string;
  triggeredBy: string;
}

export default function useImportHistory() {
  const [imports, setImports] = useState<ImportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchImports = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/import/history');
      if (!response.ok) {
        throw new Error('Failed to fetch import history');
      }
      
      const data = await response.json();
      setImports(data.imports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const refreshImports = () => {
    fetchImports();
  };

  const deleteImport = async (importId: string) => {
    try {
      const response = await fetch(`/api/import/${importId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete import');
      }
      
      setImports(prev => prev.filter(imp => imp.id !== importId));
    } catch (err) {
      console.error('Failed to delete import:', err);
      throw err;
    }
  };

  const retryImport = async (importId: string) => {
    try {
      const response = await fetch(`/api/import/${importId}/retry`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to retry import');
      }
      
      const { newImportId } = await response.json();
      
      // Refresh the list to show the new import
      await refreshImports();
      
      return newImportId;
    } catch (err) {
      console.error('Failed to retry import:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchImports();
  }, []);

  return {
    imports,
    loading,
    error,
    refreshImports,
    deleteImport,
    retryImport,
  };
}