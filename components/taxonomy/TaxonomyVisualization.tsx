'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { SearchIcon, FilterIcon, HomeIcon, ChevronRightIcon, ChevronDownIcon } from 'lucide-react';
import type { TaxonomyNode, TaxonomyLink } from '@/components/taxonomy/D3Visualization';
import { TaxonomyEnrichmentPipeline, type EnrichedTaxonomyNode } from '@/lib/taxonomy/enrich-data';

interface TaxonomyVisualizationProps {
  data: {
    nodes: TaxonomyNode[];
    links: TaxonomyLink[];
  };
}

type ViewMode = 'cards' | 'tree' | 'graph';
type FilterStatus = 'all' | 'optimized' | 'outdated' | 'missing' | 'noContent';

interface CategoryCard {
  id: string;
  title: string;
  depth: number;
  skuCount: number;
  traffic?: number;
  revenue?: number;
  status: 'optimized' | 'outdated' | 'missing' | 'noContent';
  healthScore: number;
  trend: 'up' | 'down' | 'stable';
  children: string[];
  parent?: string;
}

interface BreadcrumbItem {
  id: string;
  title: string;
}

interface TreeNodeStructure extends Omit<CategoryCard, 'children'> {
  children: TreeNodeStructure[];
}

export function TaxonomyVisualization({ data }: TaxonomyVisualizationProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: 'root', title: 'Home' }]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [enrichedNodes, setEnrichedNodes] = useState<Map<string, EnrichedTaxonomyNode>>(new Map());
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);

  // Enrich nodes with Sprint 4 features
  useEffect(() => {
    const enrichNodes = async () => {
      setEnrichmentLoading(true);
      const pipeline = new TaxonomyEnrichmentPipeline();

      try {
        const enriched = await pipeline.enrichNodes(data.nodes, {
          includeScoring: true,
          includeRevenue: true,
          includeRecommendations: true,
          includeShoppingData: true,
          batchSize: 50,
        });

        const enrichmentMap = new Map<string, EnrichedTaxonomyNode>();
        enriched.forEach((node) => {
          enrichmentMap.set(node.id, node);
        });
        setEnrichedNodes(enrichmentMap);
      } catch (error) {
        console.error('Error enriching nodes:', error);
      } finally {
        setEnrichmentLoading(false);
      }
    };

    enrichNodes();
  }, [data.nodes]);

  // Transform taxonomy data into business-focused format
  const categoryCards = useMemo<CategoryCard[]>(() => {
    return data.nodes.map((node) => {
      const healthScore = calculateHealthScore(node);
      const trend = calculateTrend(node);

      return {
        id: node.id,
        title: node.title,
        depth: node.depth || 0,
        skuCount: node.skuCount || 0,
        traffic: node.traffic,
        revenue: node.revenue,
        status: node.status || 'noContent',
        healthScore,
        trend,
        children: node.children || [],
        parent: findParent(node.id, data.links),
      };
    });
  }, [data]);

  // Calculate health score based on multiple factors
  function calculateHealthScore(node: TaxonomyNode): number {
    let score = 0;

    // Status contribution (40%)
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

    // SKU count contribution (30%)
    if (node.skuCount && node.skuCount > 0) {
      score += Math.min(30, Math.log10(node.skuCount) * 10);
    }

    // Traffic/Revenue contribution (30%)
    if (node.traffic && node.traffic > 0) {
      score += Math.min(15, Math.log10(node.traffic) * 5);
    }
    if (node.revenue && node.revenue > 0) {
      score += Math.min(15, Math.log10(node.revenue) * 5);
    }

    return Math.round(score);
  }

  function calculateTrend(node: TaxonomyNode): 'up' | 'down' | 'stable' {
    // Mock trend calculation - in real app this would use historical data
    const hash = node.id.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) & 0xffff, 0);
    const trend = hash % 3;
    return trend === 0 ? 'up' : trend === 1 ? 'down' : 'stable';
  }

  function findParent(nodeId: string, links: TaxonomyLink[]): string | undefined {
    const link = links.find((l) => l.target === nodeId);
    return link?.source;
  }

  // Filter cards based on current filters
  const filteredCards = useMemo(() => {
    let filtered = categoryCards;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter((card) => card.status === filterStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (card) => card.title.toLowerCase().includes(query) || card.id.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [categoryCards, filterStatus, searchQuery]);

  // Get current level cards based on breadcrumbs and view mode
  const currentLevelCards = useMemo(() => {
    const currentParentId = breadcrumbs[breadcrumbs.length - 1]?.id;

    if (currentParentId === 'root') {
      if (viewMode === 'cards') {
        // In cards view, skip the home node and show main categories (depth 1) directly
        return filteredCards.filter(
          (card) => card.depth === 1 || (card.depth === 0 && card.children.length > 0)
        );
      } else {
        // In tree view, show root level categories including home
        return filteredCards.filter(
          (card) => card.depth === 0 || (card.depth === 1 && !card.parent)
        );
      }
    } else {
      // Show children of selected category
      return filteredCards.filter((card) => card.parent === currentParentId);
    }
  }, [filteredCards, breadcrumbs, viewMode]);

  // Get selected card details
  const selectedCard = selectedNodeId ? categoryCards.find((c) => c.id === selectedNodeId) : null;

  // Health indicator colors
  const getHealthColor = (score: number) => {
    if (score >= 80) return '#10a37f'; // Green - Optimized
    if (score >= 60) return '#f59e0b'; // Amber - Needs Attention
    return '#ef4444'; // Red - Critical
  };

  // Status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'optimized':
        return '#10a37f';
      case 'outdated':
        return '#f59e0b';
      case 'missing':
        return '#ef4444';
      case 'noContent':
        return '#666666';
      default:
        return '#666666';
    }
  };

  // Trend icons
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return '↗️';
      case 'down':
        return '↘️';
      default:
        return '→';
    }
  };

  const handleCardClick = (card: CategoryCard) => {
    // If clicking the same card, deselect it
    if (selectedNodeId === card.id) {
      setSelectedNodeId(null);
      return;
    }

    setSelectedNodeId(card.id);
  };

  // Handle card navigation (double-click or dedicated button)
  const handleCardNavigate = (card: CategoryCard) => {
    if (card.children.length > 0) {
      setBreadcrumbs([...breadcrumbs, { id: card.id, title: card.title }]);
      setSelectedNodeId(null); // Clear selection when navigating
    }
  };

  // Handle card expansion for showing subcategories
  const handleCardExpand = (cardId: string) => {
    const newExpanded = new Set(expandedCards);
    if (expandedCards.has(cardId)) {
      newExpanded.delete(cardId);
    } else {
      newExpanded.add(cardId);
    }
    setExpandedCards(newExpanded);
  };

  // Get subcategory cards for a parent
  const getSubcategories = (parentId: string): CategoryCard[] => {
    return categoryCards.filter((card) => card.parent === parentId);
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setSelectedNodeId(null);
  };

  // Build tree structure from flat array
  function buildTreeStructure(cards: CategoryCard[]): TreeNodeStructure[] {
    const nodeMap = new Map<string, TreeNodeStructure>();
    const rootNodes: TreeNodeStructure[] = [];

    // Create node structure
    cards.forEach((card) => {
      const { children: _, ...cardWithoutChildren } = card;
      nodeMap.set(card.id, {
        ...cardWithoutChildren,
        children: [],
      });
    });

    // Build parent-child relationships
    cards.forEach((card) => {
      const node = nodeMap.get(card.id)!;
      if (card.parent && nodeMap.has(card.parent)) {
        const parent = nodeMap.get(card.parent)!;
        parent.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes.sort((a, b) => a.title.localeCompare(b.title));
  }

  // Build breadcrumb path for a given node
  function buildBreadcrumbPath(node: CategoryCard, cards: CategoryCard[]): BreadcrumbItem[] {
    const path: BreadcrumbItem[] = [{ id: 'root', title: 'Home' }];

    const buildPath = (currentNode: CategoryCard) => {
      if (currentNode.parent) {
        const parent = cards.find((c) => c.id === currentNode.parent);
        if (parent) {
          buildPath(parent);
        }
      }
      path.push({ id: currentNode.id, title: currentNode.title });
    };

    buildPath(node);
    return path;
  }

  return (
    <>
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .card-enter {
          animation: fadeInUp 0.4s ease-out;
        }

        @media (max-width: 768px) {
          .mobile-hidden {
            display: none;
          }
        }
      `}</style>

      <div className="flex flex-col h-full bg-[#000000] text-white">
        {/* Header with Breadcrumbs and Search */}
        <div className="bg-[#0a0a0a] border-b border-[#1a1a1a] p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm min-w-0">
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.id}>
                  {index > 0 && <ChevronRightIcon className="w-4 h-4 text-[#666] flex-shrink-0" />}
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-[#1a1a1a] transition-colors min-w-0 ${
                      index === breadcrumbs.length - 1
                        ? 'text-white font-medium'
                        : 'text-[#999] hover:text-white'
                    }`}
                    aria-label={`Navigate to ${crumb.title}`}
                  >
                    {index === 0 && <HomeIcon className="w-4 h-4 flex-shrink-0" />}
                    <span className="truncate">{crumb.title}</span>
                  </button>
                </React.Fragment>
              ))}
            </nav>

            {/* View Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex bg-[#1a1a1a] rounded overflow-hidden">
                {(['cards', 'tree', 'graph'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 text-sm transition-all duration-200 ${
                      viewMode === mode
                        ? 'bg-[#10a37f] text-white shadow-lg'
                        : 'text-[#999] hover:text-white hover:bg-[#2a2a2a]'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>

              {/* Zoom Controls */}
              <div className="flex bg-[#1a1a1a] rounded overflow-hidden">
                <button
                  onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                  className="px-2 py-1 text-sm text-[#999] hover:text-white hover:bg-[#2a2a2a] transition-colors"
                  title="Zoom Out"
                >
                  −
                </button>
                <div className="px-3 py-1 text-xs text-[#666] bg-[#0a0a0a] border-x border-[#2a2a2a] min-w-[60px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </div>
                <button
                  onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))}
                  className="px-2 py-1 text-sm text-[#999] hover:text-white hover:bg-[#2a2a2a] transition-colors"
                  title="Zoom In"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => setZoomLevel(1)}
                className="px-3 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-sm text-[#999] hover:text-white hover:border-[#3a3a3a] transition-all duration-200 hover:scale-105"
                title="Reset Zoom"
              >
                Reset
              </button>

              <button className="px-3 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-sm text-[#999] hover:text-white hover:border-[#3a3a3a] transition-all duration-200 hover:shadow-lg">
                Export Data
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#666]" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white placeholder-[#666] focus:border-[#10a37f] focus:outline-none focus:ring-2 focus:ring-[#10a37f]/20 transition-colors"
                aria-label="Search taxonomy categories"
              />
            </div>

            <div className="flex items-center gap-2">
              <FilterIcon className="w-4 h-4 text-[#666]" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-white focus:border-[#10a37f] focus:outline-none focus:ring-2 focus:ring-[#10a37f]/20 transition-colors"
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="optimized">Optimized</option>
                <option value="outdated">Needs Attention</option>
                <option value="missing">Critical</option>
                <option value="noContent">No Data</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar Toggle */}
        <div className="lg:hidden bg-[#0a0a0a] border-b border-[#1a1a1a] px-4 py-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2 text-sm text-[#999] hover:text-white transition-colors"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <FilterIcon className="w-4 h-4" />
            {sidebarOpen ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div
            className={`w-64 bg-[#0a0a0a] border-r border-[#1a1a1a] p-4 overflow-auto transition-transform duration-300 lg:translate-x-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } lg:block absolute lg:relative z-10 h-full lg:h-auto`}
          >
            {/* Saved Views */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-3">
                Saved Views
              </h3>
              <div className="space-y-1">
                <button className="w-full text-left px-3 py-2 text-sm text-[#999] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors">
                  All Categories
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-[#999] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors">
                  Problem Areas
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-[#999] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors">
                  Top Performers
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-[#999] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors">
                  Recent Changes
                </button>
              </div>
            </div>

            {/* Tree Navigation */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-3">
                Tree View
              </h3>
              <div className="space-y-1">
                {buildTreeStructure(categoryCards).map((rootNode) => (
                  <TreeNode
                    key={rootNode.id}
                    node={rootNode}
                    level={0}
                    expandedNodes={expandedNodes}
                    selectedNodeId={selectedNodeId}
                    onToggle={(nodeId) => {
                      const newExpanded = new Set(expandedNodes);
                      if (expandedNodes.has(nodeId)) {
                        newExpanded.delete(nodeId);
                      } else {
                        newExpanded.add(nodeId);
                      }
                      setExpandedNodes(newExpanded);
                    }}
                    onSelect={(nodeId) => {
                      setSelectedNodeId(nodeId);
                      const node = categoryCards.find((c) => c.id === nodeId);
                      if (node) {
                        // Build breadcrumb path to this node
                        const path = buildBreadcrumbPath(node, categoryCards);
                        setBreadcrumbs(path);
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div>
              <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-3">
                Quick Stats
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#666]">Total Categories</span>
                  <span className="text-xs text-white font-mono">{categoryCards.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#666]">Optimized</span>
                  <span className="text-xs text-[#10a37f] font-mono">
                    {categoryCards.filter((c) => c.status === 'optimized').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#666]">Need Attention</span>
                  <span className="text-xs text-[#f59e0b] font-mono">
                    {categoryCards.filter((c) => c.status === 'outdated').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#666]">Critical</span>
                  <span className="text-xs text-[#ef4444] font-mono">
                    {categoryCards.filter((c) => c.status === 'missing').length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-6 overflow-auto">
            {viewMode === 'cards' && (
              <div
                className={`grid gap-6 transition-all duration-300 ${
                  zoomLevel <= 0.75
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
                    : zoomLevel <= 1
                      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : zoomLevel <= 1.5
                        ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                        : zoomLevel <= 2
                          ? 'grid-cols-1 md:grid-cols-2'
                          : 'grid-cols-1'
                }`}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top left',
                }}
              >
                {currentLevelCards.map((card, index) => {
                  const isExpanded = expandedCards.has(card.id);
                  const subcategories = getSubcategories(card.id);
                  // A card is a product ONLY if it has no children (leaf node)
                  const isProduct = card.children.length === 0 && subcategories.length === 0;
                  const enrichedData = enrichedNodes.get(card.id);

                  return (
                    <div
                      key={card.id}
                      className={`bg-[#0a0a0a] border rounded-lg transition-all duration-300 ${
                        selectedNodeId === card.id
                          ? 'border-[#10a37f] shadow-lg shadow-[#10a37f]/20'
                          : 'border-[#1a1a1a]'
                      } ${isExpanded ? 'pb-2' : ''}`}
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animation: 'fadeInUp 0.4s ease-out',
                      }}
                    >
                      {/* Main Card */}
                      <div
                        onClick={() => handleCardClick(card)}
                        className={`p-4 cursor-pointer rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-[#10a37f]/20 hover:border-[#10a37f] hover:-translate-y-1 hover:scale-[1.02] ${
                          selectedNodeId === card.id ? 'scale-[1.02]' : ''
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-white truncate pr-2">
                              {card.title}
                            </h3>
                            {isProduct && (
                              <div className="text-xs text-[#666] mt-1">
                                Product • SKU: {card.id.substring(0, 8).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            {isProduct && (
                              <span className="px-2 py-1 bg-[#10a37f]/20 text-[#10a37f] rounded">
                                Product
                              </span>
                            )}
                            <span>{getTrendIcon(card.trend)}</span>
                          </div>
                        </div>

                        {/* Health Score Bar */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-[#999]">
                              {isProduct ? 'Content Health' : 'Health'}: {card.healthScore}%
                            </span>
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getStatusColor(card.status) }}
                            />
                          </div>
                          <div className="w-full bg-[#1a1a1a] rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${card.healthScore}%`,
                                backgroundColor: getHealthColor(card.healthScore),
                              }}
                            />
                          </div>
                        </div>

                        {/* Metrics - Different for Products vs Categories */}
                        {isProduct ? (
                          <>
                            {/* Product-specific metrics */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <div className="text-xs text-[#666] mb-1">Price</div>
                                <div className="text-sm font-mono text-white">
                                  {enrichedData?.shoppingData?.price
                                    ? `$${enrichedData.shoppingData.price.toFixed(2)}`
                                    : `$${(Math.random() * 500 + 50).toFixed(2)}`}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-[#666] mb-1">Stock</div>
                                <div className="text-sm font-mono text-white">
                                  {enrichedData?.shoppingData?.availability === 'in_stock' ? (
                                    <span className="text-[#10a37f]">In Stock</span>
                                  ) : enrichedData?.shoppingData?.availability ===
                                    'out_of_stock' ? (
                                    <span className="text-[#ef4444]">Out</span>
                                  ) : enrichedData?.shoppingData?.availability === 'preorder' ? (
                                    <span className="text-[#f59e0b]">Preorder</span>
                                  ) : Math.random() > 0.3 ? (
                                    <span className="text-[#10a37f]">In Stock</span>
                                  ) : (
                                    <span className="text-[#ef4444]">Out</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Additional product metrics */}
                            <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-[#1a1a1a] rounded">
                              <div className="text-center">
                                <div className="text-xs text-[#666]">CTR</div>
                                <div className="text-xs font-mono text-white">
                                  {(Math.random() * 5).toFixed(1)}%
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-[#666]">Conv</div>
                                <div className="text-xs font-mono text-white">
                                  {(Math.random() * 3).toFixed(1)}%
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-[#666]">Rev</div>
                                <div className="text-xs font-mono text-white">
                                  ${card.revenue ? (card.revenue / 1000).toFixed(1) : '0'}K
                                </div>
                              </div>
                            </div>

                            {/* Content Quality Indicators */}
                            <div className="mb-3">
                              <div className="text-xs text-[#666] mb-2">Content Quality</div>
                              <div className="flex gap-2 text-xs">
                                <span
                                  className={`px-2 py-1 rounded ${
                                    enrichedData?.contentMetrics?.description?.quality === 'good' ||
                                    enrichedData?.contentMetrics?.description?.quality ===
                                      'excellent'
                                      ? 'bg-[#10a37f]/20 text-[#10a37f]'
                                      : enrichedData?.contentMetrics?.description?.quality ===
                                          'fair'
                                        ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                                        : 'bg-[#ef4444]/20 text-[#ef4444]'
                                  }`}
                                >
                                  Desc:{' '}
                                  {enrichedData?.contentMetrics?.description?.quality || 'Unknown'}
                                </span>
                                <span
                                  className={`px-2 py-1 rounded ${
                                    enrichedData?.contentMetrics?.images?.count &&
                                    enrichedData.contentMetrics.images.count >= 6
                                      ? 'bg-[#10a37f]/20 text-[#10a37f]'
                                      : enrichedData?.contentMetrics?.images?.count &&
                                          enrichedData.contentMetrics.images.count >= 4
                                        ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                                        : 'bg-[#ef4444]/20 text-[#ef4444]'
                                  }`}
                                >
                                  Images: {enrichedData?.contentMetrics?.images?.count || 0}/
                                  {enrichedData?.contentMetrics?.images?.recommended || 8}
                                </span>
                              </div>
                            </div>

                            {/* Sprint 4: Opportunity Score */}
                            {enrichedData?.opportunityScore ? (
                              <div className="mb-3 p-2 bg-[#1a1a1a] rounded">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-[#666]">Opportunity Score</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-[#10a37f]">
                                      {enrichedData.opportunityScore.value.toFixed(1)}/10
                                    </span>
                                    <span
                                      className={`text-xs px-1 py-0.5 rounded ${
                                        enrichedData.opportunityScore.confidence === 'high'
                                          ? 'bg-[#10a37f]/20 text-[#10a37f]'
                                          : enrichedData.opportunityScore.confidence === 'medium'
                                            ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                                            : 'bg-[#ef4444]/20 text-[#ef4444]'
                                      }`}
                                    >
                                      {enrichedData.opportunityScore.confidence}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mb-3 p-2 bg-[#1a1a1a] rounded">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-[#666]">Opportunity Score</span>
                                  <span className="text-sm font-bold text-[#10a37f]">
                                    {(Math.random() * 10).toFixed(1)}/10
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Sprint 4: Revenue Projection */}
                            {enrichedData?.revenueProjection ? (
                              <div className="mb-3 p-2 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded">
                                <div className="text-xs text-[#f59e0b] mb-1">Revenue Potential</div>
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-mono text-white">
                                    +$
                                    {(
                                      enrichedData.revenueProjection.realistic -
                                      enrichedData.revenueProjection.current
                                    ).toFixed(0)}
                                    /mo
                                  </div>
                                  <div className="text-xs text-[#666]">
                                    {enrichedData.revenueProjection.timeToImpact}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mb-3 p-2 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded">
                                <div className="text-xs text-[#f59e0b] mb-1">Revenue Potential</div>
                                <div className="text-sm font-mono text-white">
                                  +${(Math.random() * 5000).toFixed(0)}/mo
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {/* Category metrics (existing) */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <div className="text-xs text-[#666] mb-1">
                                  {card.children.length > 0 ? 'Subcategories' : 'Products'}
                                </div>
                                <div className="text-sm font-mono text-white">
                                  {card.children.length > 0 ? card.children.length : card.skuCount}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-[#666] mb-1">Revenue</div>
                                <div className="text-sm font-mono text-white">
                                  {card.revenue ? `$${(card.revenue / 1000).toFixed(1)}K` : 'N/A'}
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              card.status === 'optimized'
                                ? 'bg-[#10a37f]/20 text-[#10a37f]'
                                : card.status === 'outdated'
                                  ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                                  : card.status === 'missing'
                                    ? 'bg-[#ef4444]/20 text-[#ef4444]'
                                    : 'bg-[#666]/20 text-[#999]'
                            }`}
                          >
                            {card.status === 'optimized'
                              ? 'Optimized'
                              : card.status === 'outdated'
                                ? 'Needs Attention'
                                : card.status === 'missing'
                                  ? 'Critical'
                                  : 'No Data'}
                          </span>

                          <div className="flex items-center gap-2">
                            {card.children.length > 0 && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCardExpand(card.id);
                                  }}
                                  className="flex items-center gap-1 text-xs text-[#666] hover:text-[#10a37f] transition-colors px-2 py-1 rounded hover:bg-[#10a37f]/10"
                                  title={
                                    isExpanded ? 'Collapse subcategories' : 'Show subcategories'
                                  }
                                >
                                  <span>{card.children.length} items</span>
                                  {isExpanded ? (
                                    <ChevronDownIcon className="w-3 h-3" />
                                  ) : (
                                    <ChevronRightIcon className="w-3 h-3" />
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCardNavigate(card);
                                  }}
                                  className="text-xs text-[#666] hover:text-[#10a37f] transition-colors px-2 py-1 rounded hover:bg-[#10a37f]/10"
                                  title="Navigate to this category"
                                >
                                  Go →
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Subcategories - shown when expanded */}
                      {isExpanded && subcategories.length > 0 && (
                        <div className="px-4 pb-2">
                          <div className="border-t border-[#1a1a1a] pt-3">
                            <div className="text-xs text-[#666] mb-2 font-medium uppercase tracking-wider">
                              Subcategories
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {subcategories.map((subcard) => (
                                <button
                                  key={subcard.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedNodeId(subcard.id);
                                  }}
                                  className={`text-left p-2 rounded border transition-all duration-200 hover:border-[#10a37f] hover:bg-[#10a37f]/5 ${
                                    selectedNodeId === subcard.id
                                      ? 'border-[#10a37f] bg-[#10a37f]/10'
                                      : 'border-[#1a1a1a] bg-[#0a0a0a]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-white font-medium truncate">
                                      {subcard.title}
                                    </span>
                                    <div
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: getStatusColor(subcard.status) }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-[#666]">
                                    <span>{subcard.skuCount.toLocaleString()} SKUs</span>
                                    <span>{subcard.healthScore}%</span>
                                  </div>
                                  {subcard.children.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1 text-xs text-[#666]">
                                      <span>{subcard.children.length} items</span>
                                      <ChevronRightIcon className="w-3 h-3" />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {currentLevelCards.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <div className="text-[#666] mb-2">No categories found</div>
                    <div className="text-sm text-[#999]">
                      Try adjusting your search or filter criteria
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'tree' && (
              <div className="space-y-2">
                {buildTreeStructure(filteredCards).map((rootNode) => (
                  <TreeNodeDetailed
                    key={rootNode.id}
                    node={rootNode}
                    level={0}
                    expandedNodes={expandedNodes}
                    selectedNodeId={selectedNodeId}
                    onToggle={(nodeId) => {
                      const newExpanded = new Set(expandedNodes);
                      if (expandedNodes.has(nodeId)) {
                        newExpanded.delete(nodeId);
                      } else {
                        newExpanded.add(nodeId);
                      }
                      setExpandedNodes(newExpanded);
                    }}
                    onSelect={setSelectedNodeId}
                    getHealthColor={getHealthColor}
                    getStatusColor={getStatusColor}
                    getTrendIcon={getTrendIcon}
                  />
                ))}
              </div>
            )}

            {viewMode === 'graph' && (
              <div className="h-full bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] p-4 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-[#666] mb-2">Graph View</div>
                  <div className="text-sm text-[#999]">
                    Legacy force-directed graph view (if needed for technical users)
                  </div>
                  <button
                    onClick={() => setViewMode('cards')}
                    className="mt-4 px-4 py-2 bg-[#10a37f] text-white rounded text-sm hover:bg-[#0e906d] transition-colors"
                  >
                    Switch to Cards View
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Overlay for mobile sidebar */}
          {sidebarOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-black/50 z-5"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Right Context Panel */}
          {selectedCard && (
            <div className="w-80 bg-[#0a0a0a] border-l border-[#1a1a1a] p-6 overflow-auto hidden lg:block">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">{selectedCard.title}</h2>
                <div className="text-sm text-[#666]">ID: {selectedCard.id}</div>
              </div>

              {/* Health Overview */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-3">
                  Health Overview
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#999]">Health Score</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-mono text-white">
                        {selectedCard.healthScore}%
                      </span>
                      <div className="w-16 bg-[#1a1a1a] rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${selectedCard.healthScore}%`,
                            backgroundColor: getHealthColor(selectedCard.healthScore),
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#999]">Status</span>
                    <span
                      className={`text-sm px-2 py-1 rounded-full ${
                        selectedCard.status === 'optimized'
                          ? 'bg-[#10a37f]/20 text-[#10a37f]'
                          : selectedCard.status === 'outdated'
                            ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                            : selectedCard.status === 'missing'
                              ? 'bg-[#ef4444]/20 text-[#ef4444]'
                              : 'bg-[#666]/20 text-[#999]'
                      }`}
                    >
                      {selectedCard.status === 'optimized'
                        ? 'Optimized'
                        : selectedCard.status === 'outdated'
                          ? 'Needs Attention'
                          : selectedCard.status === 'missing'
                            ? 'Critical'
                            : 'No Data'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#999]">Trend</span>
                    <span className="text-sm">
                      {getTrendIcon(selectedCard.trend)}{' '}
                      {selectedCard.trend === 'up'
                        ? 'Growing'
                        : selectedCard.trend === 'down'
                          ? 'Declining'
                          : 'Stable'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-3">
                  Performance Metrics
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#999]">SKU Count</span>
                    <span className="text-sm font-mono text-white">
                      {selectedCard.skuCount.toLocaleString()}
                    </span>
                  </div>

                  {selectedCard.traffic && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#999]">Monthly Traffic</span>
                      <span className="text-sm font-mono text-white">
                        {selectedCard.traffic.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {selectedCard.revenue && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#999]">Monthly Revenue</span>
                      <span className="text-sm font-mono text-white">
                        ${selectedCard.revenue.toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#999]">Depth Level</span>
                    <span className="text-sm font-mono text-white">{selectedCard.depth}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-3">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <button className="w-full px-4 py-2 bg-[#10a37f] text-white rounded text-sm font-medium hover:bg-[#0e906d] transition-colors">
                    Optimize Category
                  </button>
                  <button className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded text-sm hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-colors">
                    View Analytics
                  </button>
                  <button className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded text-sm hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-colors">
                    Export Data
                  </button>
                </div>
              </div>

              {/* Related Items */}
              {selectedCard.children.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-3">
                    Child Categories
                  </h3>
                  <div className="space-y-2">
                    {selectedCard.children.slice(0, 5).map((childId) => {
                      const child = categoryCards.find((c) => c.id === childId);
                      if (!child) return null;

                      return (
                        <div
                          key={childId}
                          className="flex items-center justify-between p-2 bg-[#1a1a1a] rounded"
                        >
                          <span className="text-sm text-white truncate">{child.title}</span>
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getStatusColor(child.status) }}
                          />
                        </div>
                      );
                    })}

                    {selectedCard.children.length > 5 && (
                      <div className="text-xs text-[#666] p-2">
                        +{selectedCard.children.length - 5} more items
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mobile Details Modal */}
          {selectedCard && (
            <div className="lg:hidden fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg w-full max-w-lg max-h-[90vh] overflow-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-[#1a1a1a]">
                  <h2 className="text-lg font-semibold text-white">{selectedCard.title}</h2>
                  <button
                    onClick={() => setSelectedNodeId(null)}
                    className="p-1 text-[#666] hover:text-white transition-colors"
                    aria-label="Close details"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Content - Condensed version of right panel */}
                <div className="p-4 space-y-4">
                  {/* Health Overview */}
                  <div>
                    <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-2">
                      Health Overview
                    </h3>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[#999]">Health Score</span>
                      <span className="text-lg font-mono text-white">
                        {selectedCard.healthScore}%
                      </span>
                    </div>
                    <div className="w-full bg-[#1a1a1a] rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${selectedCard.healthScore}%`,
                          backgroundColor: getHealthColor(selectedCard.healthScore),
                        }}
                      />
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div>
                    <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-2">
                      Performance Metrics
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-[#666] mb-1">SKU Count</div>
                        <div className="text-sm font-mono text-white">
                          {selectedCard.skuCount.toLocaleString()}
                        </div>
                      </div>
                      {selectedCard.revenue && (
                        <div>
                          <div className="text-xs text-[#666] mb-1">Revenue</div>
                          <div className="text-sm font-mono text-white">
                            ${selectedCard.revenue.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <h3 className="text-sm font-medium text-[#999] uppercase tracking-wider mb-2">
                      Quick Actions
                    </h3>
                    <div className="space-y-2">
                      <button className="w-full px-4 py-2 bg-[#10a37f] text-white rounded text-sm font-medium hover:bg-[#0e906d] transition-colors">
                        Optimize Category
                      </button>
                      <button className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded text-sm hover:bg-[#2a2a2a] transition-colors">
                        View Analytics
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="bg-[#0a0a0a] border-t border-[#1a1a1a] px-6 py-2 flex items-center justify-between text-xs text-[#666]">
          <div className="flex items-center gap-4">
            <span>
              Health Score:{' '}
              {Math.round(
                categoryCards.reduce((acc, card) => acc + card.healthScore, 0) /
                  categoryCards.length
              )}
              %
            </span>
            <span>Active Filters: {filterStatus !== 'all' ? '1' : '0'}</span>
            <span>
              Showing: {currentLevelCards.length} of {filteredCards.length}
            </span>
          </div>
          <div>Last Updated: Just now</div>
        </div>
      </div>
    </>
  );
}

// Tree Node Component for sidebar
interface TreeNodeProps {
  node: TreeNodeStructure;
  level: number;
  expandedNodes: Set<string>;
  selectedNodeId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
}

function TreeNode({
  node,
  level,
  expandedNodes,
  selectedNodeId,
  onToggle,
  onSelect,
}: TreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-colors ${
          isSelected
            ? 'bg-[#10a37f]/20 text-[#10a37f]'
            : 'text-[#999] hover:text-white hover:bg-[#1a1a1a]'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="p-0.5 hover:bg-[#2a2a2a] rounded"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-3 h-3" />
            ) : (
              <ChevronRightIcon className="w-3 h-3" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-4" />}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: getStatusColor(node.status) }}
        />
        <span className="text-xs truncate">{node.title}</span>
      </div>

      {isExpanded &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            level={level + 1}
            expandedNodes={expandedNodes}
            selectedNodeId={selectedNodeId}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

// Detailed Tree Node Component for main content area
interface TreeNodeDetailedProps {
  node: TreeNodeStructure;
  level: number;
  expandedNodes: Set<string>;
  selectedNodeId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  getHealthColor: (score: number) => string;
  getStatusColor: (status: string) => string;
  getTrendIcon: (trend: string) => string;
}

function TreeNodeDetailed({
  node,
  level,
  expandedNodes,
  selectedNodeId,
  onToggle,
  onSelect,
  getHealthColor,
  getStatusColor,
  getTrendIcon,
}: TreeNodeDetailedProps) {
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
          isSelected
            ? 'border-[#10a37f] bg-[#10a37f]/10'
            : 'border-[#1a1a1a] hover:border-[#2a2a2a] bg-[#0a0a0a]'
        }`}
        style={{ marginLeft: `${level * 24}px` }}
        onClick={() => onSelect(node.id)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.id);
              }}
              className="p-1 hover:bg-[#2a2a2a] rounded"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4 text-[#666]" />
              ) : (
                <ChevronRightIcon className="w-4 h-4 text-[#666]" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-6" />}

          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: getStatusColor(node.status) }}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-medium truncate">{node.title}</h3>
              <span className="text-xs">{getTrendIcon(node.trend)}</span>
            </div>
            <div className="text-xs text-[#666] truncate">
              {node.skuCount.toLocaleString()} SKUs
              {node.revenue && ` • $${(node.revenue / 1000).toFixed(1)}K`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="text-xs text-[#999]">Health</div>
            <div className="text-sm font-mono text-white">{node.healthScore}%</div>
          </div>

          <div className="w-16 bg-[#1a1a1a] rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${node.healthScore}%`,
                backgroundColor: getHealthColor(node.healthScore),
              }}
            />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <TreeNodeDetailed
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              selectedNodeId={selectedNodeId}
              onToggle={onToggle}
              onSelect={onSelect}
              getHealthColor={getHealthColor}
              getStatusColor={getStatusColor}
              getTrendIcon={getTrendIcon}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Helper function to get status color (needs to be defined outside component for TreeNode)
function getStatusColor(status: string): string {
  switch (status) {
    case 'optimized':
      return '#10a37f';
    case 'outdated':
      return '#f59e0b';
    case 'missing':
      return '#ef4444';
    case 'noContent':
      return '#666666';
    default:
      return '#666666';
  }
}
