'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/Table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/DropdownMenu';
import useImportHistory from '@/hooks/useImportHistory';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MoreHorizontal, 
  Eye, 
  RefreshCw, 
  Trash2,
  Download,
  Loader2
} from 'lucide-react';

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

export default function ImportHistory() {
  const { imports, loading, error, refreshImports, deleteImport, retryImport } = useImportHistory();
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set());

  const handleAction = async (action: () => Promise<void>, importId: string) => {
    setProcessingActions(prev => new Set([...prev, importId]));
    try {
      await action();
    } finally {
      setProcessingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(importId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: ImportHistoryItem['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800">Running</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: ImportHistoryItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'cancelled':
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleViewDetails = (importItem: ImportHistoryItem) => {
    window.open(`/import/${importItem.id}/details`, '_blank');
  };

  const handleDownloadReport = (importItem: ImportHistoryItem) => {
    const link = document.createElement('a');
    link.href = `/api/import/${importItem.id}/report`;
    link.download = `import-report-${importItem.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={refreshImports} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (!imports || imports.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-900 mb-2">No Import History</p>
        <p className="text-gray-600">
          Start your first import to see the history here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {imports.length} import{imports.length !== 1 ? 's' : ''} found
        </p>
        <Button onClick={refreshImports} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>URLs</TableHead>
              <TableHead>Success Rate</TableHead>
              <TableHead>Sitemap</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {imports.map((importItem) => (
              <TableRow key={importItem.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(importItem.status)}
                    {getStatusBadge(importItem.status)}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm">{formatDate(importItem.startedAt)}</p>
                    <p className="text-xs text-gray-500">
                      by {importItem.triggeredBy}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm">
                    {importItem.completedAt
                      ? formatDuration(
                          Math.floor(
                            (new Date(importItem.completedAt).getTime() - 
                             new Date(importItem.startedAt).getTime()) / 1000
                          )
                        )
                      : formatDuration(importItem.duration)
                    }
                  </p>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p>{importItem.totalUrls.toLocaleString()} total</p>
                    {importItem.status === 'completed' && (
                      <p className="text-xs text-gray-500">
                        {importItem.successfulUrls}/{importItem.totalUrls}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {importItem.status === 'completed' ? (
                    <div className="text-sm">
                      <p className={`font-medium ${
                        (importItem.successfulUrls / importItem.totalUrls) * 100 >= 95 
                          ? 'text-green-600' 
                          : (importItem.successfulUrls / importItem.totalUrls) * 100 >= 80
                          ? 'text-orange-600'
                          : 'text-red-600'
                      }`}>
                        {((importItem.successfulUrls / importItem.totalUrls) * 100).toFixed(1)}%
                      </p>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <p className="text-sm truncate max-w-48" title={importItem.sitemapUrl}>
                    {importItem.sitemapUrl}
                  </p>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleViewDetails(importItem)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      
                      {importItem.status === 'completed' && (
                        <DropdownMenuItem
                          onClick={() => handleDownloadReport(importItem)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Report
                        </DropdownMenuItem>
                      )}
                      
                      {(importItem.status === 'failed' || importItem.status === 'cancelled') && (
                        <DropdownMenuItem
                          onClick={() => handleAction(
                            () => retryImport(importItem.id), 
                            importItem.id
                          )}
                          disabled={processingActions.has(importItem.id)}
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${
                            processingActions.has(importItem.id) ? 'animate-spin' : ''
                          }`} />
                          Retry Import
                        </DropdownMenuItem>
                      )}
                      
                      {importItem.status !== 'running' && (
                        <DropdownMenuItem
                          onClick={() => handleAction(
                            () => deleteImport(importItem.id), 
                            importItem.id
                          )}
                          disabled={processingActions.has(importItem.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-gray-500 text-center">
        Import data is automatically cleaned up after 30 days
      </div>
    </div>
  );
}