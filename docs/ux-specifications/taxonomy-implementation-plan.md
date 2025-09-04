# Taxonomy Visualization - Implementation Plan

## Executive Summary

Based on the Playwright review and Sprint 4 feature analysis, this document provides a detailed implementation plan to transform the taxonomy visualization into a comprehensive, data-rich optimization platform.

## Current State Assessment

### What's Working ✅

- Basic D3 force-directed graph visualization
- Three view modes (Cards, Tree, Graph)
- Authentication and navigation
- Good performance (<1.2s load time)
- Zoom controls

### What's Missing ❌

- Product-level differentiation
- Sprint 4 feature integration (scores, revenue, recommendations)
- Google Shopping feed data
- Detail panels with actionable insights
- Bulk operations
- Visual distinction between categories and products

## Implementation Roadmap

## Phase 1: Product-Level Enhancement (Priority: CRITICAL)

### 1.1 Enhanced Product Card Component

Create a new component specifically for product-level nodes:

```typescript
// components/taxonomy/ProductCard.tsx
interface ProductCardProps {
  node: ProductNode;
  shoppingData?: GoogleShoppingData;
  opportunityScore?: number;
  recommendations?: AIRecommendation[];
  onSelect: (id: string) => void;
  onBulkSelect: (id: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  node,
  shoppingData,
  opportunityScore,
  recommendations,
  onSelect,
  onBulkSelect
}) => {
  return (
    <div className="product-card" data-depth={node.depth}>
      {/* Product Image Section */}
      <div className="product-image-container">
        {shoppingData?.imageUrl ? (
          <img
            src={shoppingData.imageUrl}
            alt={node.title}
            className="product-image"
            loading="lazy"
          />
        ) : (
          <div className="image-placeholder">
            <CameraOff className="w-8 h-8 text-gray-400" />
            <span className="text-xs">No image</span>
          </div>
        )}

        {/* Opportunity Score Badge */}
        <div className={`score-badge ${getScoreClass(opportunityScore)}`}>
          {opportunityScore?.toFixed(1)}/10
        </div>
      </div>

      {/* Product Info Section */}
      <div className="product-info">
        <h3 className="product-title">{node.title}</h3>

        {shoppingData && (
          <div className="product-meta">
            <span className="price">${shoppingData.price}</span>
            <span className="availability">
              {shoppingData.inStock ? '✅ In Stock' : '❌ Out of Stock'}
            </span>
          </div>
        )}

        {/* Content Health Indicators */}
        <div className="content-health">
          <HealthIndicator
            label="Description"
            value={node.descriptionLength}
            target={500}
          />
          <HealthIndicator
            label="Images"
            value={shoppingData?.imageCount || 0}
            target={8}
          />
        </div>

        {/* Revenue Projection */}
        {node.revenueProjection && (
          <div className="revenue-projection">
            <span className="label">Potential:</span>
            <span className="value">+${node.revenueProjection.realistic}/mo</span>
          </div>
        )}

        {/* Top Recommendation */}
        {recommendations?.[0] && (
          <div className="top-recommendation">
            <LightbulbIcon className="w-4 h-4" />
            <span className="text-sm">{recommendations[0].title}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="product-actions">
        <button onClick={() => onSelect(node.id)}>View Details</button>
        <button onClick={() => onBulkSelect(node.id)}>
          <CheckSquare className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
```

### 1.2 Visual Differentiation CSS

```scss
// styles/taxonomy-products.scss

// Category cards - larger, summary focused
.category-card {
  min-width: 280px;
  min-height: 180px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-top: 16px;
  }
}

// Product cards - compact, data-rich
.product-card {
  width: 240px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
    border-color: #8b5cf6;
  }

  .product-image-container {
    position: relative;
    height: 160px;
    background: #f9fafb;

    .product-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .score-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 12px;

      &.high {
        background: #10b981;
        color: white;
      }
      &.medium {
        background: #f59e0b;
        color: white;
      }
      &.low {
        background: #ef4444;
        color: white;
      }
    }
  }

  .product-info {
    padding: 12px;

    .product-title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.3;
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .product-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .price {
        font-size: 18px;
        font-weight: 700;
        color: #059669;
      }

      .availability {
        font-size: 12px;
      }
    }
  }

  .content-health {
    display: flex;
    gap: 8px;
    margin: 8px 0;
  }

  .revenue-projection {
    background: #fef3c7;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;

    .value {
      font-weight: 600;
      color: #92400e;
    }
  }
}
```

## Phase 2: Sprint 4 Integration (Priority: HIGH)

### 2.1 Data Flow Integration

```typescript
// lib/taxonomy/enrichData.ts
import { OpportunityScorer } from '@/lib/scoring/opportunity-scorer';
import { RevenueCalculator } from '@/lib/scoring/revenue-calculator';
import { RecommendationsEngine } from '@/lib/ai/recommendations-engine';

export async function enrichTaxonomyData(nodes: TaxonomyNode[]) {
  const scorer = new OpportunityScorer();
  const calculator = new RevenueCalculator();
  const engine = new RecommendationsEngine();

  // Process in batches for performance
  const enrichedNodes = await Promise.all(
    nodes.map(async (node) => {
      // Skip categories, only process products
      if (node.depth < 3) {
        return node;
      }

      // Calculate opportunity score
      const score = await scorer.calculateScore({
        ctr: node.metrics?.ctr,
        position: node.metrics?.position,
        impressions: node.metrics?.impressions,
        // ... other metrics
      });

      // Calculate revenue projection
      const projection = calculator.project({
        currentRevenue: node.revenue,
        opportunityScore: score.value,
        // ... other parameters
      });

      // Generate recommendations
      const recommendations = await engine.generate(node, score);

      return {
        ...node,
        opportunityScore: score,
        revenueProjection: projection,
        recommendations: recommendations.slice(0, 3), // Top 3
      };
    })
  );

  return enrichedNodes;
}
```

### 2.2 Real-time Updates via WebSocket

```typescript
// hooks/useTaxonomyUpdates.ts
export function useTaxonomyUpdates(nodeIds: string[]) {
  const [updates, setUpdates] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/taxonomy-updates`);

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (nodeIds.includes(update.nodeId)) {
        setUpdates((prev) => new Map(prev).set(update.nodeId, update));
      }
    };

    return () => ws.close();
  }, [nodeIds]);

  return updates;
}
```

## Phase 3: Detail Panel Enhancement (Priority: HIGH)

### 3.1 Rich Detail Panel Component

```typescript
// components/taxonomy/NodeDetailPanel.tsx
const NodeDetailPanel: React.FC<{ node: EnhancedNode }> = ({ node }) => {
  const isProduct = node.depth >= 3;

  return (
    <div className="detail-panel">
      {/* Header with breadcrumbs */}
      <Breadcrumbs path={node.path} />

      {/* Main content area */}
      {isProduct ? (
        <ProductDetailView node={node} />
      ) : (
        <CategoryDetailView node={node} />
      )}

      {/* Sprint 4 Features Section */}
      <div className="metrics-section">
        <MetricCard
          title="Opportunity Score"
          value={node.opportunityScore}
          trend={node.scoreTrend}
          details={node.scoreFactors}
        />

        <MetricCard
          title="Revenue Potential"
          value={node.revenueProjection}
          scenarios={node.whatIfScenarios}
        />

        <MetricCard
          title="Performance Gap"
          value={node.ctrGap}
          benchmark={node.industryBenchmark}
        />
      </div>

      {/* Recommendations Section */}
      <RecommendationsPanel
        recommendations={node.recommendations}
        onImplement={(rec) => implementRecommendation(rec)}
      />

      {/* Action Buttons */}
      <div className="actions">
        <button className="btn-primary">
          Optimize Now
        </button>
        <button className="btn-secondary">
          Add to Bulk Queue
        </button>
        <button className="btn-tertiary">
          View in GSC
        </button>
      </div>
    </div>
  );
};
```

## Phase 4: Bulk Operations (Priority: MEDIUM)

### 4.1 Bulk Selection UI

```typescript
// components/taxonomy/BulkOperationsBar.tsx
const BulkOperationsBar: React.FC = () => {
  const { selectedNodes, clearSelection } = useBulkSelection();

  if (selectedNodes.length === 0) return null;

  return (
    <div className="bulk-operations-bar">
      <div className="selection-info">
        <CheckSquare className="w-5 h-5" />
        <span>{selectedNodes.length} items selected</span>
        <button onClick={clearSelection}>Clear</button>
      </div>

      <div className="bulk-actions">
        <button onClick={() => optimizeSelected('descriptions')}>
          Optimize Descriptions
        </button>
        <button onClick={() => optimizeSelected('images')}>
          Generate Image Prompts
        </button>
        <button onClick={() => exportSelected()}>
          Export Data
        </button>
      </div>

      <div className="impact-preview">
        <span>Est. Impact:</span>
        <span className="value">+${calculateBulkImpact(selectedNodes)}/mo</span>
      </div>
    </div>
  );
};
```

## Phase 5: Google Shopping Integration (Priority: MEDIUM)

### 5.1 API Integration

```typescript
// app/api/shopping-feed/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nodeIds = searchParams.get('nodeIds')?.split(',');

  // Fetch from Google Merchant Center API
  const shoppingData = await fetchGoogleShoppingData(nodeIds);

  // Transform and enrich
  const enrichedData = shoppingData.map((item) => ({
    nodeId: item.id,
    price: item.price.value,
    currency: item.price.currency,
    imageUrl: item.imageLink,
    additionalImages: item.additionalImageLinks,
    availability: item.availability,
    condition: item.condition,
    brand: item.brand,
    gtin: item.gtin,
    mpn: item.mpn,
    description: item.description,
    productHighlights: item.productHighlights,
    shippingWeight: item.shippingWeight,
    customAttributes: item.customAttributes,
  }));

  return NextResponse.json(enrichedData);
}
```

### 5.2 Frontend Integration

```typescript
// hooks/useShoppingData.ts
export function useShoppingData(nodeIds: string[]) {
  return useQuery({
    queryKey: ['shopping-data', nodeIds],
    queryFn: () => fetch(`/api/shopping-feed?nodeIds=${nodeIds.join(',')}`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: nodeIds.length > 0,
  });
}
```

## Implementation Timeline

### Week 1: Foundation

- [ ] Create ProductCard component
- [ ] Implement visual differentiation CSS
- [ ] Set up data enrichment pipeline
- [ ] Integrate opportunity scoring

### Week 2: Sprint 4 Features

- [ ] Surface opportunity scores on cards
- [ ] Display revenue projections
- [ ] Add inline recommendations
- [ ] Implement detail panel

### Week 3: Interactivity

- [ ] Build bulk selection system
- [ ] Create bulk operations bar
- [ ] Add real-time updates
- [ ] Implement quick actions

### Week 4: Polish & Integration

- [ ] Integrate Google Shopping feed
- [ ] Add animations and transitions
- [ ] Performance optimization
- [ ] Testing and refinement

## Success Metrics

### Quantitative

- Time to identify optimization opportunity: < 3 seconds
- Bulk operation completion: 10x faster than individual
- Data sync accuracy: 99.9%
- Page render time: < 100ms per card

### Qualitative

- Clear visual hierarchy between categories and products
- Intuitive navigation through taxonomy levels
- Actionable insights at every level
- Seamless bulk operations workflow

## Technical Considerations

### Performance Optimizations

1. **Virtual Scrolling**: Only render visible cards
2. **Lazy Loading**: Progressive image loading
3. **Data Pagination**: Load nodes in chunks
4. **Memoization**: Cache expensive calculations
5. **Web Workers**: Offload scoring calculations

### Accessibility

1. **ARIA Labels**: Proper labeling for screen readers
2. **Keyboard Navigation**: Full keyboard support
3. **Focus Management**: Clear focus indicators
4. **Color Contrast**: WCAG AA compliance

## Conclusion

This implementation plan transforms the taxonomy visualization from a basic tree structure into a comprehensive optimization platform. By focusing on product-level differentiation, Sprint 4 feature integration, and rich data visualization, users will be able to quickly identify and action high-value optimization opportunities at scale.

The phased approach ensures steady progress while maintaining system stability. Each phase delivers tangible value, with the complete implementation creating a powerful, intuitive interface for SEO and content optimization.
