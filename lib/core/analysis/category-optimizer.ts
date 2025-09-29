/**
 * Category-Level Optimization Engine
 * 
 * Generates specific recommendations for category pages to improve their
 * search visibility, click-through rates, and conversion performance.
 */

import { PerformanceMetrics } from '@/lib/core/taxonomy/performance-aggregator';

export interface CategoryMetadata {
  title: string;
  metaDescription?: string;
  h1?: string;
  breadcrumbText?: string;
  urlSlug?: string;
  canonicalUrl?: string;
  schemaMarkup?: any;
}

export interface CategoryRecommendation {
  type: 'seo' | 'content' | 'structure' | 'performance' | 'technical';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  currentState?: string;
  recommendedState?: string;
  impact: {
    metric: string;
    potential: string;
    effort: 'low' | 'medium' | 'high';
  };
  implementation?: string[];
}

export interface CategoryInsights {
  category: {
    path: string;
    depth: number;
    productCount: number;
  };
  performance: PerformanceMetrics;
  metadata?: CategoryMetadata;
  recommendations: CategoryRecommendation[];
  score: {
    overall: number;
    seo: number;
    performance: number;
    content: number;
  };
}

export class CategoryOptimizer {
  /**
   * Generate comprehensive recommendations for a category
   */
  generateCategoryRecommendations(
    category: {
      path: string;
      title: string;
      depth: number;
      productCount: number;
    },
    performance: PerformanceMetrics,
    metadata?: CategoryMetadata,
    peerBenchmark?: PerformanceMetrics
  ): CategoryInsights {
    const recommendations: CategoryRecommendation[] = [];
    
    // SEO Recommendations
    const seoRecs = this.analyzeSEO(category, metadata);
    recommendations.push(...seoRecs);
    
    // Performance Recommendations
    const perfRecs = this.analyzePerformance(category, performance, peerBenchmark);
    recommendations.push(...perfRecs);
    
    // Content Structure Recommendations
    const contentRecs = this.analyzeContent(category, metadata, performance);
    recommendations.push(...contentRecs);
    
    // Technical Recommendations
    const techRecs = this.analyzeTechnical(category, metadata);
    recommendations.push(...techRecs);
    
    // Calculate scores
    const scores = this.calculateScores(recommendations, performance);
    
    // Sort by priority and impact
    recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      const effortOrder = { low: 0, medium: 1, high: 2 };
      return effortOrder[a.impact.effort] - effortOrder[b.impact.effort];
    });
    
    return {
      category,
      performance,
      metadata,
      recommendations,
      score: scores,
    };
  }
  
  /**
   * SEO-specific recommendations for category pages
   */
  private analyzeSEO(
    category: { path: string; title: string; depth: number },
    metadata?: CategoryMetadata
  ): CategoryRecommendation[] {
    const recommendations: CategoryRecommendation[] = [];
    const categoryName = category.path.split(' > ').pop() || category.title;
    
    // Title Tag Optimization
    if (!metadata?.title || metadata.title.length < 30) {
      recommendations.push({
        type: 'seo',
        priority: 'high',
        title: 'Optimize Category Page Title',
        description: 'Your category page title is too short or missing. Add descriptive keywords.',
        currentState: metadata?.title || 'No title set',
        recommendedState: `${categoryName} - Shop Best ${categoryName} Products | Your Store`,
        impact: {
          metric: 'Organic CTR',
          potential: '+15-25%',
          effort: 'low',
        },
        implementation: [
          'Include primary keyword at the beginning',
          'Add modifiers like "Best", "Shop", "Buy"',
          'Include brand name at the end',
          'Keep under 60 characters',
        ],
      });
    }
    
    // Meta Description
    if (!metadata?.metaDescription || metadata.metaDescription.length < 120) {
      recommendations.push({
        type: 'seo',
        priority: 'high',
        title: 'Add Compelling Meta Description',
        description: 'Missing or weak meta description reduces click-through rates from search results.',
        currentState: metadata?.metaDescription || 'No description',
        recommendedState: `Discover our curated collection of ${categoryName}. Compare prices, read reviews, and find the perfect ${categoryName.toLowerCase()} with free shipping on orders over $50.`,
        impact: {
          metric: 'Search CTR',
          potential: '+20-30%',
          effort: 'low',
        },
        implementation: [
          'Include primary and secondary keywords naturally',
          'Add a clear value proposition',
          'Include a call-to-action',
          'Keep between 150-160 characters',
          'Mention unique selling points (free shipping, reviews, etc.)',
        ],
      });
    }
    
    // URL Structure
    if (!metadata?.urlSlug || metadata.urlSlug.includes('_') || metadata.urlSlug.length > 50) {
      recommendations.push({
        type: 'seo',
        priority: 'medium',
        title: 'Optimize URL Structure',
        description: 'Clean, keyword-rich URLs improve search rankings and user experience.',
        currentState: metadata?.urlSlug || `/category/${category.path.replace(/ > /g, '/')}`,
        recommendedState: `/${categoryName.toLowerCase().replace(/\s+/g, '-')}`,
        impact: {
          metric: 'Search Rankings',
          potential: '+5-10 positions',
          effort: 'medium',
        },
        implementation: [
          'Use hyphens instead of underscores',
          'Keep URLs short and descriptive',
          'Include primary keyword',
          'Remove stop words',
          'Set up proper redirects if changing existing URLs',
        ],
      });
    }
    
    // Breadcrumb Optimization
    if (category.depth > 1 && !metadata?.breadcrumbText) {
      recommendations.push({
        type: 'seo',
        priority: 'medium',
        title: 'Implement Breadcrumb Navigation',
        description: 'Breadcrumbs improve navigation and can appear in search results.',
        recommendedState: category.path.replace(/ > /g, ' › '),
        impact: {
          metric: 'User Experience & SEO',
          potential: 'Better SERP appearance',
          effort: 'low',
        },
        implementation: [
          'Add structured data markup for breadcrumbs',
          'Make each level clickable',
          'Use schema.org BreadcrumbList',
        ],
      });
    }
    
    return recommendations;
  }
  
  /**
   * Performance-based recommendations
   */
  private analyzePerformance(
    category: { path: string; productCount: number },
    performance: PerformanceMetrics,
    benchmark?: PerformanceMetrics
  ): CategoryRecommendation[] {
    const recommendations: CategoryRecommendation[] = [];
    
    // Low CTR Analysis
    if (performance.impressions > 1000 && performance.ctr < 1.0) {
      const benchmarkCTR = benchmark?.ctr || 2.0;
      const improvement = benchmarkCTR - performance.ctr;
      
      recommendations.push({
        type: 'performance',
        priority: 'critical',
        title: 'Critical: Very Low Click-Through Rate',
        description: `CTR is ${performance.ctr.toFixed(2)}%, significantly below the ${benchmarkCTR.toFixed(2)}% benchmark.`,
        currentState: `${performance.ctr.toFixed(2)}% CTR`,
        recommendedState: `Target ${benchmarkCTR.toFixed(2)}% CTR`,
        impact: {
          metric: 'Monthly Clicks',
          potential: `+${Math.round(performance.impressions * improvement / 100)} clicks`,
          effort: 'medium',
        },
        implementation: [
          'Review and optimize category page title and description',
          'Add high-quality category banner image',
          'Highlight unique value propositions',
          'Show product count and price range',
          'Add customer ratings summary',
        ],
      });
    }
    
    // Conversion Rate Optimization
    if (performance.clicks > 100 && performance.conversionRate < 1.5) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Improve Category Page Conversion Rate',
        description: 'Visitors are clicking but not converting. Optimize the category landing experience.',
        currentState: `${performance.conversionRate.toFixed(2)}% conversion`,
        recommendedState: 'Target 2.5-3.5% conversion',
        impact: {
          metric: 'Revenue',
          potential: `+$${Math.round(performance.clicks * 0.02 * 50)}/month`,
          effort: 'medium',
        },
        implementation: [
          'Add filtering and sorting options',
          'Show product availability clearly',
          'Display customer reviews and ratings',
          'Implement faceted navigation',
          'Add "Quick View" functionality',
          'Show related categories',
        ],
      });
    }
    
    // Traffic Volume Optimization
    if (performance.impressions < 500 && category.productCount > 10) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'Increase Category Visibility',
        description: 'This category has products but very low visibility. Need to improve discoverability.',
        currentState: `${performance.impressions} monthly impressions`,
        recommendedState: 'Target 2000+ impressions',
        impact: {
          metric: 'Traffic',
          potential: '+300% visibility',
          effort: 'high',
        },
        implementation: [
          'Create category-specific content (buying guides)',
          'Build internal links from related categories',
          'Optimize for long-tail keywords',
          'Submit category sitemap to search engines',
          'Promote category in email campaigns',
        ],
      });
    }
    
    return recommendations;
  }
  
  /**
   * Content structure recommendations
   */
  private analyzeContent(
    category: { path: string; productCount: number },
    metadata?: CategoryMetadata,
    performance?: PerformanceMetrics
  ): CategoryRecommendation[] {
    const recommendations: CategoryRecommendation[] = [];
    const categoryName = category.path.split(' > ').pop();
    
    // Category Description Content
    if (!metadata?.metaDescription || metadata.metaDescription.length < 200) {
      recommendations.push({
        type: 'content',
        priority: 'medium',
        title: 'Add Rich Category Description',
        description: 'Categories with descriptive content rank better and convert higher.',
        recommendedState: 'Add 200-300 word category description with keywords',
        impact: {
          metric: 'SEO & Conversion',
          potential: '+15% organic traffic',
          effort: 'medium',
        },
        implementation: [
          `Write an engaging introduction to ${categoryName}`,
          'Include buying guide snippets',
          'Mention popular brands or features',
          'Add seasonal or trending information',
          'Include relevant keywords naturally',
        ],
      });
    }
    
    // Product Grid Optimization
    if (category.productCount > 20) {
      recommendations.push({
        type: 'structure',
        priority: 'medium',
        title: 'Optimize Product Grid Layout',
        description: 'Large categories need better organization for user experience.',
        impact: {
          metric: 'User Engagement',
          potential: '+25% page engagement',
          effort: 'medium',
        },
        implementation: [
          'Add sub-category navigation',
          'Implement pagination or infinite scroll',
          'Show 12-24 products per page initially',
          'Add "Sort by" options (price, popularity, rating)',
          'Include filter sidebar for attributes',
        ],
      });
    }
    
    // Cross-selling Opportunities
    if (category.productCount > 5) {
      recommendations.push({
        type: 'content',
        priority: 'low',
        title: 'Add Related Categories Section',
        description: 'Help users discover related products and increase page value.',
        impact: {
          metric: 'Pages per Session',
          potential: '+30% navigation depth',
          effort: 'low',
        },
        implementation: [
          'Show "Customers also viewed" categories',
          'Add complementary category suggestions',
          'Display trending subcategories',
        ],
      });
    }
    
    return recommendations;
  }
  
  /**
   * Technical SEO recommendations
   */
  private analyzeTechnical(
    category: { path: string },
    metadata?: CategoryMetadata
  ): CategoryRecommendation[] {
    const recommendations: CategoryRecommendation[] = [];
    
    // Schema Markup
    if (!metadata?.schemaMarkup) {
      recommendations.push({
        type: 'technical',
        priority: 'medium',
        title: 'Add Schema.org Markup',
        description: 'Structured data helps search engines understand your category pages.',
        impact: {
          metric: 'Rich Snippets',
          potential: 'Enhanced SERP display',
          effort: 'low',
        },
        implementation: [
          'Add CollectionPage schema',
          'Include BreadcrumbList schema',
          'Add AggregateRating if applicable',
          'Include price range information',
        ],
      });
    }
    
    // Canonical URLs
    if (!metadata?.canonicalUrl) {
      recommendations.push({
        type: 'technical',
        priority: 'high',
        title: 'Set Canonical URLs',
        description: 'Prevent duplicate content issues with proper canonicalization.',
        impact: {
          metric: 'SEO Authority',
          potential: 'Consolidated ranking signals',
          effort: 'low',
        },
        implementation: [
          'Set self-referencing canonical for category pages',
          'Handle pagination with rel="next" and rel="prev"',
          'Canonicalize filtered URLs to main category',
        ],
      });
    }
    
    return recommendations;
  }
  
  /**
   * Calculate overall scores
   */
  private calculateScores(
    recommendations: CategoryRecommendation[],
    performance: PerformanceMetrics
  ): {
    overall: number;
    seo: number;
    performance: number;
    content: number;
  } {
    // Base scores
    let seoScore = 70;
    let performanceScore = 50;
    let contentScore = 60;
    
    // Deduct points for recommendations
    recommendations.forEach(rec => {
      const deduction = rec.priority === 'critical' ? 20 : 
                       rec.priority === 'high' ? 10 : 
                       rec.priority === 'medium' ? 5 : 2;
      
      switch (rec.type) {
        case 'seo':
        case 'technical':
          seoScore = Math.max(0, seoScore - deduction);
          break;
        case 'performance':
          performanceScore = Math.max(0, performanceScore - deduction);
          break;
        case 'content':
        case 'structure':
          contentScore = Math.max(0, contentScore - deduction);
          break;
      }
    });
    
    // Boost performance score based on actual metrics
    if (performance.ctr > 2.5) performanceScore += 20;
    if (performance.conversionRate > 3) performanceScore += 15;
    if (performance.revenue > 5000) performanceScore += 15;
    
    // Cap at 100
    seoScore = Math.min(100, seoScore);
    performanceScore = Math.min(100, performanceScore);
    contentScore = Math.min(100, contentScore);
    
    const overall = Math.round((seoScore + performanceScore + contentScore) / 3);
    
    return {
      overall,
      seo: seoScore,
      performance: performanceScore,
      content: contentScore,
    };
  }
}