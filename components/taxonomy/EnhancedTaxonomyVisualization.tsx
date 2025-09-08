'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  SearchIcon,
  FilterIcon,
  HomeIcon,
  ChevronRightIcon,
  LayoutGrid,
  GitBranch,
  Network,
  Download,
  Settings,
} from 'lucide-react';
import { ProductCard } from './ProductCard';
import { CategoryCard } from './CategoryCard';
import { TaxonomyEmptyState } from './TaxonomyEmptyState';
import type { TaxonomyNode, TaxonomyLink } from '@/components/taxonomy/D3Visualization';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface TaxonomyVisualizationProps {
  data: {
    nodes: TaxonomyNode[];
    links: TaxonomyLink[];
  };
  shoppingData?: Map<string, any>;
  opportunityScores?: Map<string, any>;
  recommendations?: Map<string, any[]>;
}

type ViewMode = 'cards' | 'tree' | 'graph';
type FilterStatus = 'all' | 'optimized' | 'outdated' | 'missing' | 'noContent';

interface BreadcrumbItem {
  id: string;
  title: string;
}

export function EnhancedTaxonomyVisualization({
  data,
  shoppingData = new Map(),
  opportunityScores = new Map(),
  recommendations = new Map(),
}: TaxonomyVisualizationProps) {
  const router = useRouter();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 'root', title: 'Home' }]);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState(1);

  // Check if we have data or need to show empty state
  const hasData = data.nodes.length > 0;
  const hasRequiredDataSources = checkDataSources();

  function checkDataSources() {
    // Check if we have the minimum required data
    // In real app, this would check actual data source connections
    return data.nodes.some((n) => n.traffic || n.revenue || n.skuCount);
  }

  // Handle onboarding CTA
  const handleGetStarted = () => {
    router.push('/dashboard/import');
  };

  // Show empty state if no data
  if (!hasData || !hasRequiredDataSources) {
    return <TaxonomyEmptyState onGetStarted={handleGetStarted} />;
  }

  // Determine if a node is a product or category
  // Products have isProduct flag or are actual product nodes, not just deep categories
  const isProduct = (node: TaxonomyNode) => {
    // Check if this is actually a product node (has product-specific fields)
    // or if it's marked as a product
    return (node as any).isProduct === true || 
           (node as any).price !== undefined ||
           (node as any).brand !== undefined;
  };
  
  // Check if a category node is a leaf (has no children)
  const isLeafCategory = (node: TaxonomyNode) => {
    const children = data.nodes.filter((n) =>
      data.links.some((l) => l.source === node.id && l.target === n.id)
    );
    return children.length === 0;
  };

  // Calculate metrics for categories
  const calculateCategoryMetrics = (node: TaxonomyNode) => {
    const children = data.nodes.filter((n) =>
      data.links.some((l) => l.source === node.id && l.target === n.id)
    );

    let totalProducts = 0;
    let optimizedProducts = 0;
    let totalTraffic = 0;
    let totalRevenue = 0;

    // Recursively calculate metrics
    const processNode = (n: TaxonomyNode) => {
      if (isProduct(n)) {
        totalProducts++;
        if (n.status === 'optimized') optimizedProducts++;
        totalTraffic += n.traffic || 0;
        totalRevenue += n.revenue || 0;
      }

      const nodeChildren = data.nodes.filter((child) =>
        data.links.some((l) => l.source === n.id && l.target === child.id)
      );
      nodeChildren.forEach(processNode);
    };

    children.forEach(processNode);

    return {
      totalProducts,
      optimizedProducts,
      totalTraffic,
      totalRevenue,
      avgOpportunityScore: calculateAvgScore(children),
      healthScore: calculateHealthScore(node),
    };
  };

  const calculateAvgScore = (nodes: TaxonomyNode[]) => {
    const scores = nodes
      .map((n) => opportunityScores.get(n.id)?.value)
      .filter((s) => s !== undefined);

    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const calculateHealthScore = (node: TaxonomyNode): number => {
    let score = 0;

    switch (node.status) {
      case 'optimized':
        score += 40;
        break;
      case 'outdated':
        score += 20;
        break;
      case 'missing':
        score += 5;
        break;
      case 'noContent':
        score += 0;
        break;
      default:
        score += 10;
    }

    if (node.skuCount && node.skuCount > 0) {
      score += Math.min(30, Math.log10(node.skuCount) * 10);
    }

    if (node.traffic && node.traffic > 0) {
      score += Math.min(15, Math.log10(node.traffic) * 5);
    }
    if (node.revenue && node.revenue > 0) {
      score += Math.min(15, Math.log10(node.revenue) * 5);
    }

    return Math.round(score);
  };

  // Filter nodes based on current filters
  const filteredNodes = useMemo(() => {
    let filtered = data.nodes;

    if (filterStatus !== 'all') {
      filtered = filtered.filter((node) => node.status === filterStatus);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (node) =>
          node.title.toLowerCase().includes(query) ||
          node.id.toLowerCase().includes(query) ||
          node.url?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [data.nodes, filterStatus, searchQuery]);

  // Get current level nodes based on breadcrumbs
  const currentLevelNodes = useMemo(() => {
    const currentParentId = breadcrumbs[breadcrumbs.length - 1]?.id;

    if (currentParentId === 'root') {
      return filteredNodes.filter((node) => node.depth === 1);
    } else {
      return filteredNodes.filter((node) =>
        data.links.some((l) => l.source === currentParentId && l.target === node.id)
      );
    }
  }, [filteredNodes, breadcrumbs, data.links]);

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
  };

  const handleNodeExpand = (nodeId: string) => {
    const node = data.nodes.find((n) => n.id === nodeId);
    if (node) {
      setBreadcrumbs([...breadcrumbs, { id: node.id, title: node.title }]);
    }
  };

  const handleBulkSelect = (nodeId: string) => {
    const newSelected = new Set(selectedForBulk);
    if (newSelected.has(nodeId)) {
      newSelected.delete(nodeId);
    } else {
      newSelected.add(nodeId);
    }
    setSelectedForBulk(newSelected);
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setSelectedNodeId(null);
  };

  // Mock content metrics for products
  const getContentMetrics = (node: TaxonomyNode) => {
    if (!isProduct(node)) return undefined;

    return {
      description: {
        currentLength: Math.floor(Math.random() * 500),
        recommendedLength: 500,
        quality: ['poor', 'fair', 'good', 'excellent'][Math.floor(Math.random() * 4)] as any,
      },
      images: {
        count: Math.floor(Math.random() * 8),
        recommended: 8,
      },
      specifications: {
        filledFields: Math.floor(Math.random() * 20),
        totalFields: 20,
      },
      schema: {
        isValid: Math.random() > 0.3,
      },
    };
  };

  // Mock revenue projections
  const getRevenueProjection = (node: TaxonomyNode) => {
    const score = opportunityScores.get(node.id);
    if (!score || score.value < 3) return undefined;

    const baseRevenue = node.revenue || 0;
    return {
      current: baseRevenue,
      realistic: baseRevenue * (1 + score.value * 0.1),
      optimistic: baseRevenue * (1 + score.value * 0.2),
    };
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header with Breadcrumbs and Controls */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                {index > 0 && <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors',
                    index === breadcrumbs.length - 1
                      ? 'text-gray-900 font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {index === 0 && <HomeIcon className="w-4 h-4" />}
                  <span>{crumb.title}</span>
                </button>
              </React.Fragment>
            ))}
          </nav>

          {/* View Controls */}
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  viewMode === 'cards'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                Cards
              </button>
              <button
                onClick={() => setViewMode('tree')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  viewMode === 'tree'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <GitBranch className="w-4 h-4" />
                Tree
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  viewMode === 'graph'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Network className="w-4 h-4" />
                Graph
              </button>
            </div>

            <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products and categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-gray-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="optimized">Optimized</option>
              <option value="outdated">Outdated</option>
              <option value="missing">Missing</option>
              <option value="noContent">No Content</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Operations Bar */}
      {selectedForBulk.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedForBulk.size} items selected
              </span>
              <button
                onClick={() => setSelectedForBulk(new Set())}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                Optimize Selected
              </button>
              <button className="px-3 py-1 bg-white border border-blue-200 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-50">
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: currentLevelNodes.some((n) => isProduct(n))
              ? 'repeat(auto-fill, minmax(240px, 1fr))'
              : 'repeat(auto-fill, minmax(320px, 1fr))',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top left',
          }}
        >
          {currentLevelNodes.map((node) => {
            if (isProduct(node)) {
              return (
                <ProductCard
                  key={node.id}
                  node={{ ...node, depth: node.depth || 0 }}
                  shoppingData={shoppingData.get(node.id)}
                  contentMetrics={getContentMetrics(node)}
                  opportunityScore={opportunityScores.get(node.id)}
                  revenueProjection={getRevenueProjection(node)}
                  recommendations={recommendations.get(node.id)}
                  onSelect={handleNodeSelect}
                  onBulkSelect={handleBulkSelect}
                  isSelected={selectedForBulk.has(node.id)}
                />
              );
            } else {
              const metrics = calculateCategoryMetrics(node);
              return (
                <CategoryCard
                  key={node.id}
                  node={{
                    ...node,
                    depth: node.depth || 0,
                    children: data.nodes
                      .filter((n) =>
                        data.links.some((l) => l.source === node.id && l.target === n.id)
                      )
                      .map((n) => n.id),
                    metrics,
                    status:
                      metrics.healthScore >= 80
                        ? 'optimized'
                        : metrics.healthScore >= 60
                          ? 'needs-attention'
                          : 'critical',
                    trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
                  }}
                  opportunityScore={metrics.avgOpportunityScore}
                  revenueProjection={metrics.totalRevenue * 0.2}
                  priorityActions={Math.floor(Math.random() * 5)}
                  onSelect={handleNodeSelect}
                  onExpand={handleNodeExpand}
                />
              );
            }
          })}
        </div>

        {currentLevelNodes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="text-lg font-medium">No items found</p>
            <p className="text-sm mt-2">Try adjusting your filters or search query</p>
          </div>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-white rounded-lg shadow-lg p-2">
        <button
          onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
        >
          −
        </button>
        <span className="text-sm font-medium text-gray-700 min-w-[50px] text-center">
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}
          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
        >
          +
        </button>
        <button
          onClick={() => setZoomLevel(1)}
          className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
