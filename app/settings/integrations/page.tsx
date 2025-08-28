'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IntegrationSettingsProps } from '@/types/google.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [integration, setIntegration] = useState<IntegrationSettingsProps>({
    isConnected: false,
  });
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sites, setSites] = useState<string[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchIntegrationStatus();
    
    // Check for success/error messages from OAuth callback
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success === 'google_connected') {
      setMessage({ type: 'success', text: 'Google Search Console connected successfully!' });
      fetchSites();
    } else if (error) {
      const errorMessages: Record<string, string> = {
        'invalid_request': 'Invalid request. Please try again.',
        'unauthorized': 'You are not authorized to perform this action.',
        'authentication_failed': 'Authentication failed. Please try again.',
        'access_denied': 'Access was denied. Please grant the necessary permissions.',
      };
      setMessage({ 
        type: 'error', 
        text: errorMessages[error] || 'An error occurred during authentication.' 
      });
    }
  }, [searchParams]);

  const fetchIntegrationStatus = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('google_integrations')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data && !error) {
        setIntegration({
          isConnected: true,
          connectedEmail: data.email,
          lastSync: data.last_sync ? new Date(data.last_sync) : undefined,
        });
        fetchSites();
      }
    } catch (error) {
      console.error('Error fetching integration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const response = await fetch('/api/integrations/google/gsc-data');
      if (response.ok) {
        const data = await response.json();
        setSites(data.sites || []);
        if (data.sites?.length > 0 && !selectedSite) {
          setSelectedSite(data.sites[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/integrations/google/auth';
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Search Console? This will remove all stored data.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const response = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setIntegration({ isConnected: false });
        setSites([]);
        setSelectedSite('');
        setMessage({ type: 'success', text: 'Google Search Console disconnected successfully.' });
      } else {
        setMessage({ type: 'error', text: 'Failed to disconnect. Please try again.' });
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      setMessage({ type: 'error', text: 'An error occurred while disconnecting.' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    if (!selectedSite) {
      setMessage({ type: 'error', text: 'Please select a site to sync.' });
      return;
    }

    setSyncing(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get current project (you might want to add a project selector)
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .limit(1)
        .single();

      if (!projects) {
        setMessage({ type: 'error', text: 'No project found. Please create a project first.' });
        return;
      }

      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await fetch('/api/integrations/google/gsc-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projects.id,
          siteUrl: selectedSite,
          startDate,
          endDate,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Data synced successfully!' });
        await fetchIntegrationStatus();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to sync data.' });
      }
    } catch (error) {
      console.error('Error syncing data:', error);
      setMessage({ type: 'error', text: 'An error occurred while syncing data.' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Integrations</h1>

      {message && (
        <Alert className={`mb-6 ${message.type === 'error' ? 'border-red-500' : 'border-green-500'}`}>
          <AlertDescription className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Google Search Console</CardTitle>
              <CardDescription>
                Connect your Google Search Console to track search performance and indexing status.
              </CardDescription>
            </div>
            <Badge variant={integration.isConnected ? 'default' : 'secondary'}>
              {integration.isConnected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {integration.isConnected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Connected Account</p>
                  <p className="text-sm">{integration.connectedEmail}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Last Sync</p>
                  <p className="text-sm">
                    {integration.lastSync 
                      ? formatDistanceToNow(integration.lastSync, { addSuffix: true })
                      : 'Never synced'}
                  </p>
                </div>
              </div>

              {sites.length > 0 && (
                <div>
                  <label htmlFor="site" className="block text-sm font-medium text-gray-700 mb-1">
                    Select Site
                  </label>
                  <select
                    id="site"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedSite}
                    onChange={(e) => setSelectedSite(e.target.value)}
                  >
                    {sites.map((site) => (
                      <option key={site} value={site}>
                        {site}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSync}
                  disabled={syncing || !selectedSite}
                  className="flex items-center gap-2"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {syncing ? 'Syncing...' : 'Sync Data'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Disconnect
                </Button>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium mb-2">Sync Settings</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Data is cached for 24 hours to respect API limits</p>
                  <p>• Last 30 days of data are synced by default</p>
                  <p>• Maximum 1,200 requests per day allowed by Google</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Connect your Google Search Console account to:
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Track search performance metrics (clicks, impressions, CTR, position)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Monitor top performing queries and pages
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Analyze search performance by device and country
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Identify content optimization opportunities
                </li>
              </ul>
              
              <Button onClick={handleConnect} className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Connect Google Search Console
              </Button>
              
              <p className="text-xs text-gray-500">
                You will be redirected to Google to authorize access. We only request read-only access to your Search Console data.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}