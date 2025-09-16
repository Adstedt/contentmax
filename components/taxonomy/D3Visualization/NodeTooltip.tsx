'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Eye, MousePointer, Target, Activity } from 'lucide-react';
import type { TaxonomyNode } from './ForceGraph';

export interface SearchMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  previousClicks?: number;
  previousImpressions?: number;
  previousCtr?: number;
  previousPosition?: number;
}

export interface AnalyticsMetrics {
  revenue: number;
  transactions: number;
  sessions: number;
  conversionRate: number;
  avgOrderValue: number;
  engagementRate: number;
  previousRevenue?: number;
  previousTransactions?: number;
  previousSessions?: number;
  previousConversionRate?: number;
}

interface NodeTooltipProps {
  node: TaxonomyNode | null;
  position: { x: number; y: number };
  metrics?: SearchMetrics | null;
  analyticsMetrics?: AnalyticsMetrics | null;
  loading?: boolean;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toFixed(0);
};

const formatPercent = (num: number): string => {
  return `${(num * 100).toFixed(2)}%`;
};

const formatCurrency = (num: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const TrendIndicator = ({ current, previous }: { current: number; previous?: number }) => {
  if (!previous || current === previous) {
    return <Minus className="w-3 h-3 text-gray-500" />;
  }

  const change = ((current - previous) / previous) * 100;

  if (change > 5) {
    return (
      <span className="flex items-center text-green-600">
        <TrendingUp className="w-3 h-3" />
        <span className="text-xs ml-1">+{change.toFixed(0)}%</span>
      </span>
    );
  }

  if (change < -5) {
    return (
      <span className="flex items-center text-red-600">
        <TrendingDown className="w-3 h-3" />
        <span className="text-xs ml-1">{change.toFixed(0)}%</span>
      </span>
    );
  }

  return <Minus className="w-3 h-3 text-gray-500" />;
};

export function NodeTooltip({
  node,
  position,
  metrics,
  analyticsMetrics,
  loading = false,
}: NodeTooltipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (node) {
      const timer = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [node]);

  if (!node || !visible) {
    return null;
  }

  // Position tooltip near the cursor but ensure it stays within viewport
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x + 10, window.innerWidth - 320),
    top: Math.min(position.y + 10, window.innerHeight - 300),
    zIndex: 50,
    pointerEvents: 'none',
  };

  return (
    <Card
      className="p-4 shadow-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm w-80"
      style={tooltipStyle}
    >
      {/* Node Information */}
      <div className="mb-3">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{node.title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{node.url}</p>
      </div>

      {/* Basic Node Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="text-xs">
          <span className="text-gray-500 dark:text-gray-400">Products:</span>
          <span className="ml-1 font-medium">{node.skuCount || 0}</span>
        </div>
        <div className="text-xs">
          <span className="text-gray-500 dark:text-gray-400">Depth:</span>
          <span className="ml-1 font-medium">{node.depth || 0}</span>
        </div>
      </div>

      {/* Opportunity Score */}
      {node.opportunityScore !== undefined && (
        <div className="border-t pt-3 mb-3">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Opportunity Analysis
          </h4>

          <div className="space-y-2">
            {/* Score display with color coding */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">Score</span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold ${
                    node.opportunityScore >= 80
                      ? 'text-red-500'
                      : node.opportunityScore >= 60
                        ? 'text-orange-500'
                        : node.opportunityScore >= 40
                          ? 'text-yellow-500'
                          : node.opportunityScore >= 20
                            ? 'text-green-500'
                            : 'text-gray-500'
                  }`}
                >
                  {node.opportunityScore}/100
                </span>
              </div>
            </div>

            {/* Opportunity Type */}
            {node.opportunityType && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 dark:text-gray-400">Type</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    node.opportunityType === 'quick-win'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : node.opportunityType === 'strategic'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                        : node.opportunityType === 'incremental'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          : node.opportunityType === 'long-term'
                            ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                            : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {node.opportunityType.replace('-', ' ')}
                </span>
              </div>
            )}

            {/* Projected Impact */}
            {node.projectedImpact !== undefined && node.projectedImpact > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 dark:text-gray-400">Projected Impact</span>
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  +{formatCurrency(node.projectedImpact)}
                </span>
              </div>
            )}
          </div>

          {/* Opportunity Recommendations */}
          {node.opportunityScore >= 70 && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs">
              <span className="text-red-700 dark:text-red-400">
                🔥 High-priority optimization opportunity
              </span>
            </div>
          )}
        </div>
      )}

      {/* Search Metrics */}
      {loading ? (
        <div className="border-t pt-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">
            Loading search metrics...
          </div>
        </div>
      ) : metrics ? (
        <div className="border-t pt-3">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search Performance (30 days)
          </h4>

          <div className="space-y-2">
            {/* Clicks */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <MousePointer className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Clicks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{formatNumber(metrics.clicks)}</span>
                <TrendIndicator current={metrics.clicks} previous={metrics.previousClicks} />
              </div>
            </div>

            {/* Impressions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Impressions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{formatNumber(metrics.impressions)}</span>
                <TrendIndicator
                  current={metrics.impressions}
                  previous={metrics.previousImpressions}
                />
              </div>
            </div>

            {/* CTR */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">CTR</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{formatPercent(metrics.ctr)}</span>
                <TrendIndicator current={metrics.ctr} previous={metrics.previousCtr} />
              </div>
            </div>

            {/* Position */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Target className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Avg Position</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{metrics.position.toFixed(1)}</span>
                <TrendIndicator
                  current={-metrics.position}
                  previous={metrics.previousPosition ? -metrics.previousPosition : undefined}
                />
              </div>
            </div>
          </div>

          {/* Performance Indicators */}
          {metrics.impressions > 1000 && metrics.ctr < 0.02 && (
            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs">
              <span className="text-yellow-700 dark:text-yellow-400">
                ⚠️ High impressions but low CTR - consider optimizing title/meta
              </span>
            </div>
          )}

          {metrics.position > 10 && (
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
              <span className="text-blue-700 dark:text-blue-400">
                💡 Low search position - SEO improvements needed
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="border-t pt-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">
            No search metrics available
          </div>
        </div>
      )}

      {/* Analytics Metrics (GA4) */}
      {analyticsMetrics && (
        <div className="border-t pt-3">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Revenue & Conversion (30 days)
          </h4>

          <div className="space-y-2">
            {/* Revenue */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-green-500">
                  {formatCurrency(analyticsMetrics.revenue)}
                </span>
                <TrendIndicator
                  current={analyticsMetrics.revenue}
                  previous={analyticsMetrics.previousRevenue}
                />
              </div>
            </div>

            {/* Transactions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Transactions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  {formatNumber(analyticsMetrics.transactions)}
                </span>
                <TrendIndicator
                  current={analyticsMetrics.transactions}
                  previous={analyticsMetrics.previousTransactions}
                />
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Conv. Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  {formatPercent(analyticsMetrics.conversionRate)}
                </span>
                <TrendIndicator
                  current={analyticsMetrics.conversionRate}
                  previous={analyticsMetrics.previousConversionRate}
                />
              </div>
            </div>

            {/* Average Order Value */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Avg Order</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  {formatCurrency(analyticsMetrics.avgOrderValue)}
                </span>
              </div>
            </div>

            {/* Sessions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Sessions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  {formatNumber(analyticsMetrics.sessions)}
                </span>
              </div>
            </div>
          </div>

          {/* Performance Indicators */}
          {analyticsMetrics.conversionRate < 0.01 && analyticsMetrics.sessions > 100 && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs">
              <span className="text-red-700 dark:text-red-400">
                ⚠️ Low conversion rate - Consider optimizing product pages
              </span>
            </div>
          )}

          {analyticsMetrics.avgOrderValue > 500 && (
            <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs">
              <span className="text-green-700 dark:text-green-400">
                ✨ High-value category - Focus marketing efforts here
              </span>
            </div>
          )}
        </div>
      )}

      {/* Node Status */}
      {node.status && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
            <span
              className={`text-xs font-medium px-2 py-1 rounded ${
                node.status === 'optimized'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  : node.status === 'outdated'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                    : node.status === 'missing'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {node.status}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
