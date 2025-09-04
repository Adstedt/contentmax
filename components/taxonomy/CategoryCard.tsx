'use client';

import React from 'react';
import {
  FolderOpen,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Package,
  DollarSign,
  Users,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryMetrics {
  totalProducts: number;
  optimizedProducts: number;
  totalTraffic: number;
  totalRevenue: number;
  avgOpportunityScore?: number;
  healthScore?: number;
}

interface CategoryNode {
  id: string;
  title: string;
  url?: string;
  depth: number;
  children?: string[];
  metrics?: CategoryMetrics;
  status?: 'optimized' | 'needs-attention' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

export interface CategoryCardProps {
  node: CategoryNode;
  opportunityScore?: number;
  revenueProjection?: number;
  priorityActions?: number;
  onSelect?: (id: string) => void;
  onExpand?: (id: string) => void;
  isExpanded?: boolean;
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'optimized':
      return 'from-green-500 to-emerald-600';
    case 'needs-attention':
      return 'from-yellow-500 to-amber-600';
    case 'critical':
      return 'from-red-500 to-rose-600';
    default:
      return 'from-blue-500 to-indigo-600';
  }
}

function getHealthIcon(score?: number) {
  if (!score) return <AlertTriangle className="w-5 h-5 text-gray-400" />;
  if (score >= 80) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (score >= 60) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  return <AlertTriangle className="w-5 h-5 text-red-500" />;
}

export function CategoryCard({
  node,
  opportunityScore,
  revenueProjection,
  priorityActions,
  onSelect,
  onExpand,
  isExpanded = false,
}: CategoryCardProps) {
  const gradientClass = getStatusColor(node.status);
  const healthPercent = node.metrics?.healthScore || 0;

  return (
    <div
      className={cn(
        'category-card',
        'relative overflow-hidden rounded-xl',
        'transition-all duration-300',
        'hover:shadow-2xl hover:scale-105',
        'cursor-pointer',
        'min-w-[320px] min-h-[200px]'
      )}
      onClick={() => onSelect?.(node.id)}
    >
      {/* Background Gradient */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-90', gradientClass)} />

      {/* Content */}
      <div className="relative z-10 p-6 text-white h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{node.title}</h3>
              {node.url && <p className="text-sm text-white/70 mt-1">{node.url}</p>}
            </div>
          </div>

          {/* Health Indicator */}
          <div className="flex items-center space-x-2">
            {getHealthIcon(healthPercent)}
            <span className="text-lg font-bold">{healthPercent}%</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4 flex-1">
          {/* Products */}
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <div className="flex items-center space-x-2 mb-1">
              <Package className="w-4 h-4 text-white/70" />
              <span className="text-xs text-white/70">Products</span>
            </div>
            <p className="text-2xl font-bold">{node.metrics?.totalProducts || 0}</p>
            {node.metrics?.optimizedProducts !== undefined && (
              <p className="text-xs text-white/70 mt-1">
                {node.metrics.optimizedProducts} optimized
              </p>
            )}
          </div>

          {/* Revenue */}
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <div className="flex items-center space-x-2 mb-1">
              <DollarSign className="w-4 h-4 text-white/70" />
              <span className="text-xs text-white/70">Revenue</span>
            </div>
            <p className="text-2xl font-bold">
              ${(node.metrics?.totalRevenue || 0).toLocaleString()}
            </p>
            {revenueProjection && (
              <p className="text-xs text-green-300 mt-1 font-medium">
                +${revenueProjection.toLocaleString()} potential
              </p>
            )}
          </div>

          {/* Traffic */}
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <div className="flex items-center space-x-2 mb-1">
              <Users className="w-4 h-4 text-white/70" />
              <span className="text-xs text-white/70">Traffic</span>
            </div>
            <p className="text-2xl font-bold">
              {(node.metrics?.totalTraffic || 0).toLocaleString()}
            </p>
            {node.trend && (
              <div className="flex items-center space-x-1 mt-1">
                {node.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-300" />}
                {node.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-300" />}
                <span className="text-xs text-white/70">
                  {node.trend === 'up'
                    ? 'Trending up'
                    : node.trend === 'down'
                      ? 'Trending down'
                      : 'Stable'}
                </span>
              </div>
            )}
          </div>

          {/* Opportunity Score */}
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <div className="flex items-center space-x-2 mb-1">
              <BarChart3 className="w-4 h-4 text-white/70" />
              <span className="text-xs text-white/70">Opportunity</span>
            </div>
            <p className="text-2xl font-bold">{opportunityScore?.toFixed(1) || '0.0'}/10</p>
            {priorityActions && priorityActions > 0 && (
              <p className="text-xs text-yellow-300 mt-1 font-medium">
                {priorityActions} actions needed
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/20">
          <div className="flex items-center space-x-2">
            {node.children && node.children.length > 0 && (
              <span className="text-sm text-white/70">{node.children.length} subcategories</span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand?.(node.id);
            }}
            className={cn(
              'flex items-center space-x-1 px-3 py-1 rounded-lg',
              'bg-white/20 hover:bg-white/30 transition-colors',
              'text-sm font-medium'
            )}
          >
            <span>Explore</span>
            <ChevronRight
              className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')}
            />
          </button>
        </div>

        {/* Priority Badge */}
        {node.status === 'critical' && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-red-900/80 rounded-full text-xs font-bold animate-pulse">
            NEEDS ATTENTION
          </div>
        )}
      </div>
    </div>
  );
}
