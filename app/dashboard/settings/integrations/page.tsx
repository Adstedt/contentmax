'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Search, RefreshCw, Settings, Check, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/external/supabase/client';
import { toast } from 'sonner';

interface IntegrationConfig {
  ga4_property_id?: string;
  gsc_site_url?: string;
  last_ga4_sync?: string;
  last_gsc_sync?: string;
}

export default function IntegrationsPage() {
  const [config, setConfig] = useState<IntegrationConfig>({});
  const [ga4PropertyId, setGa4PropertyId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadIntegrationConfig();
  }, []);

  const loadIntegrationConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if Google OAuth is connected
      const { data: googleAuth } = await supabase
        .from('google_auth')
        .select('id')
        .eq('user_id', user.id)
        .single();

      setIsGoogleConnected(!!googleAuth);

      // Load user settings
      const { data: settings } = await supabase
        .from('user_settings')
        .select('integration_config')
        .eq('user_id', user.id)
        .single();

      if (settings?.integration_config) {
        const integrationConfig = settings.integration_config as IntegrationConfig;
        setConfig(integrationConfig);
        setGa4PropertyId(integrationConfig.ga4_property_id || '');
      }
    } catch (error) {
      console.error('Error loading integration config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGa4PropertyId = async () => {
    if (!ga4PropertyId.trim()) {
      toast.error('Please enter a valid GA4 Property ID');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const newConfig = {
        ...config,
        ga4_property_id: ga4PropertyId.trim(),
      };

      // Upsert user settings with the new config
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          integration_config: newConfig,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setConfig(newConfig);
      toast.success('GA4 Property ID saved successfully');
    } catch (error) {
      console.error('Error saving GA4 property:', error);
      toast.error('Failed to save GA4 Property ID');
    } finally {
      setIsSaving(false);
    }
  };

  const connectGoogleAccount = () => {
    // Redirect to Google OAuth flow
    window.location.href = '/api/integrations/google/auth';
  };

  const syncGA4Data = async () => {
    try {
      const response = await fetch('/api/metrics/ga4/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          forceRefresh: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
      }

      toast.success('GA4 data sync started');

      // Update last sync time
      setConfig(prev => ({
        ...prev,
        last_ga4_sync: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error syncing GA4 data:', error);
      toast.error('Failed to sync GA4 data');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-8 text-white">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2 mb-8"></div>
            <div className="space-y-6">
              <div className="h-32 bg-gray-800 rounded"></div>
              <div className="h-32 bg-gray-800 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8 text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Integrations</h1>
        <p className="text-gray-400 mb-8">Connect and configure external services</p>

        {/* Google Account Connection */}
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a] mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Settings className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2">Google Account</h2>
              <p className="text-gray-400 mb-4">
                Connect your Google account to access Analytics, Search Console, and other Google services.
              </p>

              {isGoogleConnected ? (
                <div className="flex items-center gap-2 text-green-500">
                  <Check className="h-5 w-5" />
                  <span>Connected</span>
                </div>
              ) : (
                <button
                  onClick={connectGoogleAccount}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  Connect Google Account
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Google Analytics 4 */}
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a] mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <BarChart3 className="h-6 w-6 text-green-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2">Google Analytics 4</h2>
              <p className="text-gray-400 mb-4">
                View revenue and conversion data for your product categories.
              </p>

              {!isGoogleConnected ? (
                <div className="flex items-center gap-2 text-yellow-500 mb-4">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">Connect your Google account first</span>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="ga4-property" className="block text-sm font-medium text-gray-300 mb-2">
                        GA4 Property ID
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="ga4-property"
                          type="text"
                          value={ga4PropertyId}
                          onChange={(e) => setGa4PropertyId(e.target.value)}
                          placeholder="e.g., 123456789"
                          className="flex-1 px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <button
                          onClick={saveGa4PropertyId}
                          disabled={isSaving || !ga4PropertyId.trim()}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Find this in GA4 → Admin → Property Settings
                      </p>
                    </div>

                    {config.ga4_property_id && (
                      <div className="pt-4 border-t border-[#2a2a2a]">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-400">
                              Last sync: {formatDate(config.last_ga4_sync)}
                            </p>
                          </div>
                          <button
                            onClick={syncGA4Data}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-md transition-colors"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Sync Now
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Google Search Console */}
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a]">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Search className="h-6 w-6 text-purple-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2">Google Search Console</h2>
              <p className="text-gray-400 mb-4">
                See organic search performance data for your taxonomy categories.
              </p>

              {isGoogleConnected && (
                <div className="flex items-center gap-2 text-green-500">
                  <Check className="h-5 w-5" />
                  <span>Connected and configured</span>
                </div>
              )}

              {config.gsc_site_url && (
                <p className="text-sm text-gray-400 mt-2">
                  Site: {config.gsc_site_url}
                </p>
              )}

              {config.last_gsc_sync && (
                <p className="text-sm text-gray-400 mt-1">
                  Last sync: {formatDate(config.last_gsc_sync)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}