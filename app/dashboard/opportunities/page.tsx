'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FilterControls,
  type OpportunityType,
  type SortBy,
  type SortOrder,
} from '@/components/taxonomy/FilterControls';
import { OpportunityService } from '@/lib/services/opportunity-service';
import { supabase } from '@/lib/supabase/client';
import {
  TrendingUp,
  DollarSign,
  Package,
  Zap,
  Target,
  Clock,
  Shield,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Download,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

interface OpportunityData {
  nodeId: string;
  nodeTitle: string;
  nodeUrl: string;
  score: number;
  factors: {
    trafficPotential: number;
    revenuePotential: number;
    pricingOpportunity: number;
    competitiveGap: number;
    contentQuality: number;
  };
  category: 'quick-win' | 'strategic' | 'incremental' | 'long-term' | 'maintain';
  confidence: 'high' | 'medium' | 'low';
  projectedImpact: {
    revenue: number;
    traffic: number;
    timeline: number;
  };
  recommendations: string[];
  productCount: number;
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<OpportunityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Filter states
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  const [opportunityType, setOpportunityType] = useState<OpportunityType>('all');
  const [sortBy, setSortBy] = useState<SortBy>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch opportunity scores
      const { data: scores, error: scoresError } = await supabase
        .from('opportunity_scores')
        .select(
          `
          *,
          taxonomy_nodes (
            id,
            title,
            url,
            path
          )
        `
        )
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString());

      if (scoresError) throw scoresError;

      // Fetch product counts
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('node_id, id')
        .eq('user_id', user.id);

      if (productsError) throw productsError;

      // Count products per node
      const productCounts =
        products?.reduce(
          (acc, p) => {
            acc[p.node_id] = (acc[p.node_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

      // Map to OpportunityData
      const mappedOpportunities = (scores || []).map((score: any) => ({
        nodeId: score.node_id,
        nodeTitle: score.taxonomy_nodes?.title || 'Unknown',
        nodeUrl: score.taxonomy_nodes?.url || '#',
        score: score.score,
        factors: score.factors || {
          trafficPotential: score.traffic_potential,
          revenuePotential: score.revenue_potential,
          pricingOpportunity: score.pricing_opportunity,
          competitiveGap: score.competitive_gap,
          contentQuality: score.content_quality,
        },
        category: score.opportunity_type,
        confidence: score.confidence_level,
        projectedImpact: {
          revenue: score.projected_impact_revenue || 0,
          traffic: score.projected_impact_traffic || 0,
          timeline: score.projected_timeline_days || 0,
        },
        recommendations: score.recommendations || [],
        productCount: productCounts[score.node_id] || 0,
      }));

      setOpportunities(mappedOpportunities);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Failed to fetch opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch taxonomy nodes
      const { data: nodes } = await supabase
        .from('taxonomy_nodes')
        .select('*')
        .eq('user_id', user.id);

      if (!nodes || nodes.length === 0) {
        alert('No taxonomy nodes found. Please import your product catalog first.');
        return;
      }

      // Calculate opportunity scores
      const service = new OpportunityService();
      await service.calculateOpportunityScores(nodes, user.id);

      // Refresh data
      await fetchOpportunities();
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Failed to sync opportunity scores. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  // Filter and sort opportunities
  const filteredOpportunities = useMemo(() => {
    let filtered = [...opportunities];

    // Apply score filter
    filtered = filtered.filter((o) => o.score >= scoreRange[0] && o.score <= scoreRange[1]);

    // Apply type filter
    if (opportunityType !== 'all') {
      filtered = filtered.filter((o) => o.category === opportunityType);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.nodeTitle.toLowerCase().includes(query) ||
          o.nodeUrl.toLowerCase().includes(query) ||
          o.recommendations.some((r) => r.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let compareValue = 0;
      switch (sortBy) {
        case 'score':
          compareValue = a.score - b.score;
          break;
        case 'impact':
          compareValue = a.projectedImpact.revenue - b.projectedImpact.revenue;
          break;
        case 'name':
          compareValue = a.nodeTitle.localeCompare(b.nodeTitle);
          break;
        case 'products':
          compareValue = a.productCount - b.productCount;
          break;
        case 'revenue':
          compareValue = a.projectedImpact.revenue - b.projectedImpact.revenue;
          break;
      }
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [opportunities, scoreRange, opportunityType, sortBy, sortOrder, searchQuery]);

  // Group opportunities by type
  const groupedOpportunities = useMemo(() => {
    return filteredOpportunities.reduce(
      (acc, opp) => {
        if (!acc[opp.category]) {
          acc[opp.category] = [];
        }
        acc[opp.category].push(opp);
        return acc;
      },
      {} as Record<string, OpportunityData[]>
    );
  }, [filteredOpportunities]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quick-win':
        return <Zap className="w-4 h-4" />;
      case 'strategic':
        return <Target className="w-4 h-4" />;
      case 'incremental':
        return <TrendingUp className="w-4 h-4" />;
      case 'long-term':
        return <Clock className="w-4 h-4" />;
      case 'maintain':
        return <Shield className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'quick-win':
        return 'bg-green-100 text-green-800';
      case 'strategic':
        return 'bg-purple-100 text-purple-800';
      case 'incremental':
        return 'bg-blue-100 text-blue-800';
      case 'long-term':
        return 'bg-gray-100 text-gray-800';
      case 'maintain':
        return 'bg-gray-50 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const exportToCSV = () => {
    const headers = [
      'Category',
      'Title',
      'URL',
      'Score',
      'Projected Revenue',
      'Projected Traffic',
      'Timeline (days)',
      'Product Count',
      'Confidence',
      'Recommendations',
    ];

    const rows = filteredOpportunities.map((o) => [
      o.nodeTitle,
      o.nodeUrl,
      o.score,
      o.category,
      o.projectedImpact.revenue,
      o.projectedImpact.traffic,
      o.projectedImpact.timeline,
      o.productCount,
      o.confidence,
      o.recommendations.join('; '),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell))
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opportunities-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading opportunities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold">Opportunity Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Identify and prioritize optimization opportunities across your product catalog
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredOpportunities.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Refresh Scores'}
            </Button>
          </div>
        </div>

        {lastSyncTime && (
          <p className="text-sm text-gray-500 mb-4">
            Last updated: {lastSyncTime.toLocaleString()}
          </p>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{opportunities.length}</div>
              <p className="text-xs text-gray-500">Across all categories</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Quick Wins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {opportunities.filter((o) => o.category === 'quick-win').length}
              </div>
              <p className="text-xs text-gray-500">High impact, low effort</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Revenue Potential</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(
                  opportunities.reduce((sum, o) => sum + o.projectedImpact.revenue, 0)
                )}
              </div>
              <p className="text-xs text-gray-500">Projected impact</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Traffic Increase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatNumber(opportunities.reduce((sum, o) => sum + o.projectedImpact.traffic, 0))}
              </div>
              <p className="text-xs text-gray-500">Additional visits</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <FilterControls
          onOpportunityScoreChange={setScoreRange}
          onOpportunityTypeChange={setOpportunityType}
          onSortByChange={(by, order) => {
            setSortBy(by);
            setSortOrder(order);
          }}
          onSearchChange={setSearchQuery}
          onReset={() => {
            setScoreRange([0, 100]);
            setOpportunityType('all');
            setSortBy('score');
            setSortOrder('desc');
            setSearchQuery('');
          }}
          currentFilters={{
            opportunityScore: scoreRange,
            opportunityType,
            sortBy,
            sortOrder,
            search: searchQuery,
          }}
        />

        {/* Opportunities by Type */}
        <Tabs defaultValue="all" className="mt-6">
          <TabsList>
            <TabsTrigger value="all">All ({filteredOpportunities.length})</TabsTrigger>
            <TabsTrigger value="quick-win">
              Quick Wins ({groupedOpportunities['quick-win']?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="strategic">
              Strategic ({groupedOpportunities['strategic']?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="incremental">
              Incremental ({groupedOpportunities['incremental']?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="long-term">
              Long-term ({groupedOpportunities['long-term']?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOpportunities.map((opp) => (
                <OpportunityCard key={opp.nodeId} opportunity={opp} />
              ))}
            </div>
          </TabsContent>

          {Object.entries(groupedOpportunities).map(([type, opps]) => (
            <TabsContent key={type} value={type} className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {opps.map((opp) => (
                  <OpportunityCard key={opp.nodeId} opportunity={opp} />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {filteredOpportunities.length === 0 && (
          <Card className="mt-6">
            <CardContent className="text-center py-12">
              <p className="text-gray-500">No opportunities match your current filters.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setScoreRange([0, 100]);
                  setOpportunityType('all');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function OpportunityCard({ opportunity }: { opportunity: OpportunityData }) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quick-win':
        return <Zap className="w-4 h-4" />;
      case 'strategic':
        return <Target className="w-4 h-4" />;
      case 'incremental':
        return <TrendingUp className="w-4 h-4" />;
      case 'long-term':
        return <Clock className="w-4 h-4" />;
      case 'maintain':
        return <Shield className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    if (score >= 20) return 'text-green-600';
    return 'text-gray-600';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">{opportunity.nodeTitle}</CardTitle>
            <CardDescription className="text-xs mt-1 truncate">
              {opportunity.nodeUrl}
            </CardDescription>
          </div>
          <div className={`text-2xl font-bold ${getScoreColor(opportunity.score)}`}>
            {opportunity.score}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            <span className="mr-1">{getTypeIcon(opportunity.category)}</span>
            {opportunity.category.replace('-', ' ')}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {opportunity.confidence} confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Projected Impact */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Revenue Impact</p>
              <p className="font-semibold text-green-600">
                +{formatCurrency(opportunity.projectedImpact.revenue)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Traffic Increase</p>
              <p className="font-semibold text-blue-600">
                +{opportunity.projectedImpact.traffic} visits
              </p>
            </div>
          </div>

          {/* Score Factors */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-700">Score Breakdown</p>
            <div className="space-y-1">
              {Object.entries(opportunity.factors).map(([key, value]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                  </span>
                  <span className="font-medium">{value}/100</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {opportunity.recommendations.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-700">Key Actions</p>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {opportunity.recommendations.slice(0, 2).map((rec, idx) => (
                  <li key={idx} className="flex items-start">
                    <ChevronRight className="w-3 h-3 mr-1 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center pt-2 border-t">
            <div className="text-xs text-gray-500">
              <Package className="w-3 h-3 inline mr-1" />
              {opportunity.productCount} products
            </div>
            <div className="text-xs text-gray-500">
              <Clock className="w-3 h-3 inline mr-1" />
              {opportunity.projectedImpact.timeline} days
            </div>
          </div>

          <Link href={`/dashboard/taxonomy?node=${opportunity.nodeId}`}>
            <Button variant="outline" size="sm" className="w-full">
              View Category
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
