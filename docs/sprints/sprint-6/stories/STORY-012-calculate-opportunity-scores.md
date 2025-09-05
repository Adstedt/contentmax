# STORY-012: Calculate Opportunity Scores

## Story Overview

**Story ID:** STORY-012  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P2 - Medium  
**Estimated Effort:** 4 hours  
**Story Points:** 5  

## User Story

As a **category strategist**,  
I want **opportunity scores calculated for each category**,  
So that **I can prioritize which categories to optimize first for maximum ROI**.

## Context

Opportunity scoring combines multiple metrics (search volume, conversion rate, competition, revenue) to identify categories with the highest potential for improvement and ROI.

## Acceptance Criteria

### Functional Requirements
1. ✅ Combine GSC, GA4, and product data
2. ✅ Calculate weighted opportunity score
3. ✅ Identify quick wins vs long-term opportunities
4. ✅ Rank categories by opportunity
5. ✅ Provide actionable recommendations

### Technical Requirements
6. ✅ Configurable scoring algorithm
7. ✅ Real-time score updates
8. ✅ Historical score tracking
9. ✅ Explainable scoring factors
10. ✅ Performance thresholds

### Algorithm Requirements
11. ✅ Factor in search demand
12. ✅ Consider conversion potential
13. ✅ Account for competition level
14. ✅ Weight by revenue impact

## Technical Implementation Notes

### Opportunity Scoring Algorithm
```typescript
// lib/scoring/opportunity-scorer.ts
export interface ScoringFactors {
  searchMetrics: {
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  };
  analyticsMetrics: {
    sessions: number;
    conversionRate: number;
    revenue: number;
    bounceRate: number;
  };
  productMetrics: {
    productCount: number;
    avgPrice: number;
    inStockRate: number;
    hasImages: number;
  };
  competitiveMetrics?: {
    domainAuthority: number;
    competitorCount: number;
    marketShare: number;
  };
}

export class OpportunityScorer {
  private weights = {
    searchPotential: 0.3,
    conversionPotential: 0.25,
    revenueImpact: 0.25,
    contentQuality: 0.1,
    competition: 0.1
  };
  
  calculateScore(factors: ScoringFactors): OpportunityScore {
    const scores = {
      searchPotential: this.calculateSearchPotential(factors.searchMetrics),
      conversionPotential: this.calculateConversionPotential(factors.analyticsMetrics),
      revenueImpact: this.calculateRevenueImpact(factors),
      contentQuality: this.calculateContentQuality(factors.productMetrics),
      competition: this.calculateCompetitionScore(factors.competitiveMetrics)
    };
    
    // Calculate weighted total
    const totalScore = Object.entries(scores).reduce((sum, [key, score]) => {
      return sum + (score * this.weights[key]);
    }, 0);
    
    // Determine opportunity type
    const opportunityType = this.classifyOpportunity(scores);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, scores);
    
    return {
      totalScore: Math.round(totalScore),
      components: scores,
      opportunityType,
      recommendations,
      confidence: this.calculateConfidence(factors)
    };
  }
  
  private calculateSearchPotential(metrics: any): number {
    // High impressions + low CTR = high potential
    const impressionScore = Math.min(metrics.impressions / 10000, 1) * 100;
    const ctrGap = Math.max(0, 0.05 - metrics.ctr) / 0.05 * 100; // Gap from 5% CTR
    const positionGap = Math.max(0, metrics.position - 1) / 10 * 100; // Gap from position 1
    
    return (impressionScore * 0.4 + ctrGap * 0.3 + positionGap * 0.3);
  }
  
  private calculateConversionPotential(metrics: any): number {
    // High traffic + low conversion = high potential
    const trafficScore = Math.min(metrics.sessions / 1000, 1) * 100;
    const conversionGap = Math.max(0, 0.03 - metrics.conversionRate) / 0.03 * 100; // Gap from 3% CVR
    const engagementScore = (1 - metrics.bounceRate) * 100;
    
    return (trafficScore * 0.4 + conversionGap * 0.4 + engagementScore * 0.2);
  }
  
  private calculateRevenueImpact(factors: any): number {
    const currentRevenue = factors.analyticsMetrics.revenue;
    const avgOrderValue = currentRevenue / (factors.analyticsMetrics.conversions || 1);
    const productValue = factors.productMetrics.avgPrice;
    
    // Estimate potential revenue increase
    const potentialSessions = factors.searchMetrics.impressions * 0.05; // 5% CTR target
    const potentialConversions = potentialSessions * 0.03; // 3% CVR target
    const potentialRevenue = potentialConversions * avgOrderValue;
    
    const revenueGap = potentialRevenue - currentRevenue;
    return Math.min(revenueGap / 10000, 100); // Normalize to 0-100
  }
  
  private calculateContentQuality(metrics: any): number {
    const factors = [
      metrics.productCount > 10 ? 1 : metrics.productCount / 10,
      metrics.inStockRate,
      metrics.hasImages,
      metrics.avgPrice > 0 ? 1 : 0
    ];
    
    return factors.reduce((sum, f) => sum + f, 0) / factors.length * 100;
  }
  
  private calculateCompetitionScore(metrics: any): number {
    if (!metrics) return 50; // Neutral if no competitive data
    
    // Lower competition = higher opportunity
    const competitionLevel = 100 - (metrics.competitorCount * 10);
    const authorityGap = Math.max(0, 70 - metrics.domainAuthority) / 70 * 100;
    
    return (competitionLevel * 0.6 + authorityGap * 0.4);
  }
  
  private classifyOpportunity(scores: any): string {
    const { searchPotential, conversionPotential, revenueImpact } = scores;
    
    if (searchPotential > 70 && conversionPotential > 70) {
      return 'quick_win';
    } else if (revenueImpact > 80) {
      return 'high_value';
    } else if (searchPotential > 80) {
      return 'seo_opportunity';
    } else if (conversionPotential > 80) {
      return 'cro_opportunity';
    } else {
      return 'maintenance';
    }
  }
  
  private generateRecommendations(factors: any, scores: any): string[] {
    const recommendations = [];
    
    // SEO recommendations
    if (scores.searchPotential > 70) {
      if (factors.searchMetrics.position > 3) {
        recommendations.push('Improve page SEO to target top 3 positions');
      }
      if (factors.searchMetrics.ctr < 0.02) {
        recommendations.push('Optimize meta title and description for higher CTR');
      }
    }
    
    // Conversion recommendations
    if (scores.conversionPotential > 70) {
      if (factors.analyticsMetrics.bounceRate > 0.7) {
        recommendations.push('Improve page content to reduce bounce rate');
      }
      if (factors.analyticsMetrics.conversionRate < 0.01) {
        recommendations.push('Add clear CTAs and optimize conversion funnel');
      }
    }
    
    // Content recommendations
    if (scores.contentQuality < 50) {
      if (factors.productMetrics.productCount < 5) {
        recommendations.push('Add more products to this category');
      }
      if (factors.productMetrics.hasImages < 0.8) {
        recommendations.push('Add high-quality images for all products');
      }
    }
    
    return recommendations;
  }
  
  private calculateConfidence(factors: any): number {
    // Higher data volume = higher confidence
    const dataPoints = [
      factors.searchMetrics.impressions > 100 ? 1 : 0,
      factors.analyticsMetrics.sessions > 50 ? 1 : 0,
      factors.productMetrics.productCount > 5 ? 1 : 0
    ];
    
    return dataPoints.reduce((sum, p) => sum + p, 0) / dataPoints.length;
  }
}
```

### Score Storage and Tracking
```sql
-- migrations/add_opportunity_scores_table.sql
CREATE TABLE opportunity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  
  -- Overall score
  total_score INTEGER NOT NULL,
  opportunity_type VARCHAR(50),
  confidence DECIMAL(3,2),
  
  -- Component scores
  search_potential INTEGER,
  conversion_potential INTEGER,
  revenue_impact INTEGER,
  content_quality INTEGER,
  competition_score INTEGER,
  
  -- Recommendations
  recommendations TEXT[],
  
  -- Metrics snapshot
  metrics_snapshot JSONB,
  
  -- Tracking
  calculated_at TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  
  -- Historical tracking
  previous_score INTEGER,
  score_change INTEGER,
  trend VARCHAR(20), -- 'improving', 'declining', 'stable'
  
  CONSTRAINT unique_node_score_date UNIQUE (node_id, calculated_at)
);

CREATE INDEX idx_opportunity_scores_node ON opportunity_scores(node_id);
CREATE INDEX idx_opportunity_scores_total ON opportunity_scores(total_score DESC);
CREATE INDEX idx_opportunity_scores_type ON opportunity_scores(opportunity_type);

-- Score history for trending
CREATE TABLE score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  recorded_at DATE NOT NULL,
  
  CONSTRAINT unique_node_score_history UNIQUE (node_id, recorded_at)
);
```

### Scoring Service
```typescript
// lib/services/scoring-service.ts
export class ScoringService {
  private scorer: OpportunityScorer;
  
  constructor() {
    this.scorer = new OpportunityScorer();
  }
  
  async calculateScoresForAllNodes() {
    const nodes = await this.getNodesWithMetrics();
    const scores = [];
    
    for (const node of nodes) {
      const factors = await this.gatherScoringFactors(node);
      const score = this.scorer.calculateScore(factors);
      
      scores.push({
        node_id: node.id,
        ...score,
        metrics_snapshot: factors
      });
    }
    
    // Store scores
    await this.storeScores(scores);
    
    // Update trends
    await this.updateScoreTrends();
    
    return scores;
  }
  
  private async gatherScoringFactors(node: any): Promise<ScoringFactors> {
    const [searchMetrics, analyticsMetrics, productMetrics] = await Promise.all([
      this.getSearchMetrics(node.id),
      this.getAnalyticsMetrics(node.id),
      this.getProductMetrics(node.id)
    ]);
    
    return {
      searchMetrics,
      analyticsMetrics,
      productMetrics
    };
  }
  
  private async updateScoreTrends() {
    const query = `
      WITH score_changes AS (
        SELECT 
          node_id,
          total_score,
          LAG(total_score) OVER (PARTITION BY node_id ORDER BY calculated_at) as previous_score
        FROM opportunity_scores
        WHERE calculated_at > NOW() - INTERVAL '7 days'
      )
      UPDATE opportunity_scores
      SET 
        previous_score = sc.previous_score,
        score_change = total_score - COALESCE(sc.previous_score, total_score),
        trend = CASE
          WHEN total_score - COALESCE(sc.previous_score, total_score) > 5 THEN 'improving'
          WHEN total_score - COALESCE(sc.previous_score, total_score) < -5 THEN 'declining'
          ELSE 'stable'
        END
      FROM score_changes sc
      WHERE opportunity_scores.node_id = sc.node_id
        AND opportunity_scores.calculated_at = (
          SELECT MAX(calculated_at) 
          FROM opportunity_scores os2 
          WHERE os2.node_id = sc.node_id
        );
    `;
    
    await supabase.rpc('execute_sql', { query });
  }
}
```

### API Endpoint
```typescript
// app/api/scoring/calculate/route.ts
export async function POST(request: NextRequest) {
  const session = await requireAuth(request);
  
  try {
    const scoringService = new ScoringService();
    
    // Calculate scores for all nodes
    const scores = await scoringService.calculateScoresForAllNodes();
    
    // Get top opportunities
    const topOpportunities = scores
      .sort((a, b) => b.total_score - a.total_score)
      .slice(0, 10);
    
    // Get quick wins
    const quickWins = scores
      .filter(s => s.opportunity_type === 'quick_win')
      .slice(0, 5);
    
    return NextResponse.json({
      success: true,
      stats: {
        nodesScored: scores.length,
        avgScore: scores.reduce((sum, s) => sum + s.total_score, 0) / scores.length,
        topOpportunities,
        quickWins
      }
    });
  } catch (error) {
    console.error('Scoring calculation failed:', error);
    return NextResponse.json(
      { error: 'Failed to calculate opportunity scores' },
      { status: 500 }
    );
  }
}
```

## Dependencies

- Requires STORY-010 and STORY-011 completion (metrics data)
- All metrics tables populated
- Node hierarchy established

## Testing Requirements

### Unit Tests
```typescript
describe('OpportunityScorer', () => {
  it('calculates search potential correctly');
  it('calculates conversion potential correctly');
  it('calculates revenue impact correctly');
  it('classifies opportunities accurately');
  it('generates relevant recommendations');
  it('handles missing data gracefully');
});
```

### Integration Tests
- Test with real metrics data
- Verify score consistency
- Test trend calculations
- Validate recommendations

## Definition of Done

- [ ] Scoring algorithm implemented
- [ ] All factors calculated correctly
- [ ] Recommendations generated
- [ ] Scores stored in database
- [ ] Trends tracked over time
- [ ] API endpoint working
- [ ] Scores displayed in UI
- [ ] Unit tests passing
- [ ] Algorithm validated with business

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `lib/scoring/opportunity-scorer.ts` (new)
- `lib/services/scoring-service.ts` (new)
- `migrations/add_opportunity_scores_table.sql` (new)
- `app/api/scoring/calculate/route.ts` (new)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned