# STORY-014: Implement Integration Tests

## Story Overview

**Story ID:** STORY-014  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P2 - Medium  
**Estimated Effort:** 4 hours  
**Story Points:** 3  

## User Story

As a **QA engineer**,  
I want **comprehensive integration tests for the data pipeline**,  
So that **we can ensure all components work together correctly before deployment**.

## Context

The data pipeline involves multiple external APIs, database operations, and complex data transformations. Integration tests ensure these components work together correctly and catch issues before production.

## Acceptance Criteria

### Functional Requirements
1. ✅ Test complete import flows end-to-end
2. ✅ Verify data transformations
3. ✅ Test error handling scenarios
4. ✅ Validate database integrity
5. ✅ Test API integrations with mocks

### Technical Requirements
6. ✅ Use test database instance
7. ✅ Mock external API calls
8. ✅ Test data fixtures
9. ✅ Parallel test execution
10. ✅ CI/CD integration

### Coverage Requirements
11. ✅ 80% code coverage minimum
12. ✅ All critical paths tested
13. ✅ Edge cases covered
14. ✅ Performance benchmarks

## Technical Implementation Notes

### Test Setup and Configuration
```typescript
// tests/setup/test-environment.ts
import { createClient } from '@supabase/supabase-js';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export class TestEnvironment {
  private supabase: any;
  private server: any;
  
  async setup() {
    // Setup test database
    this.supabase = createClient(
      TEST_DATABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    // Run migrations
    await this.runMigrations();
    
    // Setup API mocks
    this.server = setupServer(
      ...this.getApiMocks()
    );
    
    this.server.listen();
  }
  
  async teardown() {
    // Clean database
    await this.cleanDatabase();
    
    // Stop mock server
    this.server.close();
  }
  
  private getApiMocks() {
    return [
      // Google Merchant API mock
      rest.get('https://content.googleapis.com/content/v2.1/products', (req, res, ctx) => {
        return res(
          ctx.json({
            resources: getMockProducts(),
            nextPageToken: null
          })
        );
      }),
      
      // Search Console API mock
      rest.post('https://www.googleapis.com/webmasters/v3/sites/*/searchAnalytics/query', (req, res, ctx) => {
        return res(
          ctx.json({
            rows: getMockSearchMetrics()
          })
        );
      }),
      
      // GA4 API mock
      rest.post('https://analyticsdata.googleapis.com/v1beta/properties/*/runReport', (req, res, ctx) => {
        return res(
          ctx.json({
            rows: getMockAnalyticsData()
          })
        );
      })
    ];
  }
  
  private async runMigrations() {
    // Run all migrations on test database
    const migrationFiles = await fs.readdir('./migrations');
    
    for (const file of migrationFiles) {
      const sql = await fs.readFile(`./migrations/${file}`, 'utf-8');
      await this.supabase.rpc('execute_sql', { query: sql });
    }
  }
  
  private async cleanDatabase() {
    // Clean all test data
    const tables = [
      'products',
      'taxonomy_nodes',
      'search_metrics',
      'analytics_metrics',
      'import_jobs'
    ];
    
    for (const table of tables) {
      await this.supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  }
}
```

### Sitemap Import Integration Test
```typescript
// tests/integration/sitemap-import.test.ts
import { SitemapParser } from '@/lib/parsers/sitemap-parser';
import { TaxonomyBuilder } from '@/lib/taxonomy/hierarchy-builder';
import { TestEnvironment } from '../setup/test-environment';

describe('Sitemap Import Integration', () => {
  let env: TestEnvironment;
  
  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();
  });
  
  afterAll(async () => {
    await env.teardown();
  });
  
  it('imports sitemap and builds taxonomy hierarchy', async () => {
    // Arrange
    const sitemapXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/category/electronics</loc>
          <priority>0.8</priority>
        </url>
        <url>
          <loc>https://example.com/category/electronics/phones</loc>
          <priority>0.7</priority>
        </url>
        <url>
          <loc>https://example.com/product/iphone-15</loc>
          <priority>0.6</priority>
        </url>
      </urlset>
    `;
    
    // Act
    const parser = new SitemapParser();
    const entries = await parser.parseSitemapContent(sitemapXml);
    
    const categories = parser.extractHierarchy(entries);
    
    const builder = new TaxonomyBuilder();
    const nodes = await builder.buildFromCategories(categories);
    
    // Assert
    expect(entries).toHaveLength(3);
    expect(categories).toHaveLength(3);
    expect(nodes).toHaveLength(3);
    
    // Verify hierarchy
    const rootNode = nodes.find(n => n.title === 'Electronics');
    expect(rootNode).toBeDefined();
    expect(rootNode.depth).toBe(1);
    
    const childNode = nodes.find(n => n.title === 'Phones');
    expect(childNode).toBeDefined();
    expect(childNode.parent_id).toBe(rootNode.id);
    
    // Verify database persistence
    const { data: dbNodes } = await supabase
      .from('taxonomy_nodes')
      .select('*')
      .order('depth');
    
    expect(dbNodes).toHaveLength(3);
  });
  
  it('handles malformed sitemap gracefully', async () => {
    // Arrange
    const invalidXml = '<invalid>xml</invalid>';
    
    // Act & Assert
    const parser = new SitemapParser();
    await expect(parser.parseSitemapContent(invalidXml))
      .rejects
      .toThrow('Invalid sitemap format');
  });
  
  it('merges duplicate categories', async () => {
    // Test deduplication logic
    const entries = [
      { loc: 'https://example.com/category/electronics' },
      { loc: 'https://example.com/category/electronics' },
      { loc: 'https://example.com/category/electronics/phones' }
    ];
    
    const parser = new SitemapParser();
    const categories = parser.extractHierarchy(entries);
    
    expect(categories).toHaveLength(2); // Duplicates merged
  });
});
```

### Google Merchant Integration Test
```typescript
// tests/integration/google-merchant.test.ts
describe('Google Merchant Import Integration', () => {
  let env: TestEnvironment;
  
  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();
  });
  
  afterAll(async () => {
    await env.teardown();
  });
  
  it('fetches and processes product feed', async () => {
    // Arrange
    const mockUserId = 'test-user-123';
    const mockMerchantId = '123456789';
    
    // Mock OAuth tokens
    await supabase.from('user_tokens').insert({
      user_id: mockUserId,
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expiry_date: Date.now() + 3600000
    });
    
    // Act
    const processor = new MerchantFeedProcessor();
    const products = await processor.fetchProductFeed(mockUserId, mockMerchantId);
    await processor.processProducts(products, mockUserId);
    
    // Assert
    expect(products).toHaveLength(10); // Based on mock data
    
    // Verify database
    const { data: dbProducts } = await supabase
      .from('products')
      .select('*');
    
    expect(dbProducts).toHaveLength(10);
    expect(dbProducts[0]).toMatchObject({
      title: expect.any(String),
      price: expect.any(Number),
      google_product_id: expect.any(String)
    });
  });
  
  it('handles API rate limits with retry', async () => {
    // Mock rate limit response
    server.use(
      rest.get('https://content.googleapis.com/content/v2.1/products', (req, res, ctx) => {
        return res.once(
          ctx.status(429),
          ctx.json({ error: 'Rate limit exceeded' })
        );
      })
    );
    
    // Should retry and succeed
    const processor = new MerchantFeedProcessor();
    const products = await processor.fetchProductFeed('user', 'merchant');
    
    expect(products).toBeDefined();
  });
});
```

### Metrics Integration Test
```typescript
// tests/integration/metrics-scoring.test.ts
describe('Metrics and Scoring Integration', () => {
  let env: TestEnvironment;
  
  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();
    await seedTestData();
  });
  
  afterAll(async () => {
    await env.teardown();
  });
  
  async function seedTestData() {
    // Create test taxonomy nodes
    await supabase.from('taxonomy_nodes').insert([
      { id: 'node-1', title: 'Electronics', depth: 1 },
      { id: 'node-2', title: 'Phones', parent_id: 'node-1', depth: 2 }
    ]);
    
    // Add search metrics
    await supabase.from('search_metrics').insert([
      {
        node_id: 'node-1',
        impressions: 10000,
        clicks: 300,
        ctr: 0.03,
        position: 5.2,
        date_from: '2024-01-01',
        date_to: '2024-01-31'
      }
    ]);
    
    // Add analytics metrics
    await supabase.from('analytics_metrics').insert([
      {
        node_id: 'node-1',
        sessions: 5000,
        conversions: 150,
        revenue: 15000,
        conversion_rate: 0.03,
        date_from: '2024-01-01',
        date_to: '2024-01-31'
      }
    ]);
    
    // Add products
    await supabase.from('products').insert([
      { category_id: 'node-1', title: 'Product 1', price: 99.99 },
      { category_id: 'node-1', title: 'Product 2', price: 149.99 }
    ]);
  }
  
  it('calculates opportunity scores correctly', async () => {
    // Act
    const scoringService = new ScoringService();
    const scores = await scoringService.calculateScoresForAllNodes();
    
    // Assert
    expect(scores).toHaveLength(2); // 2 nodes
    
    const electronicsScore = scores.find(s => s.node_id === 'node-1');
    expect(electronicsScore).toBeDefined();
    expect(electronicsScore.total_score).toBeGreaterThan(0);
    expect(electronicsScore.recommendations).toBeInstanceOf(Array);
    expect(electronicsScore.opportunity_type).toBeDefined();
  });
  
  it('aggregates metrics correctly for parent nodes', async () => {
    // Act
    const mapper = new MetricsMapper();
    const metrics = await mapper.mapMetricsToNodes([
      { url: 'https://example.com/category/electronics/phones', clicks: 100 }
    ], 'https://example.com');
    
    // Assert - should aggregate to parent
    const parentMetrics = metrics.find(m => m.node_id === 'node-1');
    expect(parentMetrics).toBeDefined();
    expect(parentMetrics.metrics.is_aggregated).toBe(true);
  });
});
```

### End-to-End Flow Test
```typescript
// tests/integration/e2e-flow.test.ts
describe('Complete Import Flow E2E', () => {
  it('completes full import pipeline from sitemap to scoring', async () => {
    // 1. Import sitemap
    const sitemapResponse = await fetch('/api/import/sitemap', {
      method: 'POST',
      body: JSON.stringify({ 
        sitemapUrl: 'https://example.com/sitemap.xml' 
      })
    });
    
    expect(sitemapResponse.status).toBe(200);
    
    // 2. Import Google Merchant products
    const merchantResponse = await fetch('/api/import/google-merchant', {
      method: 'POST',
      body: JSON.stringify({ 
        merchantId: '123456789' 
      })
    });
    
    expect(merchantResponse.status).toBe(200);
    
    // 3. Sync Search Console metrics
    const searchResponse = await fetch('/api/metrics/search-console', {
      method: 'POST',
      body: JSON.stringify({
        siteUrl: 'https://example.com',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      })
    });
    
    expect(searchResponse.status).toBe(200);
    
    // 4. Sync Analytics metrics
    const analyticsResponse = await fetch('/api/metrics/analytics', {
      method: 'POST',
      body: JSON.stringify({
        propertyId: '123456789',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      })
    });
    
    expect(analyticsResponse.status).toBe(200);
    
    // 5. Calculate opportunity scores
    const scoringResponse = await fetch('/api/scoring/calculate', {
      method: 'POST'
    });
    
    expect(scoringResponse.status).toBe(200);
    
    // Verify complete data in visualization API
    const vizResponse = await fetch('/api/taxonomy/nodes');
    const vizData = await vizResponse.json();
    
    expect(vizData.nodes).toHaveLength(expect.any(Number));
    expect(vizData.nodes[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      metrics: expect.any(Object),
      products: expect.any(Array),
      score: expect.any(Number)
    });
  });
});
```

### Performance Tests
```typescript
// tests/performance/load-test.ts
describe('Performance Tests', () => {
  it('handles large sitemap import efficiently', async () => {
    // Generate large sitemap with 10,000 URLs
    const largeUrls = Array.from({ length: 10000 }, (_, i) => ({
      loc: `https://example.com/category/${Math.floor(i / 100)}/product-${i}`
    }));
    
    const startTime = Date.now();
    
    const parser = new SitemapParser();
    const categories = parser.extractHierarchy(largeUrls);
    
    const builder = new TaxonomyBuilder();
    await builder.buildFromCategories(categories);
    
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
  });
  
  it('processes large product feed in batches', async () => {
    // Mock 50,000 products
    const largeProductSet = Array.from({ length: 50000 }, (_, i) => ({
      id: `product-${i}`,
      title: `Product ${i}`,
      price: { value: Math.random() * 1000, currency: 'USD' }
    }));
    
    const processor = new MerchantFeedProcessor();
    
    const startTime = Date.now();
    await processor.processProducts(largeProductSet, 'test-user');
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(60000); // Should complete within 1 minute
    
    // Verify batch processing
    const { data: jobs } = await supabase
      .from('import_jobs')
      .select('*');
    
    expect(jobs[0].metadata.batch_count).toBeGreaterThan(1);
  });
});
```

## Dependencies

- Test database instance
- MSW for API mocking
- Test data fixtures
- CI/CD pipeline configuration

## Testing Requirements

### Test Coverage
- Unit tests: Minimum 80% coverage
- Integration tests: All critical paths
- Performance tests: Load and stress testing
- E2E tests: Complete user journeys

### CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15
        env:
          POSTGRES_PASSWORD: postgres
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:integration
      - run: npm run test:e2e
```

## Definition of Done

- [ ] Test environment setup complete
- [ ] API mocks configured
- [ ] Integration tests written
- [ ] E2E flow tests passing
- [ ] Performance benchmarks met
- [ ] 80% code coverage achieved
- [ ] CI/CD pipeline integrated
- [ ] Test documentation complete
- [ ] All tests passing consistently

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `tests/setup/test-environment.ts` (new)
- `tests/integration/sitemap-import.test.ts` (new)
- `tests/integration/google-merchant.test.ts` (new)
- `tests/integration/metrics-scoring.test.ts` (new)
- `tests/integration/e2e-flow.test.ts` (new)
- `tests/performance/load-test.ts` (new)
- `.github/workflows/test.yml` (modified)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned