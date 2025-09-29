'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  BarChart,
  Search,
  ShoppingBag,
  Globe,
  Calendar,
  DollarSign,
  Activity,
} from 'lucide-react';
import { createClient } from '@/lib/external/supabase/client';
import { toast } from 'sonner';

interface GA4Property {
  name: string;
  displayName: string;
  industryCategory?: string;
  timeZone?: string;
  currencyCode?: string;
  createTime?: string;
  parent?: string;
}

interface GSCProperty {
  siteUrl: string;
  permissionLevel: string;
}

export default function ConfigureConnectionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const serviceType = params.service as string;
  const connectionId = searchParams.get('connection_id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [connectionName, setConnectionName] = useState('');

  useEffect(() => {
    if (!connectionId) {
      router.push('/dashboard/settings?tab=integrations');
      return;
    }
    loadProperties();
  }, [connectionId]);

  const loadProperties = async () => {
    try {
      setLoading(true);

      // Fetch available properties from the API
      const response = await fetch(`/api/integrations/${connectionId}/properties`);
      if (!response.ok) throw new Error('Failed to load properties');

      const data = await response.json();
      setProperties(data.properties || []);
      setConnectionName(data.connectionName || '');

      // Auto-select if only one property
      if (data.properties?.length === 1) {
        setSelectedProperty(
          serviceType === 'google_analytics' ? data.properties[0].name : data.properties[0].siteUrl
        );
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProperty) {
      toast.error('Please select a property');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();

      // Find the selected property details
      const property = properties.find((p) =>
        serviceType === 'google_analytics'
          ? p.name === selectedProperty
          : p.siteUrl === selectedProperty
      );

      // Update the connection with selected property
      const { error } = await supabase
        .from('data_source_connections')
        .update({
          account_id: selectedProperty,
          config: {
            ...property,
            selected: true,
            propertyName: property.displayName || property.siteUrl,
            properties: [property], // Store for display
          },
          connection_status: 'active',
        })
        .eq('id', connectionId);

      if (error) throw error;

      toast.success('Property configured successfully');
      router.push(`/dashboard/integrations/${connectionId}`);
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const getServiceInfo = () => {
    switch (serviceType) {
      case 'google_analytics':
        return {
          name: 'Google Analytics 4',
          icon: BarChart,
          iconColor: 'text-blue-500',
          description: 'Select which GA4 property to sync data from',
        };
      case 'google_search_console':
        return {
          name: 'Google Search Console',
          icon: Search,
          iconColor: 'text-green-500',
          description: 'Select which website property to track',
        };
      case 'google_merchant_center':
        return {
          name: 'Google Merchant Center',
          icon: ShoppingBag,
          iconColor: 'text-purple-500',
          description: 'Configure your merchant account',
        };
      default:
        return null;
    }
  };

  const serviceInfo = getServiceInfo();

  if (!serviceInfo) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="container mx-auto py-8 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Unknown service type</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const ServiceIcon = serviceInfo.icon;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            className="mb-6 text-[#666] hover:text-white"
            onClick={() => router.push('/dashboard/settings?tab=integrations')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Integrations
          </Button>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
              <ServiceIcon className={`h-8 w-8 ${serviceInfo.iconColor}`} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Configure {serviceInfo.name}</h1>
              <p className="text-[#999] mt-1">{serviceInfo.description}</p>
            </div>
          </div>
        </div>

        {/* Connection Info */}
        <Card className="bg-[#1a1a1a] border-[#2a2a2a] mb-6">
          <CardHeader>
            <CardTitle className="text-white">Connection Details</CardTitle>
            <CardDescription className="text-[#999]">
              {connectionName || 'Unnamed Connection'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Property Selection */}
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="text-white">
              {serviceType === 'google_analytics' ? 'Select GA4 Property' : 'Select Property'}
            </CardTitle>
            <CardDescription className="text-[#999]">
              Choose which property to sync data from. You can change this later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-[#666]">Loading properties...</div>
              </div>
            ) : properties.length === 0 ? (
              <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-[#999]">
                  No properties found. Make sure you have access to at least one {serviceInfo.name}{' '}
                  property.
                </AlertDescription>
              </Alert>
            ) : (
              <RadioGroup value={selectedProperty} onValueChange={setSelectedProperty}>
                <div className="space-y-3">
                  {serviceType === 'google_analytics'
                    ? // GA4 Properties
                      properties.map((property: GA4Property) => (
                        <Label
                          key={property.name}
                          htmlFor={property.name}
                          className="flex cursor-pointer rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-4 hover:border-[#3a3a3a] transition-colors"
                        >
                          <RadioGroupItem
                            value={property.name}
                            id={property.name}
                            className="mt-1 border-[#666] text-[#10a37f]"
                          />
                          <div className="ml-4 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-white">
                                {property.displayName || property.name}
                              </p>
                              {property.industryCategory && (
                                <Badge variant="outline" className="border-[#2a2a2a] text-[#999]">
                                  {property.industryCategory}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-[#666] mt-1 font-mono">{property.name}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-[#666]">
                              {property.timeZone && (
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {property.timeZone}
                                </span>
                              )}
                              {property.currencyCode && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  {property.currencyCode}
                                </span>
                              )}
                              {property.createTime && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Created {new Date(property.createTime).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </Label>
                      ))
                    : // Search Console Properties
                      properties.map((property: GSCProperty) => (
                        <Label
                          key={property.siteUrl}
                          htmlFor={property.siteUrl}
                          className="flex cursor-pointer rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-4 hover:border-[#3a3a3a] transition-colors"
                        >
                          <RadioGroupItem
                            value={property.siteUrl}
                            id={property.siteUrl}
                            className="mt-1 border-[#666] text-[#10a37f]"
                          />
                          <div className="ml-4 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-white">{property.siteUrl}</p>
                              <Badge variant="outline" className="border-[#2a2a2a] text-[#999]">
                                {property.permissionLevel}
                              </Badge>
                            </div>
                          </div>
                        </Label>
                      ))}
                </div>
              </RadioGroup>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between items-center mt-8">
          <Button
            variant="outline"
            className="border-[#2a2a2a] text-[#999] hover:text-white hover:border-[#333]"
            onClick={() => router.push('/dashboard/settings?tab=integrations')}
          >
            Cancel
          </Button>
          <Button
            className="bg-[#10a37f] hover:bg-[#0d8d6c] text-white border-0"
            onClick={handleSave}
            disabled={!selectedProperty || saving || loading}
          >
            {saving ? (
              <>
                <Activity className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
