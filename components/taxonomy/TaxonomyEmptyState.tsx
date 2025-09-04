'use client';

import React, { useState } from 'react';
import {
  FileText,
  BarChart3,
  Search,
  ShoppingBag,
  ArrowRight,
  CheckCircle,
  Circle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataSource {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
  connected: boolean;
  loading?: boolean;
}

interface TaxonomyEmptyStateProps {
  onGetStarted: () => void;
  dataSources?: DataSource[];
}

export function TaxonomyEmptyState({
  onGetStarted,
  dataSources = getDefaultDataSources(),
}: TaxonomyEmptyStateProps) {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);

  const allRequiredConnected = dataSources.filter((ds) => ds.required).every((ds) => ds.connected);

  const connectedCount = dataSources.filter((ds) => ds.connected).length;
  const progress = (connectedCount / dataSources.length) * 100;

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Blurred background visualization */}
      <div className="absolute inset-0 opacity-10 blur-sm">
        <svg className="w-full h-full">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" className="text-gray-400" />

          {/* Mock nodes */}
          {Array.from({ length: 20 }).map((_, i) => (
            <g key={i}>
              <circle
                cx={Math.random() * 1000 + 100}
                cy={Math.random() * 600 + 100}
                r={Math.random() * 30 + 20}
                fill="currentColor"
                className="text-gray-300"
                opacity={0.3}
              />
            </g>
          ))}

          {/* Mock connections */}
          {Array.from({ length: 15 }).map((_, i) => (
            <line
              key={`line-${i}`}
              x1={Math.random() * 1000 + 100}
              y1={Math.random() * 600 + 100}
              x2={Math.random() * 1000 + 100}
              y2={Math.random() * 600 + 100}
              stroke="currentColor"
              strokeWidth="1"
              className="text-gray-300"
              opacity={0.2}
            />
          ))}
        </svg>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center h-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full mx-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4">
              <BarChart3 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to Taxonomy Visualization
            </h2>
            <p className="text-lg text-gray-600">
              Connect your data sources to unlock powerful SEO insights and optimization
              opportunities
            </p>
          </div>

          {/* Progress bar */}
          {connectedCount > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Setup Progress</span>
                <span className="font-medium text-gray-900">
                  {connectedCount}/{dataSources.length} connected
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Data sources grid */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Required Data Sources
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dataSources.map((source) => (
                <div
                  key={source.id}
                  className={cn(
                    'relative p-4 rounded-xl border-2 transition-all duration-200',
                    source.connected
                      ? 'bg-green-50 border-green-300'
                      : 'bg-white border-gray-200 hover:border-gray-300',
                    hoveredSource === source.id && !source.connected && 'shadow-lg scale-105'
                  )}
                  onMouseEnter={() => setHoveredSource(source.id)}
                  onMouseLeave={() => setHoveredSource(null)}
                >
                  <div className="flex items-start space-x-4">
                    <div
                      className={cn(
                        'flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center',
                        source.connected
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {source.loading ? <Loader2 className="w-6 h-6 animate-spin" /> : source.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900">
                          {source.name}
                          {source.required && (
                            <span className="ml-2 text-xs text-red-500">*Required</span>
                          )}
                        </h4>
                        {source.connected ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{source.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What you'll get section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Once connected, you'll unlock:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'Interactive taxonomy visualization of your entire site',
                'Product-level optimization opportunities',
                'Revenue projections for each category',
                'AI-powered recommendations',
                'Content health scores and gaps',
                'Bulk optimization capabilities',
              ].map((feature, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <button
              onClick={onGetStarted}
              disabled={!allRequiredConnected && connectedCount > 0}
              className={cn(
                'inline-flex items-center px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200',
                'transform hover:scale-105 hover:shadow-xl',
                allRequiredConnected || connectedCount === 0
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                  : 'bg-gray-400 cursor-not-allowed'
              )}
            >
              {connectedCount === 0 ? (
                <>
                  Get Started
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              ) : allRequiredConnected ? (
                <>
                  View Taxonomy
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              ) : (
                <>Connect Required Sources First</>
              )}
            </button>

            {connectedCount === 0 && (
              <p className="text-sm text-gray-500 mt-4">Takes about 5 minutes to complete setup</p>
            )}
          </div>
        </div>
      </div>

      {/* Help text */}
      <div className="absolute bottom-4 left-4 right-4 text-center">
        <p className="text-sm text-gray-500">
          Need help? Check out our{' '}
          <a href="/docs/getting-started" className="text-blue-600 hover:underline">
            setup guide
          </a>{' '}
          or{' '}
          <a href="/support" className="text-blue-600 hover:underline">
            contact support
          </a>
        </p>
      </div>
    </div>
  );
}

function getDefaultDataSources(): DataSource[] {
  return [
    {
      id: 'sitemap',
      name: 'Sitemap',
      description: 'Import your site structure and URL hierarchy',
      icon: <FileText className="w-6 h-6" />,
      required: true,
      connected: false,
    },
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      description: 'Traffic data, user behavior, and conversions',
      icon: <BarChart3 className="w-6 h-6" />,
      required: true,
      connected: false,
    },
    {
      id: 'google-search-console',
      name: 'Google Search Console',
      description: 'Search performance, keywords, and rankings',
      icon: <Search className="w-6 h-6" />,
      required: true,
      connected: false,
    },
    {
      id: 'google-shopping',
      name: 'Google Shopping Feed',
      description: 'Product data, prices, images, and inventory',
      icon: <ShoppingBag className="w-6 h-6" />,
      required: true,
      connected: false,
    },
  ];
}
