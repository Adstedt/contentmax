# TASK-014: Recommendations Engine

## Overview

**Priority**: P2 - Important  
**Estimate**: 3 hours  
**Owner**: Backend Developer  
**Dependencies**: TASK-010 (Scoring), TASK-011 (Revenue), TASK-013 (Insights API)  
**Status**: Not Started

## Problem Statement

We need an intelligent recommendations engine that generates specific, actionable recommendations for each node based on its opportunity score, metrics, and competitive landscape. The engine should prioritize recommendations by impact and effort, providing clear next steps for optimization.

## Technical Requirements

### 1. Recommendations Engine Core

#### File: `lib/recommendations/recommendations-engine.ts`

```typescript
import { createClient } from '@/lib/supabase/server';

export interface RecommendationContext {
  node: {
    id: string;
    url: string;
    title: string;
    depth: number;
  };
  score: {
    total: number;
    factors: {
      searchVolume: number;
      ctrGap: number;
      positionPotential: number;
      competition: number;
      revenueImpact: number;
    };
    confidence: number;
  };
  metrics: {
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
    sessions: number;
    bounceRate: number;
    avgTimeOnPage: number;
    revenue: number;
    conversionRate: number;
  };
  projections: {
    targetPosition: number;
    projectedTraffic: number;
    projectedRevenue: number;
    confidence: number;
  };
  historical?: {
    trend: 'improving' | 'declining' | 'stable';
    volatility: 'high' | 'medium' | 'low';
  };
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  category: RecommendationCategory;
  priority: Priority;
  title: string;
  description: string;
  specificActions: string[];
  estimatedImpact: {
    metric: string;
    current: number;
    projected: number;
    improvement: string;
  };
  estimatedEffort: {
    hours: number;
    complexity: 'low' | 'medium' | 'high';
    skills: string[];
  };
  resources: Resource[];
  dependencies: string[];
  timeline: string;
  successMetrics: string[];
  confidence: number;
}

export enum RecommendationType {
  META_OPTIMIZATION = 'meta_optimization',
  CONTENT_EXPANSION = 'content_expansion',
  TECHNICAL_SEO = 'technical_seo',
  INTERNAL_LINKING = 'internal_linking',
  SCHEMA_MARKUP = 'schema_markup',
  PAGE_SPEED = 'page_speed',
  USER_EXPERIENCE = 'user_experience',
  KEYWORD_TARGETING = 'keyword_targeting',
  COMPETITOR_GAP = 'competitor_gap',
  CONVERSION_OPTIMIZATION = 'conversion_optimization',
}

export enum RecommendationCategory {
  QUICK_WIN = 'quick_win',
  STRATEGIC = 'strategic',
  TECHNICAL = 'technical',
  CONTENT = 'content',
  REVENUE = 'revenue',
}

export enum Priority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface Resource {
  type: 'tool' | 'guide' | 'example' | 'template';
  title: string;
  url?: string;
  description: string;
}

/**
 * RecommendationsEngine - Generates actionable recommendations
 */
export class RecommendationsEngine {
  private readonly rules: RecommendationRule[];

  constructor() {
    this.rules = this.initializeRules();
  }

  /**
   * Generate recommendations for a node
   */
  async generateRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Apply all rules to context
    for (const rule of this.rules) {
      if (rule.condition(context)) {
        const recommendation = await this.createRecommendation(rule, context);
        recommendations.push(recommendation);
      }
    }

    // Sort by priority and impact
    const sorted = this.prioritizeRecommendations(recommendations);

    // Limit to top 5 most impactful
    return sorted.slice(0, 5);
  }

  /**
   * Initialize recommendation rules
   */
  private initializeRules(): RecommendationRule[] {
    return [
      // CTR Optimization Rules
      {
        id: 'ctr_gap_high',
        type: RecommendationType.META_OPTIMIZATION,
        category: RecommendationCategory.QUICK_WIN,
        condition: (ctx) => ctx.score.factors.ctrGap > 0.3 && ctx.metrics.position <= 10,
        generator: this.generateCTROptimizationRec.bind(this),
      },

      // Position Improvement Rules
      {
        id: 'position_4_10',
        type: RecommendationType.CONTENT_EXPANSION,
        category: RecommendationCategory.STRATEGIC,
        condition: (ctx) => ctx.metrics.position >= 4 && ctx.metrics.position <= 10,
        generator: this.generatePositionImprovementRec.bind(this),
      },

      {
        id: 'position_11_20',
        type: RecommendationType.CONTENT_EXPANSION,
        category: RecommendationCategory.STRATEGIC,
        condition: (ctx) => ctx.metrics.position >= 11 && ctx.metrics.position <= 20,
        generator: this.generateContentOverhaulRec.bind(this),
      },

      // Technical SEO Rules
      {
        id: 'no_impressions',
        type: RecommendationType.TECHNICAL_SEO,
        category: RecommendationCategory.TECHNICAL,
        condition: (ctx) => ctx.metrics.impressions === 0,
        generator: this.generateIndexingRec.bind(this),
      },

      {
        id: 'slow_page',
        type: RecommendationType.PAGE_SPEED,
        category: RecommendationCategory.TECHNICAL,
        condition: (ctx) => ctx.metrics.avgTimeOnPage < 10 && ctx.metrics.bounceRate > 0.7,
        generator: this.generatePageSpeedRec.bind(this),
      },

      // User Experience Rules
      {
        id: 'high_bounce',
        type: RecommendationType.USER_EXPERIENCE,
        category: RecommendationCategory.CONTENT,
        condition: (ctx) => ctx.metrics.bounceRate > 0.8,
        generator: this.generateUXImprovementRec.bind(this),
      },

      // Revenue Optimization Rules
      {
        id: 'low_conversion',
        type: RecommendationType.CONVERSION_OPTIMIZATION,
        category: RecommendationCategory.REVENUE,
        condition: (ctx) => ctx.metrics.conversionRate < 0.01 && ctx.metrics.sessions > 100,
        generator: this.generateConversionRec.bind(this),
      },

      // Internal Linking Rules
      {
        id: 'orphan_page',
        type: RecommendationType.INTERNAL_LINKING,
        category: RecommendationCategory.QUICK_WIN,
        condition: (ctx) => ctx.node.depth > 3 && ctx.metrics.impressions < 100,
        generator: this.generateInternalLinkingRec.bind(this),
      },

      // Schema Markup Rules
      {
        id: 'missing_schema',
        type: RecommendationType.SCHEMA_MARKUP,
        category: RecommendationCategory.TECHNICAL,
        condition: (ctx) => ctx.metrics.ctr < 0.02 && ctx.metrics.position <= 10,
        generator: this.generateSchemaRec.bind(this),
      },
    ];
  }

  /**
   * Recommendation Generators
   */
  private async generateCTROptimizationRec(
    rule: RecommendationRule,
    context: RecommendationContext
  ): Promise<Recommendation> {
    const currentCTR = context.metrics.ctr;
    const expectedCTR = this.getExpectedCTR(context.metrics.position);
    const improvement = ((expectedCTR - currentCTR) / currentCTR) * 100;

    return {
      id: `${rule.id}_${context.node.id}`,
      type: rule.type,
      category: rule.category,
      priority: Priority.HIGH,
      title: 'Optimize Meta Title and Description for Higher CTR',
      description: `Your CTR is ${(currentCTR * 100).toFixed(2)}% but pages at position ${Math.round(context.metrics.position)} typically achieve ${(expectedCTR * 100).toFixed(2)}%. Improving your meta tags could significantly increase traffic.`,
      specificActions: [
        'Add power words to your title (e.g., "Ultimate", "Complete", "2024")',
        'Include the primary keyword at the beginning of the title',
        'Write a compelling meta description with a clear value proposition',
        'Add structured data for rich snippets',
        'Use numbers or brackets in title for higher CTR',
      ],
      estimatedImpact: {
        metric: 'CTR',
        current: currentCTR,
        projected: expectedCTR,
        improvement: `+${improvement.toFixed(0)}%`,
      },
      estimatedEffort: {
        hours: 1,
        complexity: 'low',
        skills: ['SEO', 'Copywriting'],
      },
      resources: [
        {
          type: 'guide',
          title: 'Meta Title Optimization Guide',
          description: 'Best practices for writing high-CTR titles',
        },
        {
          type: 'tool',
          title: 'SERP Preview Tool',
          url: 'https://www.portent.com/serp-preview-tool',
          description: 'Preview how your page appears in search results',
        },
      ],
      dependencies: [],
      timeline: 'Immediate (1 hour)',
      successMetrics: [
        'CTR increases by at least 20%',
        'Impressions remain stable or increase',
        'Position maintains or improves',
      ],
      confidence: 0.85,
    };
  }

  private async generatePositionImprovementRec(
    rule: RecommendationRule,
    context: RecommendationContext
  ): Promise<Recommendation> {
    const currentPosition = context.metrics.position;
    const targetPosition = 3;
    const trafficMultiplier = this.getTrafficMultiplier(currentPosition, targetPosition);

    return {
      id: `${rule.id}_${context.node.id}`,
      type: rule.type,
      category: rule.category,
      priority: Priority.HIGH,
      title: 'Improve Content Depth to Reach Top 3',
      description: `This page ranks at position ${Math.round(currentPosition)} and could reach top 3 with targeted improvements. This could ${trafficMultiplier}x your organic traffic.`,
      specificActions: [
        'Expand content to 2000+ words with comprehensive coverage',
        'Add an FAQ section addressing common questions',
        'Include more visual content (images, videos, infographics)',
        'Update content with latest information and trends',
        'Add expert quotes and authoritative sources',
        'Improve internal linking from high-authority pages',
      ],
      estimatedImpact: {
        metric: 'Organic Traffic',
        current: context.metrics.clicks,
        projected: context.metrics.clicks * trafficMultiplier,
        improvement: `+${((trafficMultiplier - 1) * 100).toFixed(0)}%`,
      },
      estimatedEffort: {
        hours: 8,
        complexity: 'medium',
        skills: ['Content Writing', 'SEO', 'Subject Matter Expertise'],
      },
      resources: [
        {
          type: 'template',
          title: 'Content Expansion Template',
          description: 'Structure for comprehensive content',
        },
        {
          type: 'tool',
          title: 'Competitor Content Analyzer',
          description: 'Analyze top-ranking competitor content',
        },
      ],
      dependencies: ['Content audit', 'Keyword research'],
      timeline: '1-2 weeks',
      successMetrics: [
        'Position improves to top 5',
        'Time on page increases by 30%',
        'Organic traffic increases by 50%',
      ],
      confidence: 0.75,
    };
  }

  private async generateContentOverhaulRec(
    rule: RecommendationRule,
    context: RecommendationContext
  ): Promise<Recommendation> {
    return {
      id: `${rule.id}_${context.node.id}`,
      type: rule.type,
      category: rule.category,
      priority: Priority.MEDIUM,
      title: 'Complete Content Overhaul for Page 1 Rankings',
      description: `This page currently ranks on page 2 (position ${Math.round(context.metrics.position)}). A comprehensive content overhaul could move it to page 1.`,
      specificActions: [
        'Conduct thorough competitor analysis of top 10 results',
        'Rewrite content to match or exceed competitor depth',
        'Optimize for semantic keywords and related topics',
        'Add unique data, research, or insights',
        'Implement topic clusters and pillar content strategy',
        'Build high-quality backlinks to the page',
      ],
      estimatedImpact: {
        metric: 'Organic Traffic',
        current: context.metrics.clicks,
        projected: context.metrics.clicks * 5,
        improvement: '+400%',
      },
      estimatedEffort: {
        hours: 20,
        complexity: 'high',
        skills: ['Content Strategy', 'SEO', 'Link Building'],
      },
      resources: [
        {
          type: 'guide',
          title: 'Page 2 to Page 1 Strategy Guide',
          description: 'Proven tactics for breaking into page 1',
        },
      ],
      dependencies: ['Competitor research', 'Content strategy'],
      timeline: '3-4 weeks',
      successMetrics: [
        'Position improves to top 10',
        'Organic traffic increases by 200%+',
        'Page acquires 5+ quality backlinks',
      ],
      confidence: 0.65,
    };
  }

  private async generateIndexingRec(
    rule: RecommendationRule,
    context: RecommendationContext
  ): Promise<Recommendation> {
    return {
      id: `${rule.id}_${context.node.id}`,
      type: rule.type,
      category: rule.category,
      priority: Priority.CRITICAL,
      title: 'Fix Indexing Issues - Page Not Appearing in Search',
      description:
        'This page has zero impressions, indicating it may not be indexed by Google. This is preventing any organic visibility.',
      specificActions: [
        'Check robots.txt for blocking rules',
        'Verify no "noindex" meta tag is present',
        'Submit URL directly to Google Search Console',
        'Check for canonical tag issues',
        'Ensure page returns 200 status code',
        'Add internal links from indexed pages',
        'Create and submit an XML sitemap',
      ],
      estimatedImpact: {
        metric: 'Indexation',
        current: 0,
        projected: 1,
        improvement: 'Enable organic visibility',
      },
      estimatedEffort: {
        hours: 2,
        complexity: 'low',
        skills: ['Technical SEO'],
      },
      resources: [
        {
          type: 'tool',
          title: 'Google Search Console',
          url: 'https://search.google.com/search-console',
          description: 'Submit URL for indexing',
        },
        {
          type: 'guide',
          title: 'Indexing Troubleshooting Guide',
          description: 'Common indexing issues and solutions',
        },
      ],
      dependencies: [],
      timeline: 'Immediate (2 hours)',
      successMetrics: [
        'Page appears in site: search',
        'Impressions > 0 in GSC within 7 days',
        'Page can be found for brand + URL searches',
      ],
      confidence: 0.95,
    };
  }

  private async generatePageSpeedRec(
    rule: RecommendationRule,
    context: RecommendationContext
  ): Promise<Recommendation> {
    return {
      id: `${rule.id}_${context.node.id}`,
      type: rule.type,
      category: rule.category,
      priority: Priority.HIGH,
      title: 'Improve Page Speed to Reduce Bounce Rate',
      description: `High bounce rate (${(context.metrics.bounceRate * 100).toFixed(0)}%) and low time on page suggest performance issues.`,
      specificActions: [
        'Optimize and compress all images (WebP format)',
        'Implement lazy loading for below-fold content',
        'Minify CSS, JavaScript, and HTML',
        'Enable browser caching and CDN',
        'Reduce server response time',
        'Eliminate render-blocking resources',
        'Implement critical CSS inline',
      ],
      estimatedImpact: {
        metric: 'Bounce Rate',
        current: context.metrics.bounceRate,
        projected: context.metrics.bounceRate * 0.7,
        improvement: '-30%',
      },
      estimatedEffort: {
        hours: 5,
        complexity: 'medium',
        skills: ['Web Performance', 'Frontend Development'],
      },
      resources: [
        {
          type: 'tool',
          title: 'PageSpeed Insights',
          url: 'https://pagespeed.web.dev/',
          description: 'Analyze page performance',
        },
      ],
      dependencies: ['Performance audit'],
      timeline: '3-5 days',
      successMetrics: [
        'Core Web Vitals pass',
        'Page load time < 3 seconds',
        'Bounce rate decreases by 20%',
      ],
      confidence: 0.8,
    };
  }

  private async generateUXImprovementRec(
    rule: RecommendationRule,
    context: RecommendationContext
  ): Promise<Recommendation> {
    return {
      id: `${rule.id}_${context.node.id}`,
      type: rule.type,
      category: rule.category,
      priority: Priority.MEDIUM,
      title: 'Improve User Experience to Reduce High Bounce Rate',
      description: `Bounce rate of ${(context.metrics.bounceRate * 100).toFixed(0)}% indicates users aren't finding what they expect.`,
      specificActions: [
        'Ensure content matches search intent',
        'Add clear navigation and table of contents',
        'Improve content readability (shorter paragraphs, bullet points)',
        'Add relevant internal links to related content',
        'Ensure mobile responsiveness',
        'Add clear calls-to-action',
        'Improve above-fold content relevance',
      ],
      estimatedImpact: {
        metric: 'Bounce Rate',
        current: context.metrics.bounceRate,
        projected: 0.5,
        improvement: `-${((context.metrics.bounceRate - 0.5) * 100).toFixed(0)}%`,
      },
      estimatedEffort: {
        hours: 6,
        complexity: 'medium',
        skills: ['UX Design', 'Content Strategy'],
      },
      resources: [
        {
          type: 'tool',
          title: 'Hotjar',
          url: 'https://www.hotjar.com',
          description: 'Analyze user behavior with heatmaps',
        },
      ],
      dependencies: ['User research'],
      timeline: '1 week',
      successMetrics: [
        'Bounce rate < 60%',
        'Time on page increases by 40%',
        'Pages per session increases',
      ],
      confidence: 0.7,
    };
  }

  private async generateConversionRec(
    rule: RecommendationRule,
    context: RecommendationContext
  ): Promise<Recommendation> {
    const currentRevenue = context.metrics.revenue;
    const projectedRevenue = currentRevenue * 3;

    return {
      id: `${rule.id}_${context.node.id}`,
      type: rule.type,
      category: rule.category,
      priority: Priority.HIGH,
      title: 'Optimize Conversion Path to Increase Revenue',
      description: `Conversion rate of ${(context.metrics.conversionRate * 100).toFixed(2)}% is below average. Optimization could significantly increase revenue.`,
      specificActions: [
        'Add prominent, clear call-to-action buttons',
        'Implement trust signals (testimonials, reviews, badges)',
        'Simplify conversion process (fewer form fields)',
        'Add urgency or scarcity elements',
        'Implement exit-intent popups',
        'A/B test different value propositions',
        'Add live chat or chatbot support',
      ],
      estimatedImpact: {
        metric: 'Revenue',
        current: currentRevenue,
        projected: projectedRevenue,
        improvement: `+$${(projectedRevenue - currentRevenue).toFixed(0)}/month`,
      },
      estimatedEffort: {
        hours: 10,
        complexity: 'medium',
        skills: ['CRO', 'UX Design', 'A/B Testing'],
      },
      resources: [
        {
          type: 'tool',
          title: 'Optimizely',
          description: 'A/B testing platform',
        },
        {
          type: 'guide',
          title: 'Conversion Rate Optimization Checklist',
          description: 'Proven CRO tactics',
        },
      ],
      dependencies: ['Conversion tracking setup'],
      timeline: '2-3 weeks',
      successMetrics: [
        'Conversion rate > 2%',
        'Revenue increases by 50%',
        'Cart abandonment decreases',
      ],
      confidence: 0.75,
    };
  }

  private async generateInternalLinkingRec(
    rule: RecommendationRule,
    context: RecommendationContext
  ): Promise<Recommendation> {
    return {
      id: `${rule.id}_${context.node.id}`,
      type: rule.type,
      category: rule.category,
      priority: Priority.MEDIUM,
      title: 'Build Internal Links to Boost Page Authority',
      description:
        'This deep page lacks internal links, limiting its ability to rank. Strategic internal linking can pass authority and improve visibility.',
      specificActions: [
        'Add 3-5 contextual links from high-traffic pages',
        'Include in main navigation if appropriate',
        'Add to relevant category and hub pages',
        'Create a related content section',
        'Update XML sitemap priority',
        'Add breadcrumb navigation',
      ],
      estimatedImpact: {
        metric: 'Organic Traffic',
        current: context.metrics.clicks,
        projected: context.metrics.clicks * 2,
        improvement: '+100%',
      },
      estimatedEffort: {
        hours: 2,
        complexity: 'low',
        skills: ['SEO', 'Content Management'],
      },
      resources: [
        {
          type: 'tool',
          title: 'Internal Link Analyzer',
          description: 'Find internal linking opportunities',
        },
      ],
      dependencies: [],
      timeline: 'Immediate (2 hours)',
      successMetrics: [
        'Page receives 5+ internal links',
        'Impressions increase by 50%',
        'Position improves by 5+ spots',
      ],
      confidence: 0.8,
    };
  }

  private async generateSchemaRec(
    rule: RecommendationRule,
    context: RecommendationContext
  ): Promise<Recommendation> {
    return {
      id: `${rule.id}_${context.node.id}`,
      type: rule.type,
      category: rule.category,
      priority: Priority.MEDIUM,
      title: 'Add Schema Markup for Rich Snippets',
      description:
        'Low CTR despite good rankings suggests missing rich snippets. Schema markup can make your result stand out.',
      specificActions: [
        'Implement appropriate schema type (Product, Article, FAQ, etc.)',
        'Add rating/review schema if applicable',
        'Include price and availability for products',
        'Add FAQ schema for common questions',
        'Implement breadcrumb schema',
        "Test with Google's Rich Results Test",
      ],
      estimatedImpact: {
        metric: 'CTR',
        current: context.metrics.ctr,
        projected: context.metrics.ctr * 1.3,
        improvement: '+30%',
      },
      estimatedEffort: {
        hours: 3,
        complexity: 'medium',
        skills: ['Technical SEO', 'JSON-LD'],
      },
      resources: [
        {
          type: 'tool',
          title: 'Schema.org Generator',
          url: 'https://technicalseo.com/tools/schema-markup-generator/',
          description: 'Generate schema markup',
        },
        {
          type: 'tool',
          title: 'Rich Results Test',
          url: 'https://search.google.com/test/rich-results',
          description: 'Validate schema implementation',
        },
      ],
      dependencies: [],
      timeline: '1-2 days',
      successMetrics: [
        'Rich snippets appear in search results',
        'CTR increases by 20%',
        'Impressions remain stable',
      ],
      confidence: 0.7,
    };
  }

  /**
   * Helper methods
   */
  private createRecommendation(
    rule: RecommendationRule,
    context: RecommendationContext
  ): Promise<Recommendation> {
    return rule.generator(rule, context);
  }

  private prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    const priorityScore = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    const effortScore = {
      low: 3,
      medium: 2,
      high: 1,
    };

    return recommendations.sort((a, b) => {
      // Calculate composite score
      const scoreA =
        priorityScore[a.priority] * 2 + effortScore[a.estimatedEffort.complexity] + a.confidence;

      const scoreB =
        priorityScore[b.priority] * 2 + effortScore[b.estimatedEffort.complexity] + b.confidence;

      return scoreB - scoreA;
    });
  }

  private getExpectedCTR(position: number): number {
    const ctrCurve = [
      { position: 1, ctr: 0.285 },
      { position: 2, ctr: 0.157 },
      { position: 3, ctr: 0.094 },
      { position: 4, ctr: 0.064 },
      { position: 5, ctr: 0.049 },
      { position: 6, ctr: 0.037 },
      { position: 7, ctr: 0.029 },
      { position: 8, ctr: 0.023 },
      { position: 9, ctr: 0.019 },
      { position: 10, ctr: 0.016 },
    ];

    if (position > 10) return 0.01;

    const curve = ctrCurve.find((c) => c.position === Math.round(position));
    return curve ? curve.ctr : 0.01;
  }

  private getTrafficMultiplier(current: number, target: number): number {
    const currentCTR = this.getExpectedCTR(current);
    const targetCTR = this.getExpectedCTR(target);

    if (currentCTR === 0) return 1;
    return targetCTR / currentCTR;
  }
}

interface RecommendationRule {
  id: string;
  type: RecommendationType;
  category: RecommendationCategory;
  condition: (context: RecommendationContext) => boolean;
  generator: (rule: RecommendationRule, context: RecommendationContext) => Promise<Recommendation>;
}
```

### 2. Batch Recommendations Generator

#### File: `lib/recommendations/batch-generator.ts`

```typescript
export class BatchRecommendationsGenerator {
  private engine: RecommendationsEngine;

  constructor() {
    this.engine = new RecommendationsEngine();
  }

  /**
   * Generate recommendations for multiple nodes
   */
  async generateBatchRecommendations(
    projectId: string,
    limit: number = 100
  ): Promise<Map<string, Recommendation[]>> {
    // Fetch top opportunities
    const opportunities = await this.fetchTopOpportunities(projectId, limit);

    const recommendationsMap = new Map<string, Recommendation[]>();

    // Process in batches for performance
    const batchSize = 10;
    for (let i = 0; i < opportunities.length; i += batchSize) {
      const batch = opportunities.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (opp) => {
          const context = this.buildContext(opp);
          const recommendations = await this.engine.generateRecommendations(context);
          return { nodeId: opp.nodeId, recommendations };
        })
      );

      batchResults.forEach((result) => {
        recommendationsMap.set(result.nodeId, result.recommendations);
      });
    }

    return recommendationsMap;
  }

  /**
   * Generate prioritized action plan
   */
  async generateActionPlan(projectId: string): Promise<ActionPlan> {
    const recommendationsMap = await this.generateBatchRecommendations(projectId);

    // Flatten and group recommendations
    const allRecs: Recommendation[] = [];
    recommendationsMap.forEach((recs) => allRecs.push(...recs));

    // Group by category
    const grouped = this.groupByCategory(allRecs);

    // Create phased plan
    return {
      phase1: this.selectPhase(grouped, ['quick_win'], 10),
      phase2: this.selectPhase(grouped, ['strategic', 'revenue'], 10),
      phase3: this.selectPhase(grouped, ['technical', 'content'], 10),
      summary: this.generatePlanSummary(allRecs),
    };
  }

  private groupByCategory(recommendations: Recommendation[]): Map<string, Recommendation[]> {
    const grouped = new Map<string, Recommendation[]>();

    recommendations.forEach((rec) => {
      const category = rec.category;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(rec);
    });

    return grouped;
  }

  private selectPhase(
    grouped: Map<string, Recommendation[]>,
    categories: string[],
    limit: number
  ): Recommendation[] {
    const phase: Recommendation[] = [];

    categories.forEach((cat) => {
      const recs = grouped.get(cat) || [];
      phase.push(...recs.slice(0, Math.floor(limit / categories.length)));
    });

    return phase.slice(0, limit);
  }

  private generatePlanSummary(recommendations: Recommendation[]): PlanSummary {
    const totalHours = recommendations.reduce((sum, rec) => sum + rec.estimatedEffort.hours, 0);

    const byPriority = {
      critical: recommendations.filter((r) => r.priority === Priority.CRITICAL).length,
      high: recommendations.filter((r) => r.priority === Priority.HIGH).length,
      medium: recommendations.filter((r) => r.priority === Priority.MEDIUM).length,
      low: recommendations.filter((r) => r.priority === Priority.LOW).length,
    };

    return {
      totalRecommendations: recommendations.length,
      estimatedTotalHours: totalHours,
      byPriority,
      estimatedImpact: this.calculateTotalImpact(recommendations),
    };
  }
}
```

## Acceptance Criteria

- [ ] Generates 3-5 relevant recommendations per node
- [ ] Recommendations include specific, actionable steps
- [ ] Priority based on impact and effort
- [ ] Effort estimation in hours with complexity
- [ ] Impact quantified with specific metrics
- [ ] Resources and tools provided for each recommendation
- [ ] Batch processing for 100+ nodes
- [ ] Action plan generation with phases
- [ ] 90% of recommendations actionable without additional analysis
- [ ] Unit tests cover all recommendation types

## Implementation Steps

1. **Hour 1**: Core recommendation engine and rules
2. **Hour 2**: Specific recommendation generators
3. **Hour 3**: Batch processing and action plans

## Testing

```typescript
describe('RecommendationsEngine', () => {
  it('should generate relevant recommendations', async () => {
    const engine = new RecommendationsEngine();
    const context: RecommendationContext = {
      node: { id: 'test', url: '/test', title: 'Test', depth: 2 },
      score: {
        total: 65,
        factors: {
          searchVolume: 0.6,
          ctrGap: 0.4,
          positionPotential: 0.7,
          competition: 0.5,
          revenueImpact: 0.3,
        },
        confidence: 0.8,
      },
      metrics: {
        impressions: 1000,
        clicks: 20,
        ctr: 0.02,
        position: 7,
        sessions: 100,
        bounceRate: 0.6,
        avgTimeOnPage: 45,
        revenue: 500,
        conversionRate: 0.02,
      },
      projections: {
        targetPosition: 3,
        projectedTraffic: 100,
        projectedRevenue: 1500,
        confidence: 0.75,
      },
    };

    const recommendations = await engine.generateRecommendations(context);

    expect(recommendations).toHaveLength(5);
    expect(recommendations[0].priority).toBeDefined();
    expect(recommendations[0].specificActions.length).toBeGreaterThan(3);
  });

  it('should prioritize quick wins', async () => {
    const engine = new RecommendationsEngine();
    const context = createHighCTRGapContext();

    const recommendations = await engine.generateRecommendations(context);

    const quickWins = recommendations.filter(
      (r) => r.category === RecommendationCategory.QUICK_WIN
    );

    expect(quickWins.length).toBeGreaterThan(0);
    expect(quickWins[0].estimatedEffort.hours).toBeLessThanOrEqual(3);
  });
});
```

## Notes

- Consider ML-based recommendation refinement
- Track recommendation success rates for improvement
- Add industry-specific recommendations
- Consider seasonal and trending factors
