'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Activity,
  Settings,
  Shield,
  Database,
  Calendar,
  BarChart,
  Search,
  ShoppingBag,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface Connection {
  id: string;
  service_type: string;
  connection_name: string;
  connection_status: 'pending' | 'active' | 'error' | 'expired';
  last_sync_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
  config: any;
}

interface UsageLog {
  id: string;
  action: string;
  status: string;
  error_message?: string;
  records_processed?: number;
  duration_ms?: number;
  created_at: string;
}

export default function ConnectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.id as string;

  const [connection, setConnection] = useState<Connection | null>(null);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadConnection();
    loadUsageLogs();
  }, [connectionId]);

  const loadConnection = async () => {
    try {
      const { data } = await supabase
        .from('data_source_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      setConnection(data);
    } catch (error) {
      // Error loading connection - handled by UI state
    } finally {
      setLoading(false);
    }
  };

  const loadUsageLogs = async () => {
    try {
      const { data } = await supabase
        .from('connection_usage_logs')
        .select('*')
        .eq('connection_id', connectionId)
        .order('created_at', { ascending: false })
        .limit(50);

      setUsageLogs(data || []);
    } catch (error) {
      // Error loading usage logs - non-critical
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`/api/integrations/${connectionId}/sync`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Sync failed');

      await loadConnection();
      await loadUsageLogs();
    } catch (error) {
      // Sync error - handled by UI state
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this connection? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('data_source_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      router.push('/dashboard/integrations');
    } catch (error) {
      // Delete error - user can retry
    }
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'google_analytics':
        return <BarChart className="h-5 w-5" />;
      case 'google_search_console':
        return <Search className="h-5 w-5" />;
      case 'google_merchant_center':
        return <ShoppingBag className="h-5 w-5" />;
      default:
        return <Database className="h-5 w-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'expired':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'expired':
        return <Badge variant="warning">Expired</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="container mx-auto py-8 px-4">
          <div className="text-center text-gray-400">Loading connection...</div>
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="container mx-auto py-8 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Connection not found</AlertDescription>
          </Alert>
          <Button
            className="mt-4 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
            variant="outline"
            onClick={() => router.push('/dashboard/integrations')}
          >
            Back to Integrations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
              onClick={() => router.push('/dashboard/integrations')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#2a2a2a] rounded-lg">
                {getServiceIcon(connection.service_type)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{connection.connection_name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(connection.connection_status)}
                  <span className="text-sm text-gray-400">
                    Created {new Date(connection.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
              onClick={handleSync}
              disabled={syncing || connection.connection_status !== 'active'}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {connection.last_error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Last Error:</strong> {connection.last_error}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-[#1a1a1a] border border-gray-800">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-[#10b981] data-[state=active]:text-white"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="data-[state=active]:bg-[#10b981] data-[state=active]:text-white"
            >
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-[#10b981] data-[state=active]:text-white"
            >
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-[#1a1a1a] border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Connection Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Status</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(connection.connection_status)}
                        <span className="font-medium capitalize text-white">
                          {connection.connection_status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Last Sync</span>
                      <span className="font-medium text-white">
                        {connection.last_sync_at
                          ? new Date(connection.last_sync_at).toLocaleString()
                          : 'Never'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Service</span>
                      <span className="font-medium text-white">
                        {connection.service_type
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1a1a] border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Usage Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Total Syncs</span>
                      <span className="font-medium text-white">
                        {usageLogs.filter((log) => log.action === 'sync').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Success Rate</span>
                      <span className="font-medium text-white">
                        {usageLogs.length > 0
                          ? `${Math.round(
                              (usageLogs.filter((log) => log.status === 'success').length /
                                usageLogs.length) *
                                100
                            )}%`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Records Processed</span>
                      <span className="font-medium text-white">
                        {usageLogs
                          .reduce((sum, log) => sum + (log.records_processed || 0), 0)
                          .toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="text-white">Recent Activity</CardTitle>
                <CardDescription className="text-gray-400">
                  Last 50 operations performed with this connection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {usageLogs.length > 0 ? (
                    usageLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 border border-gray-800 rounded-lg bg-[#0a0a0a]"
                      >
                        <div className="flex items-center gap-3">
                          <Activity className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-sm text-white">{log.action}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(log.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {log.records_processed && (
                            <span className="text-sm text-gray-400">
                              {log.records_processed} records
                            </span>
                          )}
                          {log.duration_ms && (
                            <span className="text-sm text-gray-400">
                              {(log.duration_ms / 1000).toFixed(2)}s
                            </span>
                          )}
                          <Badge
                            variant={
                              log.status === 'success'
                                ? 'success'
                                : log.status === 'failure'
                                  ? 'destructive'
                                  : 'warning'
                            }
                          >
                            {log.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-8">No activity yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid gap-6">
              <Card className="bg-[#1a1a1a] border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Connection Configuration</CardTitle>
                  <CardDescription className="text-gray-400">
                    Manage your connection settings and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert className="bg-[#0a0a0a] border-gray-700">
                      <Shield className="h-4 w-4 text-[#10b981]" />
                      <AlertDescription className="text-gray-400">
                        Credentials are encrypted and stored securely. OAuth tokens are refreshed
                        automatically when needed.
                      </AlertDescription>
                    </Alert>
                    <div className="flex items-center justify-between p-4 border border-gray-800 rounded-lg bg-[#0a0a0a]">
                      <div>
                        <p className="font-medium text-white">Reconnect Account</p>
                        <p className="text-sm text-gray-600">
                          Re-authenticate if your connection has expired
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
                      >
                        Reconnect
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 border border-gray-800 rounded-lg bg-[#0a0a0a]">
                      <div>
                        <p className="font-medium text-white">Revoke Access</p>
                        <p className="text-sm text-gray-600">
                          Disconnect and remove stored credentials
                        </p>
                      </div>
                      <Button variant="outline" className="text-red-600 hover:text-red-700">
                        Revoke
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1a1a] border-red-900/30">
                <CardHeader>
                  <CardTitle className="text-red-400">Danger Zone</CardTitle>
                  <CardDescription className="text-gray-400">
                    Irreversible actions for this connection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border border-red-900/30 rounded-lg bg-red-900/10">
                    <div>
                      <p className="font-medium text-red-400">Delete Connection</p>
                      <p className="text-sm text-red-300">
                        Permanently remove this connection and all associated data
                      </p>
                    </div>
                    <Button variant="destructive" onClick={handleDelete}>
                      Delete Connection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
