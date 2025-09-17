'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import {
  BarChart,
  Search,
  ShoppingBag,
  ArrowLeft,
  ExternalLink,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ConnectServicePage() {
  const params = useParams();
  const router = useRouter();
  const serviceType = params.service as string;
  const [connectionName, setConnectionName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getServiceInfo = () => {
    switch (serviceType) {
      case 'google_analytics':
        return {
          name: 'Google Analytics 4',
          icon: <BarChart className="h-8 w-8 text-blue-600" />,
          description: 'Connect your GA4 property to import website analytics data',
          permissions: [
            'Read access to your Google Analytics properties',
            'View reports and data streams',
            'Access user and event data',
          ],
          setupSteps: [
            'Enter a name for this connection',
            'Click "Connect with Google"',
            'Sign in to your Google account',
            'Grant permissions to Content Machine',
            'Select your GA4 property',
          ],
        };
      case 'google_search_console':
        return {
          name: 'Google Search Console',
          icon: <Search className="h-8 w-8 text-green-600" />,
          description: 'Connect GSC to track search performance and indexing',
          permissions: [
            'Read access to Search Console data',
            'View search analytics',
            'Access URL inspection data',
          ],
          setupSteps: [
            'Enter a name for this connection',
            'Click "Connect with Google"',
            'Sign in to your Google account',
            'Grant permissions to Content Machine',
            'Select your verified property',
          ],
        };
      case 'google_merchant_center':
        return {
          name: 'Google Merchant Center',
          icon: <ShoppingBag className="h-8 w-8 text-purple-600" />,
          description: 'Connect GMC to sync your product catalog and shopping data',
          permissions: [
            'Read access to your Merchant Center account',
            'View product listings',
            'Access feed diagnostics',
          ],
          setupSteps: [
            'Enter a name for this connection',
            'Click "Connect with Google"',
            'Sign in to your Google account',
            'Grant permissions to Content Machine',
            'Your merchant ID will be detected automatically',
          ],
        };
      default:
        return null;
    }
  };

  const handleConnect = async () => {
    if (!connectionName.trim()) {
      setError('Please enter a connection name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current user and org
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        throw new Error('Not authenticated');
      }

      const { data: user } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', session.session.user.id)
        .single();

      // If user doesn't have org_id, use their user_id as a fallback
      const orgId = user?.org_id || session.session.user.id;

      // Create connection record
      const { data: connection, error: connectionError } = await supabase
        .from('data_source_connections')
        .insert({
          org_id: orgId,
          user_id: session.session.user.id,
          service_type: serviceType,
          connection_name: connectionName,
          connection_status: 'pending',
        })
        .select()
        .single();

      if (connectionError) throw connectionError;

      // Generate OAuth URL
      const state = Buffer.from(
        JSON.stringify({
          connectionId: connection.id,
          serviceType,
          userId: session.session.user.id,
        })
      ).toString('base64');

      // Check for Google Client ID
      if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
        throw new Error('Google OAuth is not configured. Please contact support.');
      }

      const redirectUri = `${window.location.origin}/api/auth/google/callback`;
      const scopes = getScopes(serviceType);

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      // Redirect to OAuth
      window.location.href = authUrl.toString();
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate connection');
      setLoading(false);
    }
  };

  const getScopes = (service: string): string[] => {
    switch (service) {
      case 'google_analytics':
        return ['https://www.googleapis.com/auth/analytics.readonly'];
      case 'google_search_console':
        return ['https://www.googleapis.com/auth/webmasters.readonly'];
      case 'google_merchant_center':
        return ['https://www.googleapis.com/auth/content'];
      default:
        return [];
    }
  };

  const serviceInfo = getServiceInfo();

  if (!serviceInfo) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="container mx-auto py-8 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Unknown service type: {serviceType}</AlertDescription>
          </Alert>
          <Button
            className="mt-4 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
            variant="outline"
            onClick={() => router.push('/dashboard/integrations')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Integrations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Button
          variant="ghost"
          className="mb-6 text-gray-400 hover:text-white"
          onClick={() => router.push('/dashboard/integrations')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Integration Center
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            {serviceInfo.icon}
            <div>
              <h1 className="text-3xl font-bold text-white">Connect {serviceInfo.name}</h1>
              <p className="text-gray-400">{serviceInfo.description}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Connection Name */}
          <Card className="bg-[#1a1a1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Connection Details</CardTitle>
              <CardDescription className="text-gray-400">
                Give this connection a memorable name to identify it later
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="connection-name" className="text-gray-300">
                    Connection Name
                  </Label>
                  <Input
                    id="connection-name"
                    placeholder={`e.g., "Main Website ${serviceInfo.name}"`}
                    className="bg-[#0a0a0a] border-gray-700 text-white placeholder:text-gray-500"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card className="bg-[#1a1a1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Required Permissions</CardTitle>
              <CardDescription className="text-gray-400">
                Content Machine will request the following permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {serviceInfo.permissions.map((permission, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-[#10b981] mt-0.5" />
                    <span className="text-sm text-gray-300">{permission}</span>
                  </div>
                ))}
              </div>
              <Alert className="mt-4 bg-[#0a0a0a] border-gray-700">
                <Shield className="h-4 w-4 text-[#10b981]" />
                <AlertDescription className="text-gray-400">
                  Your credentials are encrypted using AES-256 and stored securely. You can revoke
                  access at any time from the Integration Center.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Setup Steps */}
          <Card className="bg-[#1a1a1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Setup Steps</CardTitle>
              <CardDescription className="text-gray-400">
                Follow these steps to complete the connection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {serviceInfo.setupSteps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-[#10b981] text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-300">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Connect Button */}
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              className="border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
              onClick={() => router.push('/dashboard/integrations')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#10b981] hover:bg-[#0ea968] text-white border-0"
              onClick={handleConnect}
              disabled={loading || !connectionName.trim()}
            >
              {loading ? 'Connecting...' : 'Connect with Google'}
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
