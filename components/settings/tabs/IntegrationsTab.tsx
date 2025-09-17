'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import {
  Link2,
  Settings,
  BarChart,
  Search,
  ShoppingBag,
  Store,
  Share2,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Connection {
  id: string;
  service_type: string;
  connection_name: string;
  connection_status: 'pending' | 'active' | 'error' | 'expired';
  last_sync_at?: string;
  created_at: string;
}

const services = [
  {
    id: 'google_analytics',
    name: 'Google Analytics 4',
    icon: BarChart,
    iconColor: 'text-blue-600',
    description: 'Import website traffic and user behavior data',
    features: ['Page views & sessions', 'User demographics', 'Conversion tracking'],
    status: 'available',
    badge: 'Popular',
    badgeColor: 'text-[#10a37f]',
  },
  {
    id: 'google_search_console',
    name: 'Google Search Console',
    icon: Search,
    iconColor: 'text-green-600',
    description: 'Track search performance and indexing',
    features: ['Search queries', 'Click-through rates', 'Index coverage'],
    status: 'available',
    badge: 'Essential',
    badgeColor: 'text-[#10a37f]',
  },
  {
    id: 'google_merchant_center',
    name: 'Google Merchant Center',
    icon: ShoppingBag,
    iconColor: 'text-purple-600',
    description: 'Sync product feed and shopping data',
    features: ['Product catalog', 'Feed diagnostics', 'Shopping performance'],
    status: 'available',
    badge: 'E-commerce',
    badgeColor: 'text-purple-600',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    icon: Store,
    iconColor: 'text-green-700',
    description: 'Import store data and product information',
    features: ['Product inventory', 'Order analytics', 'Customer data'],
    status: 'coming_soon',
    badge: 'Coming Soon',
    badgeColor: 'text-[#666]',
  },
  {
    id: 'meta',
    name: 'Meta Business',
    icon: Share2,
    iconColor: 'text-blue-500',
    description: 'Connect Facebook and Instagram data',
    features: ['Ad performance', 'Audience insights', 'Social engagement'],
    status: 'coming_soon',
    badge: 'Coming Soon',
    badgeColor: 'text-[#666]',
  },
];

export function IntegrationsTab() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { data: user } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', session.session.user.id)
        .single();

      if (!user?.org_id) return;

      const { data } = await supabase
        .from('data_source_connections')
        .select('*')
        .eq('org_id', user.org_id)
        .order('created_at', { ascending: false });

      setConnections(data || []);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (serviceType: string) => {
    router.push(`/dashboard/integrations/connect/${serviceType}`);
  };

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId);
    try {
      const response = await fetch(`/api/integrations/${connectionId}/sync`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Sync failed');

      await loadConnections();
      toast.success('Sync initiated successfully');
    } catch (error) {
      toast.error('Failed to sync connection');
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;

    try {
      const { error } = await supabase
        .from('data_source_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      toast.success('Connection deleted successfully');
    } catch (error) {
      toast.error('Failed to delete connection');
    }
  };

  const getServiceInfo = (serviceType: string) => {
    return services.find((s) => s.id === serviceType);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-[#666]" />;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">External Integrations</h2>
          <p className="text-[#999] text-sm mt-1">
            Connect external services to enrich your content with additional data
          </p>
        </div>
      </div>

      {/* Connected Services */}
      {connections.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-[#999] mb-4">Active Connections</h3>
          <div className="space-y-3">
            {connections.map((connection) => {
              const service = getServiceInfo(connection.service_type);
              if (!service) return null;
              const ServiceIcon = service.icon;

              return (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-[#2a2a2a] rounded-lg">
                      <ServiceIcon className={`h-5 w-5 ${service.iconColor}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{connection.connection_name}</h3>
                        {getStatusIcon(connection.connection_status)}
                      </div>
                      <p className="text-sm text-[#999]">{service.name}</p>
                      {connection.last_sync_at && (
                        <p className="text-xs text-[#666]">
                          Last sync: {new Date(connection.last_sync_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSync(connection.id)}
                      disabled={
                        syncing === connection.id || connection.connection_status !== 'active'
                      }
                      className="text-[#999] hover:text-white"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${syncing === connection.id ? 'animate-spin' : ''}`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/integrations/${connection.id}`)}
                      className="text-[#999] hover:text-white"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(connection.id)}
                      className="text-[#999] hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Services */}
      <div>
        <h3 className="text-sm font-medium text-[#999] mb-4">Available Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => {
            const ServiceIcon = service.icon;
            const isConnected = connections.some((c) => c.service_type === service.id);
            const isComingSoon = service.status === 'coming_soon';

            return (
              <div
                key={service.id}
                className={`relative p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg transition-all ${
                  isComingSoon ? 'opacity-60' : 'hover:border-[#3a3a3a] cursor-pointer'
                }`}
                onClick={() => !isComingSoon && !isConnected && handleConnect(service.id)}
              >
                {isConnected && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-[#10a37f]/20 text-[#10a37f] border-[#10a37f]/30">
                      Connected
                    </Badge>
                  </div>
                )}

                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-[#2a2a2a] rounded-lg">
                    <ServiceIcon className={`h-5 w-5 ${service.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-white">{service.name}</h4>
                    <span className={`text-xs ${service.badgeColor}`}>{service.badge}</span>
                  </div>
                </div>

                <p className="text-sm text-[#999] mb-3">{service.description}</p>

                <ul className="text-xs text-[#666] space-y-1 mb-4">
                  {service.features.map((feature, i) => (
                    <li key={i}>✓ {feature}</li>
                  ))}
                </ul>

                {!isConnected && (
                  <Button
                    className={
                      isComingSoon
                        ? 'w-full bg-[#1a1a1a] text-[#666] cursor-not-allowed'
                        : 'w-full bg-[#10a37f] hover:bg-[#0d8d6c] text-white border-0'
                    }
                    disabled={isComingSoon}
                    size="sm"
                  >
                    {isComingSoon ? 'Coming Soon' : 'Connect'}
                    {!isComingSoon && <ExternalLink className="h-3 w-3 ml-2" />}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-pulse">
            <div className="h-12 w-12 bg-[#2a2a2a] rounded-full mx-auto mb-4"></div>
            <div className="h-4 w-48 bg-[#2a2a2a] rounded mx-auto mb-2"></div>
            <div className="h-3 w-64 bg-[#2a2a2a] rounded mx-auto"></div>
          </div>
        </div>
      )}

      {!loading && connections.length === 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center mt-8">
          <Link2 className="h-12 w-12 text-[#666] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No integrations connected</h3>
          <p className="text-[#999] mb-4">
            Connect external services to enhance your content with additional data sources
          </p>
        </div>
      )}
    </div>
  );
}
