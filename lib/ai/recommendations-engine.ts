import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import OpenAI from 'openai';

type TaxonomyNode = Database['public']['Tables']['taxonomy_nodes']['Row'];
type Opportunity = Database['public']['Tables']['opportunities']['Row'];

export interface Recommendation {
  id: string;
  nodeId: string;
  type: 'content' | 'technical' | 'structural' | 'competitive';
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  implementation: string;
  successMetrics: string[];
  estimatedTimeframe: string;
  dependencies?: string[];
}

export interface RecommendationContext {
  node: TaxonomyNode;
  opportunity: Opportunity;
  parentNode?: TaxonomyNode;
  competitorData?: any;
  historicalPerformance?: any;
}

export interface EngineConfig {
  openaiApiKey?: string;
  maxRecommendations?: number;
  useAI?: boolean;
  templateMode?: boolean;
}

// Recommendation templates for common issues
const RECOMMENDATION_TEMPLATES = {
  missingContent: {
    type: 'content' as const,
    priority: 'high' as const,
    effort: 'medium' as const,
    impact: 'high' as const,
    title: 'Create Category Content',
    description:
      'This category page lacks content, missing a key opportunity to rank for category-level keywords.',
    implementation: `
1. Write 300-500 words of unique, valuable content
2. Include primary and secondary keywords naturally
3. Add internal links to top products
4. Include buyer's guide or comparison information
5. Add FAQ section for common questions`,
    successMetrics: [
      'Page indexed by Google',
      'Ranking for category keywords',
      '20% increase in organic traffic',
      'Improved time on page',
    ],
    estimatedTimeframe: '1-2 weeks',
  },

  poorCTR: {
    type: 'technical' as const,
    priority: 'high' as const,
    effort: 'low' as const,
    impact: 'high' as const,
    title: 'Optimize Meta Tags for CTR',
    description:
      'Current CTR is significantly below expected for this position. Improving title and description can increase traffic without ranking changes.',
    implementation: `
1. Analyze competitor SERP snippets
2. Rewrite title tag with emotional triggers
3. Include numbers, dates, or power words
4. Optimize meta description with clear value proposition
5. Add schema markup for rich snippets`,
    successMetrics: [
      '30% improvement in CTR',
      'Increased impressions',
      'Higher engagement metrics',
    ],
    estimatedTimeframe: '3-5 days',
  },

  slowPageSpeed: {
    type: 'technical' as const,
    priority: 'medium' as const,
    effort: 'medium' as const,
    impact: 'medium' as const,
    title: 'Improve Page Load Speed',
    description: 'Page load time exceeds 3 seconds, impacting user experience and SEO rankings.',
    implementation: `
1. Optimize and compress images
2. Enable browser caching
3. Minify CSS and JavaScript
4. Implement lazy loading
5. Use CDN for static assets`,
    successMetrics: [
      'Page load time under 2 seconds',
      'Improved Core Web Vitals scores',
      'Reduced bounce rate by 10%',
    ],
    estimatedTimeframe: '1 week',
  },

  thinContent: {
    type: 'content' as const,
    priority: 'medium' as const,
    effort: 'medium' as const,
    impact: 'medium' as const,
    title: 'Expand and Enrich Content',
    description:
      'Current content is too thin to compete effectively. Comprehensive content performs better in search.',
    implementation: `
1. Expand content to 1500+ words
2. Add detailed product comparisons
3. Include use cases and examples
4. Add multimedia (images, videos)
5. Create comprehensive buying guide`,
    successMetrics: [
      '50% increase in average time on page',
      'Improved rankings for long-tail keywords',
      'Increased social shares',
    ],
    estimatedTimeframe: '2 weeks',
  },
};

export class RecommendationsEngine {
  private supabase: SupabaseClient<Database>;
  private openai?: OpenAI;
  private config: Required<EngineConfig>;

  constructor(supabase: SupabaseClient<Database>, config: EngineConfig = {}) {
    this.supabase = supabase;
    this.config = {
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY || '',
      maxRecommendations: config.maxRecommendations ?? 5,
      useAI: config.useAI ?? true,
      templateMode: config.templateMode ?? false,
    };

    if (this.config.useAI && this.config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: this.config.openaiApiKey });
    }
  }

  /**
   * Generate recommendations for a node
   */
  async generateRecommendations(nodeId: string): Promise<Recommendation[]> {
    // Fetch context data
    const context = await this.fetchContext(nodeId);

    if (!context) {
      throw new Error(`Unable to fetch context for node ${nodeId}`);
    }

    let recommendations: Recommendation[] = [];

    // Generate template-based recommendations
    const templateRecs = this.generateTemplateRecommendations(context);
    recommendations.push(...templateRecs);

    // Generate AI-powered recommendations if enabled
    if (this.config.useAI && this.openai && !this.config.templateMode) {
      const aiRecs = await this.generateAIRecommendations(context);
      recommendations.push(...aiRecs);
    }

    // Prioritize and limit recommendations
    recommendations = this.prioritizeRecommendations(recommendations);
    recommendations = recommendations.slice(0, this.config.maxRecommendations);

    // Store recommendations
    await this.storeRecommendations(nodeId, recommendations);

    return recommendations;
  }

  /**
   * Generate template-based recommendations
   */
  private generateTemplateRecommendations(context: RecommendationContext): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const factors = context.opportunity.factors as any;

    // Check for missing content
    if (context.node.content_status === 'missing') {
      recommendations.push({
        id: `${context.node.id}_missing_content`,
        nodeId: context.node.id,
        ...RECOMMENDATION_TEMPLATES.missingContent,
      });
    }

    // Check for poor CTR
    if (factors?.ctrGap > 40) {
      recommendations.push({
        id: `${context.node.id}_poor_ctr`,
        nodeId: context.node.id,
        ...RECOMMENDATION_TEMPLATES.poorCTR,
      });
    }

    // Check for thin content
    if (context.node.content_status === 'outdated' || factors?.contentScore < 50) {
      recommendations.push({
        id: `${context.node.id}_thin_content`,
        nodeId: context.node.id,
        ...RECOMMENDATION_TEMPLATES.thinContent,
      });
    }

    return recommendations;
  }

  /**
   * Generate AI-powered recommendations using GPT-4
   */
  private async generateAIRecommendations(
    context: RecommendationContext
  ): Promise<Recommendation[]> {
    if (!this.openai) return [];

    try {
      const prompt = this.buildAIPrompt(context);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert SEO consultant providing specific, actionable recommendations for improving page performance. 
            Provide recommendations in JSON format with the following structure:
            {
              "recommendations": [
                {
                  "type": "content|technical|structural|competitive",
                  "priority": "high|medium|low",
                  "effort": "low|medium|high", 
                  "impact": "low|medium|high",
                  "title": "Brief title",
                  "description": "Why this matters",
                  "implementation": "Step-by-step guide",
                  "successMetrics": ["Metric 1", "Metric 2"],
                  "estimatedTimeframe": "X days/weeks"
                }
              ]
            }`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const parsed = JSON.parse(content);
      const aiRecommendations = parsed.recommendations || [];

      return aiRecommendations.map((rec: any, index: number) => ({
        id: `${context.node.id}_ai_${index}`,
        nodeId: context.node.id,
        ...rec,
      }));
    } catch (error) {
      console.error('Failed to generate AI recommendations:', error);
      return [];
    }
  }

  /**
   * Build prompt for AI recommendations
   */
  private buildAIPrompt(context: RecommendationContext): string {
    const factors = context.opportunity.factors as any;

    return `
Analyze this page and provide 3 specific SEO recommendations:

Page: ${context.node.url}
Path: ${context.node.path}
Title: ${context.node.title || 'Not set'}

Current Status:
- Content Status: ${context.node.content_status || 'unknown'}
- Optimization Status: ${context.node.optimization_status || 'not started'}
- SKU Count: ${context.node.sku_count || 0}
- Opportunity Score: ${context.opportunity.score}/100

Key Issues:
- CTR Gap: ${factors?.ctrGap || 0}%
- Search Volume Score: ${factors?.searchVolume || 0}/100
- Position Potential: ${factors?.positionPotential || 0}/100
- Competition Score: ${factors?.competition || 0}/100
- Revenue Score: ${factors?.revenue || 0}/100

Revenue Potential: $${context.opportunity.revenue_potential || 0}

Focus on:
1. Quick wins that can be implemented within 2 weeks
2. High-impact changes specific to this page type
3. Avoid generic advice - be specific to this URL and situation
`;
  }

  /**
   * Prioritize recommendations by impact/effort ratio
   */
  private prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    const scoreMap = {
      low: 1,
      medium: 2,
      high: 3,
    };

    return recommendations.sort((a, b) => {
      // Calculate impact/effort ratio
      const aRatio = scoreMap[a.impact] / scoreMap[a.effort];
      const bRatio = scoreMap[b.impact] / scoreMap[b.effort];

      // Secondary sort by priority
      if (aRatio === bRatio) {
        return scoreMap[b.priority] - scoreMap[a.priority];
      }

      return bRatio - aRatio;
    });
  }

  /**
   * Fetch context data for recommendations
   */
  private async fetchContext(nodeId: string): Promise<RecommendationContext | null> {
    // Fetch node and opportunity data
    const [nodeResult, opportunityResult] = await Promise.all([
      this.supabase.from('taxonomy_nodes').select('*').eq('id', nodeId).single(),

      this.supabase.from('opportunities').select('*').eq('node_id', nodeId).single(),
    ]);

    if (
      nodeResult.error ||
      !nodeResult.data ||
      opportunityResult.error ||
      !opportunityResult.data
    ) {
      return null;
    }

    // Fetch parent node if exists
    let parentNode: TaxonomyNode | undefined;
    if (nodeResult.data.parent_id) {
      const parentResult = await this.supabase
        .from('taxonomy_nodes')
        .select('*')
        .eq('id', nodeResult.data.parent_id)
        .single();

      if (parentResult.data) {
        parentNode = parentResult.data;
      }
    }

    return {
      node: nodeResult.data,
      opportunity: opportunityResult.data,
      parentNode,
    };
  }

  /**
   * Store recommendations in database
   */
  private async storeRecommendations(
    nodeId: string,
    recommendations: Recommendation[]
  ): Promise<void> {
    // In a real implementation, this would store in a recommendations table
    // For now, we'll update the opportunity record
    const { error } = await this.supabase
      .from('opportunities')
      .update({
        recommendations: recommendations as any,
      })
      .eq('node_id', nodeId);

    if (error) {
      console.error('Failed to store recommendations:', error);
    }
  }

  /**
   * Batch generate recommendations
   */
  async batchGenerateRecommendations(
    nodeIds: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, Recommendation[]>> {
    const results = new Map<string, Recommendation[]>();
    const batchSize = 10;

    for (let i = 0; i < nodeIds.length; i += batchSize) {
      const batch = nodeIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (nodeId) => {
        try {
          const recs = await this.generateRecommendations(nodeId);
          return { nodeId, recs };
        } catch (error) {
          console.error(`Failed to generate recommendations for ${nodeId}:`, error);
          return { nodeId, recs: [] };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ nodeId, recs }) => {
        results.set(nodeId, recs);
      });

      if (onProgress) {
        onProgress(Math.min(i + batchSize, nodeIds.length), nodeIds.length);
      }
    }

    return results;
  }
}
