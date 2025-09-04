'use client';

import React from 'react';
import {
  CameraOff,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Package,
  DollarSign,
  BarChart3,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoogleShoppingData {
  imageUrl?: string;
  price?: number;
  currency?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  condition?: 'new' | 'used' | 'refurbished';
  brand?: string;
  gtin?: string;
  mpn?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  imageCount?: number;
}

interface ContentMetrics {
  description: {
    currentLength: number;
    recommendedLength: number;
    quality: 'poor' | 'fair' | 'good' | 'excellent';
  };
  images: {
    count: number;
    recommended: number;
  };
  specifications: {
    filledFields: number;
    totalFields: number;
  };
  schema: {
    isValid: boolean;
  };
}

interface OpportunityScore {
  value: number;
  confidence: 'low' | 'medium' | 'high';
  trend?: 'up' | 'down' | 'stable';
}

interface RevenueProjection {
  current?: number;
  realistic?: number;
  optimistic?: number;
}

interface AIRecommendation {
  id: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact?: string;
}

interface ProductNode {
  id: string;
  title: string;
  url?: string;
  depth: number;
  skuCount?: number;
  traffic?: number;
  revenue?: number;
  status?: 'optimized' | 'outdated' | 'missing' | 'noContent';
}

export interface ProductCardProps {
  node: ProductNode;
  shoppingData?: GoogleShoppingData;
  contentMetrics?: ContentMetrics;
  opportunityScore?: OpportunityScore;
  revenueProjection?: RevenueProjection;
  recommendations?: AIRecommendation[];
  onSelect?: (id: string) => void;
  onBulkSelect?: (id: string) => void;
  isSelected?: boolean;
}

function getScoreClass(score?: number): string {
  if (!score) return 'score-low';
  if (score >= 8) return 'score-high';
  if (score >= 5) return 'score-medium';
  return 'score-low';
}

function getHealthPercentage(metrics?: ContentMetrics): number {
  if (!metrics) return 0;

  let score = 0;
  let factors = 0;

  // Description quality (33%)
  if (metrics.description) {
    const descPercent = Math.min(
      100,
      (metrics.description.currentLength / metrics.description.recommendedLength) * 100
    );
    score += descPercent * 0.33;
    factors++;
  }

  // Images (33%)
  if (metrics.images) {
    const imgPercent = Math.min(100, (metrics.images.count / metrics.images.recommended) * 100);
    score += imgPercent * 0.33;
    factors++;
  }

  // Specifications (34%)
  if (metrics.specifications) {
    const specPercent =
      (metrics.specifications.filledFields / metrics.specifications.totalFields) * 100;
    score += specPercent * 0.34;
    factors++;
  }

  return factors > 0 ? Math.round(score) : 0;
}

export function ProductCard({
  node,
  shoppingData,
  contentMetrics,
  opportunityScore,
  revenueProjection,
  recommendations,
  onSelect,
  onBulkSelect,
  isSelected = false,
}: ProductCardProps) {
  const healthPercent = getHealthPercentage(contentMetrics);
  const topRecommendation = recommendations?.[0];

  return (
    <div
      className={cn(
        'product-card',
        'bg-white border-2 rounded-lg overflow-hidden',
        'transition-all duration-200',
        'hover:shadow-xl hover:-translate-y-1',
        isSelected && 'ring-2 ring-blue-500 border-blue-500',
        node.status === 'optimized' && 'border-green-200',
        node.status === 'outdated' && 'border-yellow-200',
        node.status === 'missing' && 'border-red-200',
        node.status === 'noContent' && 'border-gray-200'
      )}
      data-depth={node.depth}
      onClick={() => onSelect?.(node.id)}
    >
      {/* Product Image Section */}
      <div className="relative h-40 bg-gradient-to-br from-gray-50 to-gray-100">
        {shoppingData?.imageUrl ? (
          <img
            src={shoppingData.imageUrl}
            alt={node.title}
            className="w-full h-full object-contain p-2"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <CameraOff className="w-10 h-10 mb-2" />
            <span className="text-xs font-medium">No image</span>
          </div>
        )}

        {/* Opportunity Score Badge */}
        {opportunityScore && (
          <div
            className={cn(
              'absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold',
              getScoreClass(opportunityScore.value),
              opportunityScore.value >= 8 && 'bg-purple-600 text-white',
              opportunityScore.value >= 5 && opportunityScore.value < 8 && 'bg-cyan-600 text-white',
              opportunityScore.value < 5 && 'bg-gray-500 text-white'
            )}
          >
            {opportunityScore.value.toFixed(1)}/10
            {opportunityScore.trend === 'up' && <TrendingUp className="inline w-3 h-3 ml-1" />}
            {opportunityScore.trend === 'down' && <TrendingDown className="inline w-3 h-3 ml-1" />}
          </div>
        )}

        {/* Stock Status Badge */}
        {shoppingData?.availability && (
          <div
            className={cn(
              'absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium',
              shoppingData.availability === 'in_stock' && 'bg-green-100 text-green-800',
              shoppingData.availability === 'out_of_stock' && 'bg-red-100 text-red-800',
              shoppingData.availability === 'preorder' && 'bg-blue-100 text-blue-800'
            )}
          >
            {shoppingData.availability === 'in_stock' && '✅ In Stock'}
            {shoppingData.availability === 'out_of_stock' && '❌ Out of Stock'}
            {shoppingData.availability === 'preorder' && '🔜 Preorder'}
          </div>
        )}
      </div>

      {/* Product Info Section */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm text-gray-900 line-clamp-2" title={node.title}>
            {node.title}
          </h3>
          {node.url && (
            <p className="text-xs text-gray-500 truncate mt-1" title={node.url}>
              {node.url}
            </p>
          )}
        </div>

        {/* Price and Rating */}
        {shoppingData && (
          <div className="flex items-center justify-between">
            {shoppingData.price && (
              <div className="flex items-center space-x-1">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-lg font-bold text-gray-900">
                  {shoppingData.price.toFixed(2)}
                </span>
              </div>
            )}
            {shoppingData.rating && (
              <div className="flex items-center space-x-1 text-xs text-gray-600">
                <span>⭐ {shoppingData.rating.toFixed(1)}</span>
                {shoppingData.reviewCount && <span>({shoppingData.reviewCount})</span>}
              </div>
            )}
          </div>
        )}

        {/* Content Health Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Content Health</span>
            <span
              className={cn(
                'font-medium',
                healthPercent >= 80 && 'text-green-600',
                healthPercent >= 60 && healthPercent < 80 && 'text-yellow-600',
                healthPercent < 60 && 'text-red-600'
              )}
            >
              {healthPercent}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                healthPercent >= 80 && 'bg-green-500',
                healthPercent >= 60 && healthPercent < 80 && 'bg-yellow-500',
                healthPercent < 60 && 'bg-red-500'
              )}
              style={{ width: `${healthPercent}%` }}
            />
          </div>

          {/* Content Issues */}
          {contentMetrics && (
            <div className="flex items-center space-x-3 text-xs text-gray-600 mt-2">
              <div className="flex items-center space-x-1">
                <span
                  className={cn(
                    contentMetrics.description.quality === 'excellent' && 'text-green-600',
                    contentMetrics.description.quality === 'good' && 'text-blue-600',
                    contentMetrics.description.quality === 'fair' && 'text-yellow-600',
                    contentMetrics.description.quality === 'poor' && 'text-red-600'
                  )}
                >
                  📝 {contentMetrics.description.currentLength}/
                  {contentMetrics.description.recommendedLength}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <span
                  className={cn(
                    contentMetrics.images.count >= contentMetrics.images.recommended &&
                      'text-green-600',
                    contentMetrics.images.count < contentMetrics.images.recommended &&
                      'text-yellow-600'
                  )}
                >
                  🖼️ {contentMetrics.images.count}/{contentMetrics.images.recommended}
                </span>
              </div>
              {contentMetrics.schema.isValid ? (
                <CheckCircle className="w-3 h-3 text-green-600" />
              ) : (
                <AlertCircle className="w-3 h-3 text-red-600" />
              )}
            </div>
          )}
        </div>

        {/* Revenue Projection */}
        {revenueProjection?.realistic && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Potential</span>
              <span className="text-sm font-bold text-yellow-800">
                +${revenueProjection.realistic.toFixed(0)}/mo
              </span>
            </div>
          </div>
        )}

        {/* Top Recommendation */}
        {topRecommendation && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
            <div className="flex items-start space-x-2">
              <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 line-clamp-2">{topRecommendation.title}</p>
            </div>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          {node.traffic !== undefined && (
            <div className="text-center">
              <p className="text-xs text-gray-500">Traffic</p>
              <p className="text-sm font-semibold">{node.traffic.toLocaleString()}</p>
            </div>
          )}
          {node.revenue !== undefined && (
            <div className="text-center">
              <p className="text-xs text-gray-500">Revenue</p>
              <p className="text-sm font-semibold">${node.revenue.toLocaleString()}</p>
            </div>
          )}
          {node.skuCount !== undefined && (
            <div className="text-center">
              <p className="text-xs text-gray-500">SKUs</p>
              <p className="text-sm font-semibold">{node.skuCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex border-t">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(node.id);
          }}
          className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          View Details
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBulkSelect?.(node.id);
          }}
          className={cn(
            'px-3 py-2 text-xs font-medium border-l transition-colors',
            isSelected
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
          )}
        >
          {isSelected ? '✓' : '☐'}
        </button>
      </div>
    </div>
  );
}
