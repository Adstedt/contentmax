'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Link2,
  AlertCircle,
  CheckCircle,
  Search,
  ArrowRight,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { createClient } from '@/lib/external/supabase/client';
import { toast } from 'sonner';

interface UnmatchedMetric {
  id: string;
  source: 'gsc' | 'ga4' | 'market';
  identifier: string;
  identifier_type: string;
  metrics: any;
  match_attempts: number;
  resolved: boolean;
  created_at: string;
}

interface TaxonomyNode {
  id: string;
  title: string;
  path: string;
  url?: string;
}

interface Product {
  id: string;
  title: string;
  gtin?: string;
  mpn?: string;
  link?: string;
}

export default function MetricsMappingsPage() {
  const [unmatchedMetrics, setUnmatchedMetrics] = useState<UnmatchedMetric[]>([]);
  const [nodes, setNodes] = useState<TaxonomyNode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'gsc' | 'ga4' | 'market'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load unmatched metrics
      const response = await fetch(
        `/api/metrics/unmatched?resolved=false${filter !== 'all' ? `&source=${filter}` : ''}`
      );
      const data = await response.json();
      setUnmatchedMetrics(data.items || []);
      setStats(data.summary);

      // Load taxonomy nodes
      const { data: nodesData } = await supabase
        .from('taxonomy_nodes')
        .select('id, title, path, url')
        .order('title');
      setNodes(nodesData || []);

      // Load products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, title, gtin, mpn, link')
        .order('title');
      setProducts(productsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load unmatched metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleMapping = async (
    unmatchedId: string,
    entityType: 'node' | 'product',
    entityId: string
  ) => {
    setProcessing(unmatchedId);
    try {
      const response = await fetch('/api/metrics/unmatched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unmatchedId,
          entityType,
          entityId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create mapping');

      toast.success('Manual mapping created successfully');

      // Remove from list
      setUnmatchedMetrics((prev) => prev.filter((m) => m.id !== unmatchedId));
    } catch (error) {
      console.error('Error creating mapping:', error);
      toast.error('Failed to create mapping');
    } finally {
      setProcessing(null);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'gsc':
        return <Search className="h-4 w-4 text-green-500" />;
      case 'ga4':
        return <div className="h-4 w-4 bg-blue-500 rounded" />;
      case 'market':
        return <div className="h-4 w-4 bg-purple-500 rounded" />;
      default:
        return <Link2 className="h-4 w-4 text-[#666]" />;
    }
  };

  const getSourceName = (source: string) => {
    switch (source) {
      case 'gsc':
        return 'Search Console';
      case 'ga4':
        return 'Analytics';
      case 'market':
        return 'Market Data';
      default:
        return source;
    }
  };

  const filteredMetrics = unmatchedMetrics.filter(
    (m) => searchTerm === '' || m.identifier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Manual Metric Mappings</h1>
          <p className="text-[#999] mt-2">
            Review and manually map unmatched metrics to your taxonomy nodes or products
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-sm text-[#666]">Total Unmatched</div>
              </CardContent>
            </Card>
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-500">{stats.bySource.gsc}</div>
                <div className="text-sm text-[#666]">GSC URLs</div>
              </CardContent>
            </Card>
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-500">{stats.bySource.ga4}</div>
                <div className="text-sm text-[#666]">GA4 Pages</div>
              </CardContent>
            </Card>
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-500">{stats.bySource.market}</div>
                <div className="text-sm text-[#666]">Market GTINs</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-[#1a1a1a] border-[#2a2a2a] mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search identifiers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-white"
                  icon={<Search className="h-4 w-4 text-[#666]" />}
                />
              </div>
              <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
                <SelectTrigger className="w-[180px] bg-[#0a0a0a] border-[#2a2a2a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="gsc">Search Console</SelectItem>
                  <SelectItem value="ga4">Analytics</SelectItem>
                  <SelectItem value="market">Market Data</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="border-[#2a2a2a] text-[#999] hover:text-white"
                onClick={loadData}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Unmatched items */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-[#666]">Loading unmatched metrics...</div>
          </div>
        ) : filteredMetrics.length === 0 ? (
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="p-12 text-center">
              <CheckCircle className="h-12 w-12 text-[#10a37f] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">All metrics matched!</h3>
              <p className="text-[#999]">No unmatched metrics found. Great job!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredMetrics.map((metric) => (
              <Card key={metric.id} className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getSourceIcon(metric.source)}
                        <Badge variant="outline" className="border-[#2a2a2a] text-[#999]">
                          {getSourceName(metric.source)}
                        </Badge>
                        <Badge variant="outline" className="border-[#2a2a2a] text-[#666]">
                          {metric.match_attempts} attempts
                        </Badge>
                      </div>
                      <div className="font-mono text-sm text-white mb-2">{metric.identifier}</div>
                      {metric.metrics && (
                        <div className="text-xs text-[#666] grid grid-cols-2 md:grid-cols-4 gap-2">
                          {metric.metrics.clicks && <div>Clicks: {metric.metrics.clicks}</div>}
                          {metric.metrics.impressions && (
                            <div>Impressions: {metric.metrics.impressions}</div>
                          )}
                          {metric.metrics.sessions && (
                            <div>Sessions: {metric.metrics.sessions}</div>
                          )}
                          {metric.metrics.revenue && <div>Revenue: ${metric.metrics.revenue}</div>}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Select
                        disabled={processing === metric.id}
                        onValueChange={(value) => {
                          const [type, id] = value.split(':');
                          handleMapping(metric.id, type as 'node' | 'product', id);
                        }}
                      >
                        <SelectTrigger className="w-[250px] bg-[#0a0a0a] border-[#2a2a2a] text-white">
                          <SelectValue placeholder="Map to..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="" disabled>
                            Select entity
                          </SelectItem>
                          <div className="px-2 py-1 text-xs text-[#666]">Taxonomy Nodes</div>
                          {nodes.map((node) => (
                            <SelectItem key={node.id} value={`node:${node.id}`}>
                              {node.title}
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1 text-xs text-[#666] mt-2">Products</div>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={`product:${product.id}`}>
                              {product.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
