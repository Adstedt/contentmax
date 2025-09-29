/**
 * Data Enrichment Service
 * Ties together feed data with performance metrics
 */

import { createClient } from '@/lib/external/supabase/server';

export interface EnrichedProduct {
  // From Feed
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  availability: string;
  
  // From Merchant API (if connected)
  performance?: {
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    revenue: number;
    lastSynced: Date;
  };
  
  // Computed Insights
  insights?: {
    opportunityScore: number;
    recommendations: string[];
    estimatedImpact: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  };
}

export class DataEnrichmentService {
  /**
   * Matches feed products with performance data
   */
  async enrichProductsWithPerformance(userId: string) {
    const supabase = await createClient();
    
    // Get all products from feed
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId);
    
    // Check if Google is connected
    const { data: integration } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (!integration) {
      // Return products without performance data
      return products?.map(p => ({
        ...p,
        insights: this.generateBasicInsights(p)
      }));
    }
    
    // Fetch and merge performance data
    const response = await fetch('/api/integrations/google/merchant/performance', {
      method: 'POST'
    });
    
    if (response.ok) {
      // Re-fetch products with fresh performance data
      const { data: enrichedProducts } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId);
      
      return enrichedProducts?.map(p => ({
        ...p,
        insights: this.generatePerformanceInsights(p)
      }));
    }
    
    return products;
  }
  
  /**
   * Generate insights based on feed data only
   */
  private generateBasicInsights(product: any) {
    const recommendations = [];
    let opportunityScore = 50; // Base score without performance data
    
    // Check content quality
    if (product.description?.length < 100) {
      recommendations.push('Add detailed product description (100+ words)');
      opportunityScore += 10;
    }
    
    if (!product.image_url || product.image_url === '') {
      recommendations.push('Add product images');
      opportunityScore += 15;
    }
    
    if (product.title?.length < 25) {
      recommendations.push('Expand product title with key features');
      opportunityScore += 10;
    }
    
    return {
      opportunityScore,
      recommendations,
      estimatedImpact: 'Connect Google Merchant for accurate impact metrics',
      priority: opportunityScore > 70 ? 'high' : 'medium'
    };
  }
  
  /**
   * Generate insights with performance data
   */
  private generatePerformanceInsights(product: any) {
    const recommendations = [];
    let opportunityScore = 0;
    let estimatedRevenueLift = 0;
    
    // CTR Analysis
    if (product.impressions > 100 && product.ctr < 1) {
      recommendations.push('CTR below 1% - Optimize title and description');
      opportunityScore += 40;
      estimatedRevenueLift += product.revenue * 0.5; // Could increase by 50%
    }
    
    // Conversion Analysis
    if (product.clicks > 50 && product.conversion_rate < 1) {
      recommendations.push('Low conversion rate - Review pricing and descriptions');
      opportunityScore += 30;
      estimatedRevenueLift += product.revenue * 0.3;
    }
    
    // Content Quality
    if (product.description?.length < 150) {
      recommendations.push('Short description impacting conversions');
      opportunityScore += 20;
    }
    
    // No performance despite impressions
    if (product.impressions > 1000 && product.clicks < 5) {
      opportunityScore = 90; // Critical opportunity
      recommendations.unshift('CRITICAL: High visibility but no engagement');
    }
    
    return {
      opportunityScore: Math.min(100, opportunityScore),
      recommendations,
      estimatedImpact: estimatedRevenueLift > 0 
        ? `+$${estimatedRevenueLift.toFixed(0)} potential revenue`
        : 'Optimization needed',
      priority: this.getPriority(opportunityScore)
    };
  }
  
  private getPriority(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
  
  /**
   * Enrich taxonomy nodes with aggregated performance
   */
  async enrichTaxonomyWithPerformance(userId: string) {
    const supabase = await createClient();
    
    // Get taxonomy with performance data
    const { data: nodes } = await supabase
      .from('taxonomy_nodes')
      .select('*, products(count)')
      .eq('user_id', userId)
      .order('depth');
    
    return nodes?.map(node => ({
      ...node,
      status: this.getNodeStatus(node),
      healthScore: this.calculateHealthScore(node),
      opportunities: this.findOpportunities(node)
    }));
  }
  
  private getNodeStatus(node: any) {
    if (node.product_count === 0) return 'noContent';
    if (node.ctr < 1) return 'underperforming';
    if (node.conversion_rate < 0.5) return 'needs-optimization';
    if (node.performance_score > 70) return 'optimized';
    return 'needs-attention';
  }
  
  private calculateHealthScore(node: any) {
    let score = 50;
    
    // Has products
    if (node.product_count > 0) score += 10;
    
    // Good CTR
    if (node.ctr > 2) score += 20;
    
    // Good conversion
    if (node.conversion_rate > 1) score += 20;
    
    // Generating revenue
    if (node.revenue > 0) score += 10;
    
    return Math.min(100, score);
  }
  
  private findOpportunities(node: any) {
    const opportunities = [];
    
    if (node.impressions > 1000 && node.ctr < 1) {
      opportunities.push({
        type: 'quick-win',
        action: 'Fix titles in this category',
        impact: 'High',
        effort: 'Low'
      });
    }
    
    if (node.product_count < 5) {
      opportunities.push({
        type: 'expansion',
        action: 'Add more products to this category',
        impact: 'Medium',
        effort: 'Medium'
      });
    }
    
    return opportunities;
  }
}