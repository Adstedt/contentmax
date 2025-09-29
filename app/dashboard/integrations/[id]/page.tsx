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
import { createClient } from '@/lib/external/supabase/client';

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
      const supabase = createClient();
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
      const supabase = createClient();
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
      const supabase = createClient();
      const { error } = await supabase
        .from('data_source_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      router.push('/dashboard/settings?tab=integrations');
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
        return <Clock className="h-5 w-5 text-[#666]" />;
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
          <div className="text-center text-[#666]">Loading connection...</div>
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
            className="mt-4 border-[#2a2a2a] text-[#666] hover:text-white hover:border-[#333]"
            variant="outline"
            onClick={() => router.push('/dashboard/settings?tab=integrations')}
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
              className="text-[#666] hover:text-white"
              onClick={() => router.push('/dashboard/settings?tab=integrations')}
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
                  <span className="text-sm text-[#666]">
                    Created {new Date(connection.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-[#10a37f] hover:bg-[#0d8d6c] text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSync}
              disabled={syncing || connection.connection_status !== 'active'}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Button
              variant="outline"
              className="border-red-500/30 text-red-500 hover:text-red-400 hover:border-red-500/50"
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
          <TabsList className="mb-6 bg-transparent border-b border-[#2a2a2a] rounded-none p-0">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:border-b-2 data-[state=active]:border-[#10a37f] data-[state=active]:text-white text-[#666] hover:text-white pb-2 px-4 bg-transparent rounded-none"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="data-[state=active]:border-b-2 data-[state=active]:border-[#10a37f] data-[state=active]:text-white text-[#666] hover:text-white pb-2 px-4 bg-transparent rounded-none"
            >
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:border-b-2 data-[state=active]:border-[#10a37f] data-[state=active]:text-white text-[#666] hover:text-white pb-2 px-4 bg-transparent rounded-none"
            >
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-white">Connection Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#666]">Status</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(connection.connection_status)}
                        <span className="font-medium capitalize text-white">
                          {connection.connection_status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#666]">Last Sync</span>
                      <span className="font-medium text-white">
                        {connection.last_sync_at
                          ? new Date(connection.last_sync_at).toLocaleString()
                          : 'Never'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#666]">Service</span>
                      <span className="font-medium text-white">
                        {connection.service_type
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-white">Usage Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#666]">Total Syncs</span>
                      <span className="font-medium text-white">
                        {usageLogs.filter((log) => log.action === 'sync').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#666]">Success Rate</span>
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
                      <span className="text-sm text-[#666]">Records Processed</span>
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

            {/* GA4 Specific Information */}
            {connection.service_type === 'google_analytics' && (
              <Card className="bg-[#1a1a1a] border-[#2a2a2a] mt-6">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart className="h-5 w-5 text-[#10a37f]" />
                    Google Analytics 4 Properties
                  </CardTitle>
                  <CardDescription className="text-[#999]">
                    Connected GA4 properties and data streams
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {connection.config?.properties ? (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          {connection.config.properties.map((property: any, index: number) => (
                            <div
                              key={index}
                              className="p-4 border border-[#2a2a2a] rounded-lg bg-[#0a0a0a]"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-white">
                                  {property.displayName || 'GA4 Property'}
                                </h4>
                                {property.selected && (
                                  <Badge className="bg-[#10a37f] text-white">Active</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-[#666]">Property ID:</span>
                                  <p className="text-white font-mono mt-1">
                                    {property.name || connection.account_id}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-[#666]">Industry:</span>
                                  <p className="text-white mt-1">
                                    {property.industryCategory || 'Not specified'}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-[#666]">Time Zone:</span>
                                  <p className="text-white mt-1">{property.timeZone || 'UTC'}</p>
                                </div>
                                <div>
                                  <span className="text-[#666]">Currency:</span>
                                  <p className="text-white mt-1">
                                    {property.currencyCode || 'USD'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          onClick={() =>
                            router.push(
                              `/dashboard/integrations/connect/google_analytics/configure?connection_id=${connectionId}`
                            )
                          }
                          className="w-full bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white border border-[#2a2a2a]"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Change Property Selection
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          <AlertDescription className="text-[#999]">
                            <strong className="text-white">Property Selection Required</strong>
                            <p className="mt-1">
                              No specific GA4 property has been selected. Click the button below to
                              select a property.
                            </p>
                          </AlertDescription>
                        </Alert>
                        <Button
                          onClick={() =>
                            router.push(
                              `/dashboard/integrations/connect/google_analytics/configure?connection_id=${connectionId}`
                            )
                          }
                          className="w-full bg-[#10a37f] hover:bg-[#0d8d6c] text-white border-0"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Select GA4 Property
                        </Button>
                      </div>
                    )}

                    <div className="pt-4 border-t border-[#2a2a2a]">
                      <p className="text-sm text-[#666] mb-2">Available Metrics</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          'Sessions',
                          'Users',
                          'Page Views',
                          'Bounce Rate',
                          'Avg. Session Duration',
                          'Conversions',
                        ].map((metric) => (
                          <Badge
                            key={metric}
                            variant="outline"
                            className="border-[#2a2a2a] text-[#999]"
                          >
                            {metric}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* GSC Specific Information */}
            {connection.service_type === 'google_search_console' && (
              <Card className="bg-[#1a1a1a] border-[#2a2a2a] mt-6">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Search className="h-5 w-5 text-[#10a37f]" />
                    Google Search Console Properties
                  </CardTitle>
                  <CardDescription className="text-[#999]">
                    Connected website properties and search data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {connection.config?.siteUrl || connection.account_id ? (
                      <div className="space-y-4">
                        <div className="p-4 border border-[#2a2a2a] rounded-lg bg-[#0a0a0a]">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-white">Active Property</h4>
                            <Badge className="bg-[#10a37f] text-white">Connected</Badge>
                          </div>
                          <div className="text-sm">
                            <span className="text-[#666]">Site URL:</span>
                            <p className="text-white font-mono mt-1">
                              {connection.config?.siteUrl || connection.account_id}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() =>
                            router.push(
                              `/dashboard/integrations/connect/google_search_console/configure?connection_id=${connectionId}`
                            )
                          }
                          className="w-full bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white border border-[#2a2a2a]"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Change Property Selection
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          <AlertDescription className="text-[#999]">
                            <strong className="text-white">Property Selection Required</strong>
                            <p className="mt-1">
                              No specific website property has been selected. Click the button below
                              to select a property.
                            </p>
                          </AlertDescription>
                        </Alert>
                        <Button
                          onClick={() =>
                            router.push(
                              `/dashboard/integrations/connect/google_search_console/configure?connection_id=${connectionId}`
                            )
                          }
                          className="w-full bg-[#10a37f] hover:bg-[#0d8d6c] text-white border-0"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Select Website Property
                        </Button>
                      </div>
                    )}

                    <div className="pt-4 border-t border-[#2a2a2a]">
                      <p className="text-sm text-[#666] mb-2">Available Metrics</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          'Impressions',
                          'Clicks',
                          'CTR',
                          'Position',
                          'Search Queries',
                          'Page Performance',
                        ].map((metric) => (
                          <Badge
                            key={metric}
                            variant="outline"
                            className="border-[#2a2a2a] text-[#999]"
                          >
                            {metric}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="activity">
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="text-white">Recent Activity</CardTitle>
                <CardDescription className="text-[#999]">
                  Last 50 operations performed with this connection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {usageLogs.length > 0 ? (
                    usageLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 border border-[#2a2a2a] rounded-lg bg-[#0a0a0a]"
                      >
                        <div className="flex items-center gap-3">
                          <Activity className="h-4 w-4 text-[#666]" />
                          <div>
                            <p className="font-medium text-sm text-white">{log.action}</p>
                            <p className="text-xs text-[#666]">
                              {new Date(log.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {log.records_processed && (
                            <span className="text-sm text-[#666]">
                              {log.records_processed} records
                            </span>
                          )}
                          {log.duration_ms && (
                            <span className="text-sm text-[#666]">
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
                    <p className="text-center text-[#666] py-8">No activity yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid gap-6">
              <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-white">Connection Configuration</CardTitle>
                  <CardDescription className="text-[#999]">
                    Manage your connection settings and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
                      <Shield className="h-4 w-4 text-[#10b981]" />
                      <AlertDescription className="text-[#666]">
                        Credentials are encrypted and stored securely. OAuth tokens are refreshed
                        automatically when needed.
                      </AlertDescription>
                    </Alert>
                    <div className="flex items-center justify-between p-4 border border-[#2a2a2a] rounded-lg bg-[#0a0a0a]">
                      <div>
                        <p className="font-medium text-white">Reconnect Account</p>
                        <p className="text-sm text-[#666]">
                          Re-authenticate if your connection has expired
                        </p>
                      </div>
                      <Button
                        className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white border border-[#2a2a2a]"
                        onClick={() => {
                          if (
                            connection.service_type === 'google_analytics' ||
                            connection.service_type === 'google_search_console'
                          ) {
                            router.push(
                              `/dashboard/integrations/connect/${connection.service_type}/configure?connection_id=${connectionId}`
                            );
                          } else {
                            router.push(
                              `/dashboard/integrations/connect/${connection.service_type}`
                            );
                          }
                        }}
                      >
                        Reconnect
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 border border-[#2a2a2a] rounded-lg bg-[#0a0a0a]">
                      <div>
                        <p className="font-medium text-white">Revoke Access</p>
                        <p className="text-sm text-[#666]">
                          Disconnect and remove stored credentials
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="border-red-500/30 text-red-500 hover:text-red-400 hover:border-red-500/50"
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1a1a] border-red-500/20">
                <CardHeader>
                  <CardTitle className="text-red-500">Danger Zone</CardTitle>
                  <CardDescription className="text-[#999]">
                    Irreversible actions for this connection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border border-red-500/20 rounded-lg bg-red-500/5">
                    <div>
                      <p className="font-medium text-white">Delete Connection</p>
                      <p className="text-sm text-[#999]">
                        Permanently remove this connection and all associated data
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-red-500/30 text-red-500 hover:text-red-400 hover:border-red-500/50"
                      onClick={handleDelete}
                    >
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
