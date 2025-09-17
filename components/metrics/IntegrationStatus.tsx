'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  BarChart,
  Link2,
  Target,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface IntegrationStats {
  lastSync: string | null;
  totalMatched: number;
  totalUnmatched: number;
  avgConfidence: number;
  topUnmatched: any[];
}

interface SyncStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  avgProcessingTime: number;
  lastSync: string | null;
}

export function IntegrationStatus() {
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Load integration status
      const integrationResponse = await fetch('/api/metrics/integrate');
      const integrationData = await integrationResponse.json();
      setStats(integrationData);

      // Load sync history
      const syncResponse = await fetch('/api/metrics/sync');
      const syncData = await syncResponse.json();
      setSyncStats(syncData.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const runIntegration = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/metrics/integrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Integration complete! Matched ${result.stats.matched} metrics`);
        await loadStats();
      } else {
        toast.error(`Integration failed: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Integration error:', error);
      toast.error('Failed to run integration');
    } finally {
      setSyncing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-[#10a37f]';
    if (confidence >= 0.7) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'High';
    if (confidence >= 0.7) return 'Medium';
    return 'Low';
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-[#2a2a2a] rounded-lg mb-4"></div>
        <div className="h-48 bg-[#2a2a2a] rounded-lg"></div>
      </div>
    );
  }

  const matchRate = stats
    ? (stats.totalMatched / (stats.totalMatched + stats.totalUnmatched)) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{stats?.totalMatched || 0}</div>
                <div className="text-sm text-[#666]">Matched Metrics</div>
              </div>
              <CheckCircle className="h-8 w-8 text-[#10a37f]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{stats?.totalUnmatched || 0}</div>
                <div className="text-sm text-[#666]">Unmatched</div>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div
                  className={`text-2xl font-bold ${getConfidenceColor(stats?.avgConfidence || 0)}`}
                >
                  {((stats?.avgConfidence || 0) * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-[#666]">Avg Confidence</div>
              </div>
              <Target className="h-8 w-8 text-[#999]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">
                  {syncStats?.successfulSyncs || 0}
                </div>
                <div className="text-sm text-[#666]">Successful Syncs</div>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Status Card */}
      <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Integration Status</CardTitle>
              <CardDescription className="text-[#999]">
                Metrics matching and aggregation overview
              </CardDescription>
            </div>
            <Button
              onClick={runIntegration}
              disabled={syncing}
              className="bg-[#10a37f] hover:bg-[#0d8d6c] text-white border-0"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Run Integration
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Match Rate */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#999]">Match Rate</span>
              <span className="text-white font-medium">{matchRate.toFixed(1)}%</span>
            </div>
            <Progress value={matchRate} className="h-2 bg-[#2a2a2a]" />
          </div>

          {/* Last Sync Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-[#666]" />
              <div>
                <div className="text-xs text-[#666]">Last Sync</div>
                <div className="text-sm text-white">
                  {stats?.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BarChart className="h-5 w-5 text-[#666]" />
              <div>
                <div className="text-xs text-[#666]">Avg Processing</div>
                <div className="text-sm text-white">
                  {((syncStats?.avgProcessingTime || 0) / 1000).toFixed(2)}s
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-[#666]" />
              <div>
                <div className="text-xs text-[#666]">Success Rate</div>
                <div className="text-sm text-white">
                  {syncStats && syncStats.totalSyncs > 0
                    ? ((syncStats.successfulSyncs / syncStats.totalSyncs) * 100).toFixed(0)
                    : 0}
                  %
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-[#2a2a2a] text-[#999] hover:text-white hover:border-[#333]"
              onClick={() => router.push('/dashboard/metrics/mappings')}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Review Unmatched ({stats?.totalUnmatched || 0})
            </Button>
            <Button
              variant="outline"
              className="border-[#2a2a2a] text-[#999] hover:text-white hover:border-[#333]"
              onClick={loadStats}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Stats
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Top Unmatched Items */}
      {stats?.topUnmatched && stats.topUnmatched.length > 0 && (
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="text-white">Top Unmatched Items</CardTitle>
            <CardDescription className="text-[#999]">
              Items that failed to match and need manual review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topUnmatched.slice(0, 5).map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border-[#2a2a2a] text-[#666]">
                      {item.source.toUpperCase()}
                    </Badge>
                    <span className="text-sm text-white font-mono truncate max-w-[400px]">
                      {item.identifier}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#666]">{item.match_attempts} attempts</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[#10a37f] hover:text-[#0d8d6c]"
                      onClick={() => router.push('/dashboard/metrics/mappings')}
                    >
                      Map
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
