# STORY-025: Category Basket AOV & Cross-Sell Analytics

## Story Overview

**ID**: STORY-025-basket-aov
**Sprint**: Sprint 7
**Status**: Draft
**Priority**: Medium
**Effort**: 8 points
**Type**: Feature

## User Story

### As a

E-commerce merchandising manager

### I want to

See the true economic value each category brings including cross-category purchases

### So that

I can identify and promote gateway categories that drive larger basket sizes and optimize category mix for maximum revenue

## Acceptance Criteria

### Data Layer

- [ ] Calculate and store Direct AOV (items from category only)
- [ ] Calculate and store Basket AOV (total order value when category present)
- [ ] Calculate and store Attach Rate (additional items ratio)
- [ ] Track cross-category purchase patterns
- [ ] Store attribution data with configurable attribution window (default: 30 days)

### Card View Display

- [ ] Display Basket AOV as primary metric on category cards
- [ ] Format: "$450 basket" with tooltip on hover
- [ ] Color code based on performance vs. average (green/yellow/red)

### Sidebar Analytics

- [ ] Show all three metrics in Revenue section:
  - Direct AOV with trend
  - Basket AOV with trend
  - Attach Rate with visual indicator
- [ ] Display "Cross-Sell Power" score (1-5 stars)
- [ ] List top 3 categories frequently bought together

### Hover States & Education

- [ ] Tooltip explains Basket AOV on hover
- [ ] Show mini breakdown on extended hover (2 sec):
  ```
  When Electronics purchased:
  • Direct spend: $380
  • + Other items: $70
  • = Total basket: $450
  ```

### Sorting & Filtering

- [ ] Add "Basket AOV" as sort option
- [ ] Add "High Attach Rate" filter (>1.5x)
- [ ] Add "Gateway Categories" smart filter

## Technical Requirements

### Database Schema

```sql
-- New tables/columns needed
CREATE TABLE category_attribution_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES taxonomy_nodes(id),
  period_date DATE NOT NULL,
  direct_aov DECIMAL(10,2),
  basket_aov DECIMAL(10,2),
  attach_rate DECIMAL(5,2),
  cross_sell_categories JSONB, -- array of frequently bought with
  influence_score DECIMAL(5,2),
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_id, period_date)
);

CREATE TABLE order_category_attribution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES taxonomy_nodes(id),
  attribution_type VARCHAR(20), -- 'direct' | 'influenced' | 'cross_sell'
  attribution_value DECIMAL(10,2),
  attribution_weight DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cat_metrics_category_period ON category_attribution_metrics(category_id, period_date DESC);
CREATE INDEX idx_order_attribution_order ON order_category_attribution(order_id);
CREATE INDEX idx_order_attribution_category ON order_category_attribution(category_id);
```

### Calculation Logic

```typescript
interface CategoryAOVMetrics {
  directAOV: number; // Sum of category items / orders
  basketAOV: number; // Sum of full orders / orders with category
  attachRate: number; // Additional items / category items
  crossSellPower: number; // (basketAOV - directAOV) / directAOV
  topAttachments: Array<{
    categoryId: string;
    categoryName: string;
    frequency: number;
    averageValue: number;
  }>;
}

class BasketAOVCalculator {
  async calculate(categoryId: string, period: DateRange): Promise<CategoryAOVMetrics> {
    // 1. Get all orders containing this category
    const ordersWithCategory = await this.getOrdersWithCategory(categoryId, period);

    // 2. Calculate direct AOV (category items only)
    const directRevenue = ordersWithCategory.reduce(
      (sum, order) => sum + order.categoryItemsValue,
      0
    );
    const directAOV = directRevenue / ordersWithCategory.length;

    // 3. Calculate basket AOV (full order value)
    const totalRevenue = ordersWithCategory.reduce((sum, order) => sum + order.totalValue, 0);
    const basketAOV = totalRevenue / ordersWithCategory.length;

    // 4. Calculate attach rate
    const totalItems = ordersWithCategory.reduce((sum, order) => sum + order.totalItemCount, 0);
    const categoryItems = ordersWithCategory.reduce(
      (sum, order) => sum + order.categoryItemCount,
      0
    );
    const attachRate = totalItems / categoryItems;

    // 5. Identify top cross-sell categories
    const topAttachments = await this.getTopCrossSellCategories(categoryId, ordersWithCategory);

    return {
      directAOV,
      basketAOV,
      attachRate,
      crossSellPower: (basketAOV - directAOV) / directAOV,
      topAttachments,
    };
  }
}
```

### Performance Considerations

- [ ] Cache calculations with 1-hour TTL
- [ ] Background job for daily recalculation
- [ ] Incremental updates for real-time orders
- [ ] Optimize queries with materialized views

## Implementation Phases

### Phase 1: MVP (Sprint 7)

- Basic Basket AOV calculation
- Display on cards and sidebar
- Simple tooltip explanation
- Database schema setup

### Phase 2: Enhanced Analytics (Sprint 8)

- Cross-category journey tracking
- Attach rate patterns
- Time-decay attribution
- Advanced filtering

### Phase 3: AI Insights (Sprint 9)

- Predictive basket composition
- Recommended bundles based on patterns
- Anomaly detection for unusual combinations
- Personalized insights

## Definition of Done

- [ ] Basket AOV visible on all category cards
- [ ] Detailed metrics available in sidebar
- [ ] Calculations accurate with test data validation
- [ ] Performance: Metrics load in <100ms
- [ ] Documentation of attribution methodology
- [ ] Unit tests with >80% coverage
- [ ] Integration tests for calculation pipeline
- [ ] A/B test setup to measure impact on decision-making
- [ ] Analytics tracking for metric usage

## Success Metrics

- **Adoption**: 80% of users view Basket AOV weekly
- **Action**: 30% increase in gateway category promotions
- **Impact**: 15% increase in overall AOV within 3 months
- **Understanding**: <5% support tickets about metric meaning

## Dependencies

- **Requires**:
  - Order data with category associations
  - Real-time order processing pipeline
  - STORY-023-metrics-integration-layer

- **Blocks**:
  - Bundle recommendation system
  - Advanced merchandising features

- **Related to**:
  - STORY-024-cross-category-analytics
  - STORY-012-opportunity-scoring

## Example Scenarios

### Scenario 1: Gateway Category Discovery

```gherkin
Given: Electronics has Direct AOV of $200 but Basket AOV of $450
When: Merchant views category performance
Then: System highlights Electronics as "Gateway Category"
And: Shows insight "Drives +$250 in additional purchases"
And: Recommends "Feature prominently on homepage"
```

### Scenario 2: Cross-Sell Optimization

```gherkin
Given: Sports category has high attach rate (2.3x)
When: Merchant clicks for details
Then: Shows "Frequently bought with: Accessories (65%), Nutrition (45%)"
And: Suggests "Create Sports + Accessories bundle"
```

### Scenario 3: Sorting by Basket AOV

```gherkin
Given: User is on taxonomy card view
When: User selects "Sort by Basket AOV"
Then: Categories are reordered by basket AOV descending
And: Top performing gateway categories appear first
And: Basket AOV values are prominently displayed
```

## UI/UX Mockup Description

### Card View Enhancement

```
┌─────────────────────────────────┐
│ Electronics          [Health 85%]│
│ ─────────────────────────────── │
│ 👁️ Impressions: 125K/mo         │
│ 🎯 CTR: 4.5% | CVR: 2.3%        │
│ 💰 Revenue: $45K                 │
│ 🛒 Basket: $450 | +$250 cross   │  <- NEW
│ 🚀 Opportunity: 7.8/10          │
└─────────────────────────────────┘
```

### Sidebar Deep Dive

```
┌─── Revenue Analytics ───────────┐
│                                 │
│ 📊 AOV Breakdown                │
│ ├─ Direct AOV: $200            │
│ ├─ Basket AOV: $450 ↗ +12%     │
│ └─ Cross-sell lift: +125%      │
│                                 │
│ 🔗 Attach Rate: 2.3x           │
│ ⭐ Cross-Sell Power: ████░     │
│                                 │
│ 🛒 Frequently Bought Together   │
│ 1. Accessories (65% of orders)  │
│ 2. Warranties (45% of orders)   │
│ 3. Cables (38% of orders)       │
│                                 │
│ 💡 Insight: Gateway category    │
│ This category drives high       │
│ value cross-category purchases  │
│                                 │
│ [Create Bundle] [View Details]  │
└─────────────────────────────────┘
```

## Notes

- This feature directly impacts merchandising decisions and promotional strategies
- Consider privacy implications of tracking cross-category behavior
- Ensure calculations are transparent and auditable
- Plan for education/onboarding to help users understand new metrics

## Change Log

- 2025-01-17: Story created by Sarah (Product Owner)
- Status: Draft, awaiting review and estimation
