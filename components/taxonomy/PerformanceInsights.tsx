'use client';

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, DollarSign, Eye, MousePointer, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CategoryOptimizer } from '@/lib/recommendations/category-optimizer';
import { CategoryRecommendations } from './CategoryRecommendations';

interface PerformanceMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  performanceScore: number;
}

interface PerformanceInsightsProps {
  metrics: PerformanceMetrics;
  categoryAverage?: PerformanceMetrics;
  className?: string;
  categoryInfo?: {
    path: string;
    title: string;
    depth: number;
    productCount: number;
  };
  showCategoryRecommendations?: boolean;
}

export function PerformanceInsights({ 
  metrics, 
  categoryAverage, 
  className,
  categoryInfo,
  showCategoryRecommendations = false
}: PerformanceInsightsProps) {
  // Calculate performance comparisons
  const ctrComparison = categoryAverage ? 
    ((metrics.ctr - categoryAverage.ctr) / categoryAverage.ctr) * 100 : 0;
  
  const conversionComparison = categoryAverage ?
    ((metrics.conversionRate - categoryAverage.conversionRate) / categoryAverage.conversionRate) * 100 : 0;

  // Generate category insights if category info is provided
  const categoryInsights = useMemo(() => {
    if (!categoryInfo || !showCategoryRecommendations) return null;
    
    const optimizer = new CategoryOptimizer();
    return optimizer.generateCategoryRecommendations(
      categoryInfo,
      {
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        ctr: metrics.ctr,
        conversions: metrics.conversions,
        conversionRate: metrics.conversionRate,
        revenue: metrics.revenue,
        avgOrderValue: metrics.revenue / Math.max(1, metrics.conversions),
        productCount: categoryInfo.productCount
      },
      undefined, // metadata - we'll add this later
      categoryAverage ? {
        impressions: categoryAverage.impressions,
        clicks: categoryAverage.clicks,
        ctr: categoryAverage.ctr,
        conversions: categoryAverage.conversions,
        conversionRate: categoryAverage.conversionRate,
        revenue: categoryAverage.revenue,
        avgOrderValue: categoryAverage.revenue / Math.max(1, categoryAverage.conversions),
        productCount: 0
      } : undefined
    );
  }, [categoryInfo, metrics, categoryAverage, showCategoryRecommendations]);

  // Determine opportunity level
  const getOpportunityLevel = () => {
    if (metrics.performanceScore < 30) return 'critical';
    if (metrics.performanceScore < 50) return 'high';
    if (metrics.performanceScore < 70) return 'medium';
    return 'low';
  };

  const opportunityLevel = getOpportunityLevel();

  // Generate product-level recommendations based on metrics
  const getProductRecommendations = () => {
    const recommendations = [];
    
    if (metrics.ctr < 2) {
      recommendations.push({
        type: 'ctr',
        priority: 'high',
        message: 'Low CTR detected. Consider improving product titles and descriptions.',
        impact: 'Could increase traffic by up to 50%'
      });
    }
    
    if (metrics.conversionRate < 1) {
      recommendations.push({
        type: 'conversion',
        priority: 'high',
        message: 'Low conversion rate. Review pricing and product descriptions.',
        impact: 'Could increase revenue by 30-40%'
      });
    }
    
    if (metrics.impressions > 1000 && metrics.clicks < 10) {
      recommendations.push({
        type: 'visibility',
        priority: 'critical',
        message: 'High impressions but low clicks. Your product content needs optimization.',
        impact: 'Quick wins available with title updates'
      });
    }
    
    return recommendations;
  };

  const productRecommendations = getProductRecommendations();

  return (
    <div className={cn('space-y-4', className)}>
      {/* Performance Score Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'px-3 py-1 rounded-full text-sm font-medium',
            opportunityLevel === 'critical' && 'bg-red-100 text-red-700',
            opportunityLevel === 'high' && 'bg-orange-100 text-orange-700',
            opportunityLevel === 'medium' && 'bg-yellow-100 text-yellow-700',
            opportunityLevel === 'low' && 'bg-green-100 text-green-700'
          )}>
            Performance Score: {metrics.performanceScore}/100
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Eye className="w-4 h-4" />
            Impressions
          </div>
          <div className="text-xl font-semibold">
            {metrics.impressions.toLocaleString()}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <MousePointer className="w-4 h-4" />
            CTR
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold">{metrics.ctr.toFixed(2)}%</span>
            {ctrComparison !== 0 && (
              <span className={cn(
                'text-sm flex items-center',
                ctrComparison > 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {ctrComparison > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(ctrComparison).toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <ShoppingCart className="w-4 h-4" />
            Conversions
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold">{metrics.conversions}</span>
            <span className="text-sm text-gray-500">
              ({metrics.conversionRate.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <DollarSign className="w-4 h-4" />
            Revenue
          </div>
          <div className="text-xl font-semibold">
            ${metrics.revenue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Category Recommendations (if enabled) */}
      {categoryInsights && showCategoryRecommendations && (
        <div className="mb-4">
          <CategoryRecommendations insights={categoryInsights} variant="compact" />
        </div>
      )}

      {/* Product Recommendations */}
      {productRecommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Product Optimization Opportunities</h4>
          {productRecommendations.map((rec, index) => (
            <div
              key={index}
              className={cn(
                'flex gap-3 p-3 rounded-lg border',
                rec.priority === 'critical' && 'bg-red-50 border-red-200',
                rec.priority === 'high' && 'bg-orange-50 border-orange-200',
                rec.priority === 'medium' && 'bg-yellow-50 border-yellow-200'
              )}
            >
              <AlertCircle className={cn(
                'w-5 h-5 flex-shrink-0 mt-0.5',
                rec.priority === 'critical' && 'text-red-600',
                rec.priority === 'high' && 'text-orange-600',
                rec.priority === 'medium' && 'text-yellow-600'
              )} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{rec.message}</p>
                <p className="text-xs text-gray-600 mt-1">{rec.impact}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Performance Trend Indicator */}
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-xs text-gray-500">Last 30 days performance</span>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          View Details →
        </button>
      </div>
    </div>
  );
}

/**
 * Mini version for card displays
 */
export function PerformanceInsightsMini({ metrics }: { metrics: PerformanceMetrics }) {
  const getScoreColor = (score: number) => {
    if (score < 30) return 'text-red-600';
    if (score < 50) return 'text-orange-600';
    if (score < 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <Eye className="w-3 h-3 text-gray-400" />
        <span>{metrics.impressions.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <MousePointer className="w-3 h-3 text-gray-400" />
        <span>{metrics.ctr.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-1">
        <DollarSign className="w-3 h-3 text-gray-400" />
        <span>${metrics.revenue.toLocaleString()}</span>
      </div>
      <div className={cn('ml-auto font-medium', getScoreColor(metrics.performanceScore))}>
        {metrics.performanceScore}/100
      </div>
    </div>
  );
}