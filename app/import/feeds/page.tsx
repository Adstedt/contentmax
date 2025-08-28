'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Switch } from '@/components/ui/Switch';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { 
  RefreshCw, 
  Settings, 
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Link,
  Clock,
  Package
} from 'lucide-react';

interface FeedConfig {
  id: string;
  feed_name: string;
  merchant_id: string;
  account_id: string;
  sync_frequency: 'hourly' | 'daily' | 'weekly';
  delta_sync_enabled: boolean;
  auto_sync_enabled: boolean;
  last_sync_at: string | null;
  next_sync_at: string | null;
}

interface SyncHistory {
  id: string;
  status: 'running' | 'success' | 'failed' | 'partial';
  products_processed: number;
  products_added: number;
  products_updated: number;
  products_removed: number;
  products_failed: number;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  error_message?: string;
}

interface ProductStats {
  totalProducts: number;
  inStockProducts: number;
}

export default function GoogleMerchantFeedPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [feedConfig, setFeedConfig] = useState<FeedConfig | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [productStats, setProductStats] = useState<ProductStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [merchantId, setMerchantId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [syncFrequency, setSyncFrequency] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [deltaSync, setDeltaSync] = useState(true);
  const [autoSync, setAutoSync] = useState(true);

  useEffect(() => {
    loadFeedStatus();
  }, []);

  const loadFeedStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/feeds/google-merchant');
      const data = await response.json();

      if (response.ok) {
        if (data.feeds && data.feeds.length > 0) {
          const feed = data.feeds[0];
          setFeedConfig(feed);
          setIsAuthenticated(!!feed.auth_credentials);
          setMerchantId(feed.merchant_id || '');
          setAccountId(feed.account_id || '');
          setSyncFrequency(feed.sync_frequency || 'daily');
          setDeltaSync(feed.delta_sync_enabled ?? true);
          setAutoSync(feed.auto_sync_enabled ?? true);
        }
        setSyncHistory(data.history || []);
        setProductStats(data.stats || null);
      }
    } catch {
      setError('Failed to load feed status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthenticate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/feeds/google-merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'authenticate' }),
      });

      const data = await response.json();
      if (data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      }
    } catch {
      setError('Failed to start authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigure = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/feeds/google-merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'configure',
          merchantId,
          accountId: accountId || merchantId,
          updateFrequency: syncFrequency,
          deltaSync,
          autoSync,
        }),
      });

      if (response.ok) {
        setSuccess('Feed configuration saved successfully');
        await loadFeedStatus();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save configuration');
      }
    } catch {
      setError('Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/feeds/google-merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(
          `Sync completed: ${data.summary.inserted} new products, ${data.summary.updated} updated`
        );
        await loadFeedStatus();
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch {
      setError('Failed to sync feed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/feeds/google-merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });

      const data = await response.json();
      
      if (data.connected) {
        setSuccess(`Connection successful! Found ${data.sampleProducts} sample products.`);
      } else {
        setError(data.error || 'Connection test failed');
      }
    } catch {
      setError('Failed to test connection');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
      success: 'success',
      failed: 'danger',
      partial: 'warning',
      running: 'default',
    };
    
    return (
      <Badge variant={variants[status] || 'default'}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Google Merchant Center Feed</h1>
          <p className="text-gray-600">
            Import and sync product data from Google Merchant Center
          </p>
        </div>
        <div className="flex gap-2">
          {isAuthenticated && (
            <>
              <Button
                onClick={handleTestConnection}
                disabled={isLoading}
                variant="outline"
              >
                <Settings className="h-4 w-4 mr-2" />
                Test Connection
              </Button>
              <Button
                onClick={handleSync}
                disabled={isSyncing || !merchantId}
                variant="default"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          {success}
        </Alert>
      )}

      {/* Authentication Card */}
      {!isAuthenticated && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Authentication Required</h2>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Connect your Google Merchant Center account to start importing product data.
            </p>
            <Button onClick={handleAuthenticate} disabled={isLoading}>
              <Link className="h-4 w-4 mr-2" />
              Connect Google Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Configuration */}
      {isAuthenticated && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Feed Configuration</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="merchantId">Merchant ID</Label>
                <Input
                  id="merchantId"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  placeholder="Enter your Merchant Center ID"
                />
              </div>
              <div>
                <Label htmlFor="accountId">Account ID (Optional)</Label>
                <Input
                  id="accountId"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="Leave empty to use Merchant ID"
                />
              </div>
            </div>

            <div>
              <Label>Sync Frequency</Label>
              <RadioGroup
                value={syncFrequency}
                onValueChange={(value: any) => setSyncFrequency(value)}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="hourly"
                    name="frequency"
                    value="hourly"
                    checked={syncFrequency === 'hourly'}
                    onChange={() => setSyncFrequency('hourly')}
                    className="mr-2"
                  />
                  <label htmlFor="hourly">Hourly</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="daily"
                    name="frequency"
                    value="daily"
                    checked={syncFrequency === 'daily'}
                    onChange={() => setSyncFrequency('daily')}
                    className="mr-2"
                  />
                  <label htmlFor="daily">Daily</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="weekly"
                    name="frequency"
                    value="weekly"
                    checked={syncFrequency === 'weekly'}
                    onChange={() => setSyncFrequency('weekly')}
                    className="mr-2"
                  />
                  <label htmlFor="weekly">Weekly</label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="deltaSync"
                  checked={deltaSync}
                  onCheckedChange={setDeltaSync}
                />
                <Label htmlFor="deltaSync">
                  Enable Delta Sync (only sync changes)
                </Label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="autoSync"
                  checked={autoSync}
                  onCheckedChange={setAutoSync}
                />
                <Label htmlFor="autoSync">
                  Enable Automatic Sync
                </Label>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleConfigure} disabled={isLoading || !merchantId}>
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      {productStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold">
                    {productStats.totalProducts.toLocaleString()}
                  </p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">In Stock</p>
                  <p className="text-2xl font-bold">
                    {productStats.inStockProducts.toLocaleString()}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Last Sync</p>
                  <p className="text-sm font-medium">
                    {feedConfig?.last_sync_at 
                      ? formatDate(feedConfig.last_sync_at)
                      : 'Never'}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sync History */}
      {syncHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sync History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncHistory.map((sync) => (
                  <TableRow key={sync.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(sync.status)}
                        {getStatusBadge(sync.status)}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(sync.started_at)}</TableCell>
                    <TableCell>{formatDuration(sync.duration_ms)}</TableCell>
                    <TableCell>{sync.products_processed}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-green-600">+{sync.products_added}</span>
                        {' / '}
                        <span className="text-blue-600">↻{sync.products_updated}</span>
                        {' / '}
                        <span className="text-red-600">-{sync.products_removed}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}