// Jest test for GA4 Mapper
import { GA4Mapper } from '@/lib/integration/ga4-mapper';
import type { TaxonomyNode } from '@/components/taxonomy/D3Visualization';
import type { AnalyticsMetric, ProductMetric } from '@/lib/services/ga4-service';

describe('GA4Mapper', () => {
  let mapper: GA4Mapper;
  let sampleNodes: TaxonomyNode[];
  let sampleProducts: any[];
  let sampleMetrics: AnalyticsMetric[];
  let sampleProductMetrics: ProductMetric[];

  beforeEach(() => {
    mapper = new GA4Mapper();

    sampleNodes = [
      {
        id: 'node1',
        url: 'https://example.com/electronics',
        title: 'Electronics',
        path: '/electronics',
        children: [],
      },
      {
        id: 'node2',
        url: 'https://example.com/electronics/laptops',
        title: 'Laptops',
        path: '/electronics/laptops',
        parentId: 'node1',
        children: [],
      },
      {
        id: 'node3',
        url: '/clothing/mens',
        title: 'Men\'s Clothing',
        path: '/clothing/mens',
        children: [],
      },
    ];

    sampleProducts = [
      {
        id: 'prod1',
        link: 'https://example.com/product/laptop-123',
        title: 'Gaming Laptop',
        gtin: '1234567890123',
        node_id: 'node2',
      },
      {
        id: 'prod2',
        link: '/product/shirt-456',
        title: 'Blue Shirt',
        gtin: '9876543210987',
        node_id: 'node3',
      },
    ];

    sampleMetrics = [
      {
        pagePath: '/electronics/laptops',
        category: 'Electronics > Laptops',
        sessions: 1000,
        users: 800,
        revenue: 50000,
        transactions: 50,
        conversionRate: 0.05,
        avgOrderValue: 1000,
        engagementRate: 0.75,
        bounceRate: 0.25,
        avgSessionDuration: 180,
        pageViews: 2500,
        date: '2025-01-17',
      },
      {
        pagePath: '/product/laptop-123',
        sessions: 500,
        users: 400,
        revenue: 25000,
        transactions: 25,
        conversionRate: 0.05,
        avgOrderValue: 1000,
        engagementRate: 0.8,
        bounceRate: 0.2,
        avgSessionDuration: 240,
        pageViews: 1000,
        date: '2025-01-17',
      },
    ];

    sampleProductMetrics = [
      {
        itemId: 'prod1',
        itemName: 'Gaming Laptop',
        itemCategory: 'Electronics > Laptops',
        itemRevenue: 25000,
        itemsPurchased: 25,
        itemsViewed: 500,
        cartAdditions: 50,
        cartRemovals: 10,
        purchaseToViewRate: 0.05,
        date: '2025-01-17',
      },
    ];
  });

  describe('mapPageMetricsToTaxonomy', () => {
    it('should map page paths to correct nodes', async () => {
      const mapped = await mapper.mapPageMetricsToTaxonomy(
        sampleMetrics,
        sampleNodes,
        sampleProducts
      );

      expect(mapped).toHaveLength(2);
      expect(mapped[0].nodeId).toBe('node2'); // /electronics/laptops -> Laptops node
      expect(mapped[0].confidence).toBeGreaterThan(0.6);
    });

    it('should map product URLs to products', async () => {
      const mapped = await mapper.mapPageMetricsToTaxonomy(
        sampleMetrics,
        sampleNodes,
        sampleProducts
      );

      const productMapping = mapped.find(m => m.pagePath === '/product/laptop-123');
      expect(productMapping).toBeDefined();
      expect(productMapping?.productId).toBe('prod1');
      expect(productMapping?.nodeId).toBe('node2'); // Through product's node_id
    });

    it('should handle category-based matching', async () => {
      const metricWithCategory: AnalyticsMetric = {
        ...sampleMetrics[0],
        pagePath: '/unknown/path',
        category: 'Men\'s Clothing',
      };

      const mapped = await mapper.mapPageMetricsToTaxonomy(
        [metricWithCategory],
        sampleNodes,
        []
      );

      expect(mapped[0].nodeId).toBe('node3');
      expect(mapped[0].matchStrategy).toBe('category');
    });

    it('should return low confidence for no matches', async () => {
      const unmatchableMetric: AnalyticsMetric = {
        ...sampleMetrics[0],
        pagePath: '/completely/different/path',
        category: undefined,
      };

      const mapped = await mapper.mapPageMetricsToTaxonomy(
        [unmatchableMetric],
        sampleNodes,
        []
      );

      expect(mapped[0].confidence).toBe(0);
      expect(mapped[0].matchStrategy).toBe('none');
    });
  });

  describe('mapProductMetrics', () => {
    it('should map product metrics by ID', async () => {
      const mapped = await mapper.mapProductMetrics(
        sampleProductMetrics,
        sampleProducts,
        sampleNodes
      );

      expect(mapped).toHaveLength(1);
      expect(mapped[0].productId).toBe('prod1');
      expect(mapped[0].nodeId).toBe('node2');
      expect(mapped[0].confidence).toBe(0.9);
    });

    it('should map by GTIN', async () => {
      const metricWithGTIN: ProductMetric = {
        ...sampleProductMetrics[0],
        itemId: '1234567890123', // GTIN instead of product ID
      };

      const mapped = await mapper.mapProductMetrics(
        [metricWithGTIN],
        sampleProducts,
        sampleNodes
      );

      expect(mapped[0].productId).toBe('prod1');
    });

    it('should map by product name', async () => {
      const metricWithName: ProductMetric = {
        ...sampleProductMetrics[0],
        itemId: 'unknown-id',
        itemName: 'Blue Shirt',
      };

      const mapped = await mapper.mapProductMetrics(
        [metricWithName],
        sampleProducts,
        sampleNodes
      );

      expect(mapped[0].productId).toBe('prod2');
    });

    it('should fallback to category mapping', async () => {
      const metricWithCategoryOnly: ProductMetric = {
        ...sampleProductMetrics[0],
        itemId: 'unknown-id',
        itemName: 'Unknown Product',
        itemCategory: 'Men\'s Clothing',
      };

      const mapped = await mapper.mapProductMetrics(
        [metricWithCategoryOnly],
        [],
        sampleNodes
      );

      expect(mapped[0].nodeId).toBe('node3');
      expect(mapped[0].confidence).toBe(0.6);
      expect(mapped[0].matchStrategy).toBe('category');
    });
  });

  describe('buildCategoryHierarchy', () => {
    it('should build hierarchy from category strings', () => {
      const categories = [
        'Electronics',
        'Electronics > Laptops',
        'Electronics > Laptops > Gaming',
        'Clothing',
        'Clothing > Men\'s',
      ];

      const hierarchy = mapper.buildCategoryHierarchy(categories);

      expect(hierarchy.has('Electronics')).toBe(true);
      expect(hierarchy.get('Electronics')).toContain('Electronics > Laptops');
      expect(hierarchy.get('Electronics > Laptops')).toContain('Electronics > Laptops > Gaming');
    });

    it('should handle various separators', () => {
      const categories = [
        'Electronics/Laptops',
        'Electronics > Desktops',
        'Electronics - Accessories',
      ];

      const hierarchy = mapper.buildCategoryHierarchy(categories);
      expect(hierarchy.size).toBeGreaterThan(0);
    });
  });

  describe('getMappingStatistics', () => {
    it('should calculate correct statistics', async () => {
      const mapped = await mapper.mapPageMetricsToTaxonomy(
        sampleMetrics,
        sampleNodes,
        sampleProducts
      );

      const stats = mapper.getMappingStatistics(mapped);

      expect(stats.total).toBe(2);
      expect(stats.mapped).toBe(2);
      expect(stats.mappingRate).toBe(1.0);
      expect(stats.avgConfidence).toBeGreaterThan(0.5);
    });

    it('should track unmapped URLs', async () => {
      const unmappableMetrics = [
        { ...sampleMetrics[0], pagePath: '/unmapped1', category: undefined },
        { ...sampleMetrics[0], pagePath: '/unmapped2', category: undefined },
      ];

      const mapped = await mapper.mapPageMetricsToTaxonomy(
        unmappableMetrics,
        sampleNodes,
        []
      );

      const stats = mapper.getMappingStatistics(mapped);
      expect(stats.unmappedUrls).toContain('/unmapped1');
      expect(stats.unmappedUrls).toContain('/unmapped2');
    });
  });

  describe('mapping cache', () => {
    it('should cache and reuse category mappings', () => {
      const categories = ['Electronics > Laptops', 'Electronics > Desktops'];

      // First mapping should cache
      mapper['matchByCategory']('Electronics > Laptops', sampleNodes);

      // Export cache
      const cache = mapper.exportMappingCache();
      expect(cache.length).toBeGreaterThan(0);

      // Create new mapper and import cache
      const newMapper = new GA4Mapper();
      newMapper.importMappingCache(cache);

      // Should use cached mapping
      const exported = newMapper.exportMappingCache();
      expect(exported).toEqual(cache);
    });
  });
});