import { NextRequest, NextResponse } from 'next/server';
import { RecommendationsEngine } from '@/lib/ai/recommendations-engine';
import { createClient } from '@/lib/supabase/server';

// Test endpoint to demonstrate recommendations
export async function GET(request: NextRequest) {
  try {
    // For demo purposes, we'll use template mode (no AI required)
    const supabase = createClient();

    // Create demo context
    const demoRecommendations = {
      node: {
        id: 'demo-node',
        url: 'https://example.com/category/electronics',
        path: '/category/electronics',
        title: 'Electronics',
        content_status: 'missing', // This will trigger recommendations
      },
      opportunity: {
        score: 75,
        factors: {
          ctrGap: 45, // High CTR gap
          searchVolume: 80,
          positionPotential: 70,
          competition: 60,
          revenue: 85,
        },
        revenue_potential: 50000,
      },
      recommendations: [
        {
          type: 'content',
          priority: 'high',
          effort: 'medium',
          impact: 'high',
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
        {
          type: 'technical',
          priority: 'high',
          effort: 'low',
          impact: 'high',
          title: 'Optimize Meta Tags for CTR',
          description:
            'Current CTR is 45% below expected for this position. Improving title and description can increase traffic without ranking changes.',
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
        {
          type: 'structural',
          priority: 'medium',
          effort: 'medium',
          impact: 'medium',
          title: 'Improve Internal Linking Structure',
          description:
            'Better internal linking will distribute PageRank and help users discover related content.',
          implementation: `
1. Add contextual links to related categories
2. Link to top-performing products
3. Create breadcrumb navigation
4. Add related categories section
5. Implement "Popular in Electronics" widget`,
          successMetrics: [
            'Reduced bounce rate by 15%',
            'Increased pages per session',
            'Better crawlability',
          ],
          estimatedTimeframe: '1 week',
        },
      ],
    };

    return NextResponse.json({
      message: 'Recommendations Engine Demo',
      description: 'This shows what the recommendations look like for a sample node',
      data: demoRecommendations,
      howToUse: {
        step1: 'These recommendations would appear when clicking on a taxonomy node',
        step2: 'Each recommendation has priority, effort, and impact scores',
        step3: 'Implementation steps are specific and actionable',
        step4: 'Success metrics help track improvement',
      },
    });
  } catch (error) {
    console.error('Demo error:', error);
    return NextResponse.json({ error: 'Failed to generate demo recommendations' }, { status: 500 });
  }
}
