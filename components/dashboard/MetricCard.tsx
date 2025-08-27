'use client';

import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: LucideIcon;
  loading?: boolean;
  description?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  loading = false,
  description
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (!change) return null;
    
    switch (changeType) {
      case 'increase':
        return <TrendingUp className="h-3 w-3" />;
      case 'decrease':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const getTrendColor = () => {
    switch (changeType) {
      case 'increase':
        return 'text-[#10a37f]';
      case 'decrease':
        return 'text-[#ef4444]';
      default:
        return 'text-[#999]';
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] p-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-3 bg-[#1a1a1a] rounded w-20 mb-2"></div>
            <div className="h-7 bg-[#1a1a1a] rounded w-28"></div>
          </div>
          {Icon && <div className="h-10 w-10 bg-[#1a1a1a] rounded-lg"></div>}
        </div>
        {description && (
          <div className="mt-3 h-2 bg-[#1a1a1a] rounded w-3/4"></div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] p-5 hover:border-[#2a2a2a] transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-[#999] uppercase tracking-wider">{title}</p>
          <div className="mt-2 flex items-baseline">
            <p className="text-2xl font-semibold text-white">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {change !== undefined && (
              <div className={`ml-2 flex items-center text-xs ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="ml-1">
                  {change > 0 ? '+' : ''}{change}%
                </span>
              </div>
            )}
          </div>
          {description && (
            <p className="mt-2 text-xs text-[#666]">{description}</p>
          )}
        </div>
        {Icon && (
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-[#1a1a1a]">
            <Icon className="h-5 w-5 text-[#10a37f]" />
          </div>
        )}
      </div>
    </div>
  );
}