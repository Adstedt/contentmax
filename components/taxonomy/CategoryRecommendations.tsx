'use client';

import React, { useState } from 'react';
import { CategoryInsights, CategoryRecommendation } from '@/lib/core/analysis/category-optimizer';
import { 
  Search, 
  TrendingUp, 
  FileText, 
  Settings,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Zap,
  Target,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  Lightbulb
} from 'lucide-react';

interface CategoryRecommendationsProps {
  insights: CategoryInsights;
  variant?: 'full' | 'compact';
}

export function CategoryRecommendations({ insights, variant = 'full' }: CategoryRecommendationsProps) {
  const [expandedRecs, setExpandedRecs] = useState<Set<number>>(new Set());
  
  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedRecs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRecs(newExpanded);
  };
  
  const getTypeIcon = (type: CategoryRecommendation['type']) => {
    switch (type) {
      case 'seo': return <Search className="w-4 h-4" />;
      case 'performance': return <TrendingUp className="w-4 h-4" />;
      case 'content': return <FileText className="w-4 h-4" />;
      case 'structure': return <Settings className="w-4 h-4" />;
      case 'technical': return <Settings className="w-4 h-4" />;
    }
  };
  
  const getPriorityColor = (priority: CategoryRecommendation['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };
  
  const getEffortBadge = (effort: 'low' | 'medium' | 'high') => {
    const colors = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-red-100 text-red-700',
    };
    
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${colors[effort]}`}>
        {effort} effort
      </span>
    );
  };
  
  if (variant === 'compact') {
    // Compact view for card display
    const topRecommendations = insights.recommendations.slice(0, 3);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium">Category Optimizations</span>
          <span className="ml-auto text-xs text-gray-500">
            Score: {insights.score.overall}/100
          </span>
        </div>
        
        {topRecommendations.map((rec, idx) => (
          <div 
            key={idx}
            className={`p-2 rounded-lg border ${getPriorityColor(rec.priority)} bg-opacity-50`}
          >
            <div className="flex items-start gap-2">
              {getTypeIcon(rec.type)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{rec.title}</p>
                <p className="text-xs opacity-75 mt-0.5">
                  {rec.impact.potential} • {rec.impact.effort} effort
                </p>
              </div>
            </div>
          </div>
        ))}
        
        {insights.recommendations.length > 3 && (
          <p className="text-xs text-gray-500 text-center mt-2">
            +{insights.recommendations.length - 3} more recommendations
          </p>
        )}
      </div>
    );
  }
  
  // Full view
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header with Scores */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Category Optimization Insights</h2>
        
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{insights.score.overall}</div>
            <div className="text-sm text-gray-500">Overall Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{insights.score.seo}</div>
            <div className="text-sm text-gray-500">SEO Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{insights.score.performance}</div>
            <div className="text-sm text-gray-500">Performance</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{insights.score.content}</div>
            <div className="text-sm text-gray-500">Content</div>
          </div>
        </div>
      </div>
      
      {/* Recommendations List */}
      <div className="p-6">
        <div className="space-y-4">
          {insights.recommendations.map((rec, idx) => (
            <div
              key={idx}
              className={`border rounded-lg ${getPriorityColor(rec.priority)} bg-opacity-30`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${getPriorityColor(rec.priority)}`}>
                      {getTypeIcon(rec.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{rec.title}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(rec.priority)}`}>
                          {rec.priority}
                        </span>
                        {getEffortBadge(rec.impact.effort)}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-green-600">
                          <Target className="w-3 h-3" />
                          {rec.impact.metric}
                        </span>
                        <span className="flex items-center gap-1 text-blue-600">
                          <Zap className="w-3 h-3" />
                          {rec.impact.potential}
                        </span>
                      </div>
                      
                      {rec.currentState && (
                        <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Current:</span>
                            <span className="font-mono text-xs">{rec.currentState}</span>
                          </div>
                          {rec.recommendedState && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-gray-500">Recommended:</span>
                              <span className="font-mono text-xs text-green-600">{rec.recommendedState}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => toggleExpanded(idx)}
                    className="ml-4 p-1 hover:bg-white/50 rounded"
                  >
                    {expandedRecs.has(idx) ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                {/* Expanded Implementation Details */}
                {expandedRecs.has(idx) && rec.implementation && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium mb-2">Implementation Steps:</h4>
                    <ul className="space-y-1">
                      {rec.implementation.map((step, stepIdx) => (
                        <li key={stepIdx} className="flex items-start gap-2 text-sm text-gray-600">
                          <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {insights.recommendations.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p>Great job! This category is well-optimized.</p>
              <p className="text-sm mt-1">Keep monitoring performance for new opportunities.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}