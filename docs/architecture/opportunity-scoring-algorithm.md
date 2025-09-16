# Opportunity Scoring Algorithm

## Overview

The opportunity scoring algorithm identifies and ranks category optimization opportunities by combining traffic potential, revenue potential, and pricing opportunities.

## Scoring Factors

### 1. Traffic Potential (25% weight)

- **CTR Gap**: Difference between expected and actual CTR based on position
- **Position Improvement**: Potential to improve search rankings
- **Impression Volume**: Untapped search demand
- **Formula**: `(CTR_gap * 50) + (position_gap * 30) + (impression_factor * 20)`

### 2. Revenue Potential (30% weight)

- **Conversion Gap**: Below-average conversion rates
- **AOV Gap**: Below-average order values
- **Monetization Gap**: Traffic without revenue
- **Formula**: `(conv_gap * 40) + (aov_gap * 30) + (monetization_gap * 30)`

### 3. Pricing Opportunity (25% weight)

- **Below Market**: Opportunity to increase prices
- **Above Market**: May be hurting conversion
- **At Market**: Limited opportunity
- **Formula**: `price_position_factor * margin_impact`

### 4. Competitive Gap (10% weight)

- **Market Share**: Current position vs competitors
- **Content Quality**: Product data completeness
- **Formula**: `(market_share_gap * 60) + (content_gap * 40)`

### 5. Content Quality (10% weight)

- **Data Completeness**: Missing attributes
- **Media Quality**: Image/video coverage
- **Formula**: `(completeness * 70) + (media_coverage * 30)`

## Composite Score Calculation

```
opportunity_score =
  (traffic_potential * 0.25) +
  (revenue_potential * 0.30) +
  (pricing_opportunity * 0.25) +
  (competitive_gap * 0.10) +
  (content_quality * 0.10)
```

## Opportunity Categorization

| Category    | Score | Effort | Description                |
| ----------- | ----- | ------ | -------------------------- |
| Quick Win   | >70   | <30    | High impact, low effort    |
| Strategic   | >70   | ≥30    | High impact, high effort   |
| Incremental | 40-70 | <30    | Medium impact, low effort  |
| Long-term   | 40-70 | ≥30    | Medium impact, high effort |
| Maintain    | <40   | Any    | Currently performing well  |

## Confidence Levels

- **High**: 3+ data sources available
- **Medium**: 2 data sources available
- **Low**: 1 data source available

## Projected Impact

- **Revenue Impact**: `current_revenue * (score/100) * conversion_improvement_factor`
- **Traffic Impact**: `current_traffic * (position_improvement_factor)`
- **Timeline**: Based on effort estimation and resource availability
