# Sprint 4: Intelligence Layer

## Week 4 - Opportunity Scoring & Revenue Insights

### Sprint Goal

Implement the opportunity scoring algorithm and revenue potential calculations to identify and prioritize optimization opportunities across the taxonomy.

### Success Criteria

- [ ] Opportunity scoring algorithm implemented
- [ ] Revenue potential calculations accurate
- [ ] Top 100 opportunities identified
- [ ] Scoring factors documented
- [ ] Bulk processing optimized

---

## Technical Tasks

### 4.1 Opportunity Scoring Algorithm

**Priority**: P0 - Critical
**Estimate**: 8 hours

```typescript
// lib/scoring/opportunity-scorer.ts
export interface ScoringFactors {
  searchVolume: number; // 0-1 normalized
  ctrGap: number; // 0-1 (actual vs expected CTR)
  positionPotential: number; // 0-1 (improvement potential)
  competition: number; // 0-1 (inverse of difficulty)
  revenueImpact: number; // 0-1 normalized
}

export class OpportunityScorer {
  private weights = {
    searchVolume: 0.25,
    ctrGap: 0.3,
    positionPotential: 0.2,
    competition: 0.1,
    revenueImpact: 0.15,
  };

  calculateScore(node: CategoryNode): OpportunityScore {
    const factors = this.calculateFactors(node);
    const weightedScore = this.applyWeights(factors);
    const confidence = this.calculateConfidence(node);

    return {
      nodeId: node.id,
      score: Math.round(weightedScore * 100),
      factors,
      confidence,
      recommendations: this.generateRecommendations(factors),
    };
  }

  private calculateFactors(node: CategoryNode): ScoringFactors {
    return {
      searchVolume: this.normalizeSearchVolume(node.metrics?.gsc?.impressions || 0),
      ctrGap: this.calculateCTRGap(node),
      positionPotential: this.calculatePositionPotential(node),
      competition: this.estimateCompetition(node),
      revenueImpact: this.normalizeRevenue(node.metrics?.ga4?.revenue || 0),
    };
  }

  private calculateCTRGap(node: CategoryNode): number {
    const actualCTR = node.metrics?.gsc?.ctr || 0;
    const position = node.metrics?.gsc?.position || 20;
    const expectedCTR = this.getExpectedCTR(position);

    // Gap is how much below expected we are
    const gap = Math.max(0, expectedCTR - actualCTR);
    return Math.min(1, gap / expectedCTR);
  }

  private getExpectedCTR(position: number): number {
    // Industry average CTR by position
    const ctrCurve = [
      { pos: 1, ctr: 0.285 },
      { pos: 2, ctr: 0.157 },
      { pos: 3, ctr: 0.094 },
      { pos: 4, ctr: 0.064 },
      { pos: 5, ctr: 0.049 },
      { pos: 6, ctr: 0.037 },
      { pos: 7, ctr: 0.029 },
      { pos: 8, ctr: 0.023 },
      { pos: 9, ctr: 0.019 },
      { pos: 10, ctr: 0.016 },
    ];

    const point = ctrCurve.find((p) => p.pos >= Math.floor(position));
    return point?.ctr || 0.01;
  }
}
```

### 4.2 Revenue Potential Calculator

**Priority**: P0 - Critical
**Estimate**: 6 hours

```typescript
// lib/scoring/revenue-calculator.ts
export class RevenuePotentialCalculator {
  calculatePotential(node: CategoryNode, targetPosition = 3): RevenuePotential {
    const current = this.getCurrentMetrics(node);
    const projected = this.projectMetrics(node, targetPosition);

    const additionalClicks = projected.clicks - current.clicks;
    const conversionRate = current.revenue / current.clicks || 0.02;
    const avgOrderValue = node.metrics?.ga4?.aov || 150;

    const monthlyRevenueLift = additionalClicks * conversionRate * avgOrderValue;
    const annualRevenueLift = monthlyRevenueLift * 12;

    return {
      current: {
        position: current.position,
        clicks: current.clicks,
        revenue: current.revenue,
      },
      projected: {
        position: targetPosition,
        clicks: projected.clicks,
        revenue: projected.revenue,
      },
      lift: {
        clicks: additionalClicks,
        clicksPercent: (additionalClicks / current.clicks) * 100,
        revenue: annualRevenueLift,
        revenuePercent: (annualRevenueLift / (current.revenue * 12)) * 100,
      },
      confidence: this.calculateConfidence(current),
      timeToImpact: this.estimateTimeToImpact(current.position, targetPosition),
    };
  }

  private projectMetrics(node: CategoryNode, targetPosition: number) {
    const impressions = node.metrics?.gsc?.impressions || 0;
    const projectedCTR = this.getExpectedCTR(targetPosition);
    const projectedClicks = impressions * projectedCTR;

    return {
      position: targetPosition,
      clicks: Math.round(projectedClicks),
      ctr: projectedCTR,
      revenue: this.projectRevenue(node, projectedClicks),
    };
  }

  private estimateTimeToImpact(currentPos: number, targetPos: number): number {
    // Weeks to see impact based on position improvement
    const positionDelta = currentPos - targetPos;
    if (positionDelta <= 3) return 2; // 2 weeks
    if (positionDelta <= 7) return 4; // 4 weeks
    if (positionDelta <= 15) return 8; // 8 weeks
    return 12; // 12 weeks
  }
}
```

### 4.3 Bulk Opportunity Processing

**Priority**: P1 - High
**Estimate**: 6 hours

```typescript
// lib/scoring/bulk-processor.ts
export class BulkOpportunityProcessor {
  private scorer: OpportunityScorer;
  private calculator: RevenuePotentialCalculator;

  async processAllNodes(batchSize = 100): Promise<OpportunityResults> {
    const nodes = await this.fetchAllNodes();
    const opportunities: Opportunity[] = [];

    // Process in batches for performance
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((node) => this.processNode(node)));
      opportunities.push(...batchResults.filter(Boolean));

      // Update progress
      await this.updateProgress(i / nodes.length);
    }

    // Rank and filter
    const ranked = this.rankOpportunities(opportunities);
    const top100 = ranked.slice(0, 100);

    // Store results
    await this.storeOpportunities(top100);

    return {
      total: nodes.length,
      processed: opportunities.length,
      top100,
      totalRevenuePotential: this.sumRevenuePotential(top100),
      processingTime: Date.now() - startTime,
    };
  }

  private rankOpportunities(opportunities: Opportunity[]): Opportunity[] {
    return opportunities.sort((a, b) => {
      // Primary sort by score
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 5) return scoreDiff;

      // Secondary sort by revenue potential
      return b.revenuePotential - a.revenuePotential;
    });
  }

  private async storeOpportunities(opportunities: Opportunity[]) {
    const query = `
      INSERT INTO opportunities (
        node_id, score, revenue_potential, priority, factors, computed_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (node_id) DO UPDATE SET
        score = EXCLUDED.score,
        revenue_potential = EXCLUDED.revenue_potential,
        priority = EXCLUDED.priority,
        factors = EXCLUDED.factors,
        computed_at = NOW()
    `;

    // Bulk insert with transaction
    await db.transaction(async (tx) => {
      for (const opp of opportunities) {
        await tx.execute(query, [
          opp.nodeId,
          opp.score,
          opp.revenuePotential,
          opp.priority,
          JSON.stringify(opp.factors),
        ]);
      }
    });
  }
}
```

### 4.4 Recommendation Engine

**Priority**: P1 - High
**Estimate**: 4 hours

```typescript
// lib/scoring/recommendations.ts
export class RecommendationEngine {
  generateRecommendations(node: CategoryNode, factors: ScoringFactors): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // CTR optimization
    if (factors.ctrGap > 0.3) {
      recommendations.push({
        type: 'ctr_optimization',
        priority: 'high',
        title: 'Improve Click-Through Rate',
        description: `CTR is ${(factors.ctrGap * 100).toFixed(1)}% below expected for position`,
        actions: [
          'Optimize meta title for relevance',
          'Improve meta description with clear value prop',
          'Add structured data for rich snippets',
        ],
        estimatedImpact: {
          clicks: '+' + Math.round(node.metrics.gsc.impressions * factors.ctrGap * 0.5),
          timeline: '2-4 weeks',
        },
      });
    }

    // Position improvement
    if (factors.positionPotential > 0.5) {
      const currentPos = node.metrics?.gsc?.position || 20;
      recommendations.push({
        type: 'position_improvement',
        priority: currentPos > 10 ? 'high' : 'medium',
        title: 'Improve Search Position',
        description: `Currently ranking #${currentPos.toFixed(1)}`,
        actions: [
          'Add comprehensive product descriptions',
          'Improve internal linking',
          'Enhance page speed and Core Web Vitals',
          'Build topical authority with related content',
        ],
        estimatedImpact: {
          position: `#${currentPos} → #${Math.max(3, currentPos - 7)}`,
          timeline: '4-8 weeks',
        },
      });
    }

    // Revenue optimization
    if (node.metrics?.ga4?.conversionRate < 0.01) {
      recommendations.push({
        type: 'conversion_optimization',
        priority: 'medium',
        title: 'Improve Conversion Rate',
        description: 'Conversion rate below 1%',
        actions: [
          'Add customer reviews and ratings',
          'Improve product filtering and sorting',
          'Add comparison features',
          'Optimize page load speed',
        ],
        estimatedImpact: {
          revenue: '+' + (node.metrics.ga4.revenue * 0.3).toFixed(0),
          timeline: '2-3 weeks',
        },
      });
    }

    return recommendations.sort(
      (a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority)
    );
  }

  private getPriorityWeight(priority: string): number {
    const weights = { high: 3, medium: 2, low: 1 };
    return weights[priority] || 0;
  }
}
```

### 4.5 Insights Dashboard API

**Priority**: P2 - Medium
**Estimate**: 4 hours

```typescript
// app/api/insights/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'overview';

  switch (view) {
    case 'overview':
      return Response.json(await getOverviewInsights());
    case 'opportunities':
      return Response.json(await getTopOpportunities());
    case 'trends':
      return Response.json(await getTrendAnalysis());
    case 'segments':
      return Response.json(await getSegmentAnalysis());
    default:
      return Response.json({ error: 'Invalid view' }, { status: 400 });
  }
}

async function getOverviewInsights() {
  const stats = await db.query(`
    SELECT 
      COUNT(*) as total_nodes,
      COUNT(CASE WHEN score > 80 THEN 1 END) as optimized,
      COUNT(CASE WHEN score BETWEEN 50 AND 80 THEN 1 END) as needs_work,
      COUNT(CASE WHEN score < 50 THEN 1 END) as critical,
      SUM(revenue_potential) as total_opportunity,
      AVG(score) as avg_score
    FROM opportunities
  `);

  return {
    summary: stats[0],
    distribution: await getScoreDistribution(),
    topCategories: await getTopCategoriesByOpportunity(),
    recentChanges: await getRecentScoreChanges(),
  };
}
```

---

## Testing Requirements

### Algorithm Tests

```typescript
describe('Opportunity Scoring', () => {
  test('calculates correct CTR gap', () => {
    const node = createTestNode({ position: 5, ctr: 0.02 });
    const gap = scorer.calculateCTRGap(node);
    expect(gap).toBeCloseTo(0.029); // Expected 0.049 - Actual 0.02
  });

  test('weights factors correctly', () => {
    const factors = {
      searchVolume: 0.8,
      ctrGap: 0.6,
      positionPotential: 0.4,
      competition: 0.3,
      revenueImpact: 0.7,
    };
    const score = scorer.applyWeights(factors);
    expect(score).toBeCloseTo(0.585); // Weighted average
  });

  test('generates appropriate recommendations', () => {
    const node = createTestNode({ position: 15, ctr: 0.005 });
    const recommendations = engine.generateRecommendations(node);
    expect(recommendations).toContainEqual(
      expect.objectContaining({ type: 'position_improvement' })
    );
  });
});
```

### Performance Tests

```typescript
describe('Bulk Processing', () => {
  test('processes 5000 nodes in under 30 seconds', async () => {
    const nodes = generateTestNodes(5000);
    const start = Date.now();
    await processor.processAllNodes();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(30000);
  });
});
```

---

## Scoring Documentation

### Factor Calculations

#### Search Volume (25% weight)

- Logarithmic normalization: `log(impressions + 1) / log(maxImpressions + 1)`
- Ensures large sites don't dominate

#### CTR Gap (30% weight)

- Difference between expected and actual CTR
- Expected CTR based on position curve
- Higher weight due to direct impact

#### Position Potential (20% weight)

- `(20 - currentPosition) / 20` for positions 1-20
- 0 for positions > 20
- Captures improvement opportunity

#### Competition (10% weight)

- Inverse of keyword difficulty
- Estimated from position volatility
- Lower weight due to estimation uncertainty

#### Revenue Impact (15% weight)

- Normalized by site's total revenue
- `nodeRevenue / totalRevenue`
- Ensures business value alignment

---

## Definition of Done

- [ ] Scoring algorithm implemented and tested
- [ ] Revenue calculations validated
- [ ] Top 100 opportunities identified
- [ ] Recommendations generated
- [ ] Bulk processing optimized
- [ ] API endpoints working
- [ ] Documentation complete
- [ ] Performance targets met

---

## Sprint Review Prep

**Demo Script**:

1. Run opportunity scoring on all nodes
2. Show top 10 opportunities with scores
3. Deep dive into #1 opportunity
4. Show revenue potential calculations
5. Display recommendations
6. Show processing performance

**Metrics to Share**:

- Nodes scored: 3000+
- Top opportunity score: X
- Total revenue potential: $X
- Processing time: X seconds
- Recommendations generated: X

---

## Next Sprint Preview

Sprint 5 will focus on:

- UI/UX polish
- Performance optimization
- Error handling
- Production deployment
- Documentation

**Handoff Requirements**:

- Scoring algorithm validated
- Opportunities stored in database
- API endpoints documented
- Ready for UI integration
