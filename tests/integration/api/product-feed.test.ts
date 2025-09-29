import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProductFeedParser, ProductData } from '@/lib/data/import/product-feed-parser';
import { GoogleMerchantClient } from '@/lib/external/google-merchant';
import { ProductSyncServiceImpl } from '@/lib/services/product-sync-service';

describe('Product Feed Integration', () => {
  describe('ProductFeedParser', () => {
    let parser: ProductFeedParser;

    beforeEach(() => {
      parser = new ProductFeedParser();
    });

    it('should parse XML feed correctly', async () => {
      const xmlFeed = `<?xml version="1.0"?>
        <rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
          <channel>
            <item>
              <g:id>SKU123</g:id>
              <title>Test Product</title>
              <description>A test product description</description>
              <link>https://example.com/product/123</link>
              <g:image_link>https://example.com/image.jpg</g:image_link>
              <g:price>99.99 USD</g:price>
              <g:availability>in stock</g:availability>
              <g:brand>TestBrand</g:brand>
              <g:product_type>Electronics > Phones</g:product_type>
            </item>
          </channel>
        </rss>`;

      const result = await parser.parseFeed(xmlFeed, 'xml');

      expect(result.totalCount).toBe(1);
      expect(result.products).toHaveLength(1);
      
      const product = result.products[0];
      expect(product.id).toBe('SKU123');
      expect(product.title).toBe('Test Product');
      expect(product.price.value).toBe(99.99);
      expect(product.price.currency).toBe('USD');
      expect(product.availability).toBe('in stock');
      expect(product.brand).toBe('TestBrand');
    });

    it('should parse JSON feed correctly', async () => {
      const jsonFeed = {
        products: [
          {
            id: 'SKU456',
            title: 'JSON Product',
            description: 'JSON product description',
            link: 'https://example.com/product/456',
            imageLink: 'https://example.com/image2.jpg',
            price: { value: 149.99, currency: 'USD' },
            availability: 'in stock',
            brand: 'JSONBrand',
            productType: ['Home', 'Kitchen', 'Appliances'],
          },
        ],
      };

      const result = await parser.parseFeed(jsonFeed, 'json');

      expect(result.totalCount).toBe(1);
      expect(result.products).toHaveLength(1);
      
      const product = result.products[0];
      expect(product.id).toBe('SKU456');
      expect(product.title).toBe('JSON Product');
      expect(product.price.value).toBe(149.99);
      expect(product.productType).toEqual(['Home', 'Kitchen', 'Appliances']);
    });

    it('should extract categories correctly', async () => {
      const products = [
        {
          id: 'P1',
          title: 'Product 1',
          link: 'https://example.com/electronics/phones/product-1',
          productType: ['Electronics', 'Phones'],
          price: { value: 100, currency: 'USD' },
          availability: 'in stock',
          brand: 'Brand1',
        },
        {
          id: 'P2',
          title: 'Product 2',
          link: 'https://example.com/electronics/tablets/product-2',
          productType: ['Electronics', 'Tablets'],
          price: { value: 200, currency: 'USD' },
          availability: 'in stock',
          brand: 'Brand2',
        },
      ];

      const result = await parser.parseFeed({ products }, 'json');

      expect(result.categories.size).toBeGreaterThan(0);
      expect(result.brands.size).toBe(2);
      expect(result.brands.get('Brand1')).toBe(1);
      expect(result.brands.get('Brand2')).toBe(1);
    });

    it('should handle missing optional fields', async () => {
      const minimalProduct = {
        id: 'MIN001',
        title: 'Minimal Product',
      };

      const result = await parser.parseFeed({ products: [minimalProduct] }, 'json');

      expect(result.totalCount).toBe(1);
      const product = result.products[0];
      expect(product.id).toBe('MIN001');
      expect(product.title).toBe('Minimal Product');
      expect(product.description).toBe('');
      expect(product.price.value).toBe(0);
      expect(product.availability).toBe('out of stock');
    });

    it('should parse availability correctly', () => {
      const testCases = [
        { input: 'in stock', expected: 'in stock' },
        { input: 'in_stock', expected: 'in stock' },
        { input: 'out of stock', expected: 'out of stock' },
        { input: 'out_of_stock', expected: 'out of stock' },
        { input: 'preorder', expected: 'preorder' },
        { input: 'backorder', expected: 'backorder' },
        { input: 'unknown', expected: 'out of stock' },
      ];

      testCases.forEach(({ input, expected }) => {
        const product = {
          id: 'TEST',
          title: 'Test',
          availability: input,
        };

        const result = parser['normalizeProduct'](product);
        expect(result?.availability).toBe(expected);
      });
    });
  });

  describe('ProductSyncService', () => {
    let syncService: ProductSyncServiceImpl;
    let mockSupabase: any;

    beforeEach(() => {
      mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        rpc: jest.fn().mockResolvedValue({ error: null }),
      };

      syncService = new ProductSyncServiceImpl(mockSupabase);
    });

    it('should detect product changes correctly', () => {
      const oldProducts: ProductData[] = [
        {
          id: 'P1',
          title: 'Old Title',
          description: 'Old Description',
          link: 'https://example.com/p1',
          imageLink: 'https://example.com/img1.jpg',
          price: { value: 100, currency: 'USD' },
          availability: 'in stock',
          brand: 'Brand1',
        },
        {
          id: 'P2',
          title: 'Product 2',
          description: 'Description 2',
          link: 'https://example.com/p2',
          imageLink: 'https://example.com/img2.jpg',
          price: { value: 200, currency: 'USD' },
          availability: 'in stock',
          brand: 'Brand2',
        },
      ];

      const newProducts: ProductData[] = [
        {
          id: 'P1',
          title: 'New Title', // Changed
          description: 'Old Description',
          link: 'https://example.com/p1',
          imageLink: 'https://example.com/img1.jpg',
          price: { value: 100, currency: 'USD' },
          availability: 'in stock',
          brand: 'Brand1',
        },
        {
          id: 'P3', // New product
          title: 'Product 3',
          description: 'Description 3',
          link: 'https://example.com/p3',
          imageLink: 'https://example.com/img3.jpg',
          price: { value: 300, currency: 'USD' },
          availability: 'in stock',
          brand: 'Brand3',
        },
      ];

      const changes = syncService.detectChanges(oldProducts, newProducts);

      expect(changes.hasChanges).toBe(true);
      expect(changes.added).toHaveLength(1);
      expect(changes.added[0].id).toBe('P3');
      expect(changes.updated).toHaveLength(1);
      expect(changes.updated[0].id).toBe('P1');
      expect(changes.removed).toHaveLength(1);
      expect(changes.removed[0]).toBe('P2');
    });

    it('should chunk large arrays correctly', () => {
      const array = Array.from({ length: 1500 }, (_, i) => i);
      const chunks = syncService['chunkArray'](array, 500);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(500);
      expect(chunks[1]).toHaveLength(500);
      expect(chunks[2]).toHaveLength(500);
    });
  });

  describe('Google Merchant Client', () => {
    it('should normalize product data correctly', () => {
      const client = new GoogleMerchantClient({
        merchantId: 'test',
        accountId: 'test',
        feedSettings: {
          primaryFeedId: 'primary',
          updateFrequency: 'daily',
          deltaSync: true,
        },
      });

      const rawProduct = {
        id: 'RAW001',
        title: 'Raw Product',
        description: 'Description',
        link: 'https://example.com/raw',
        imageLink: 'https://example.com/raw.jpg',
        price: { value: '99.99', currency: 'USD' },
        availability: 'in_stock',
        brand: 'TestBrand',
      };

      const normalized = client['normalizeProduct'](rawProduct);

      expect(normalized.id).toBe('RAW001');
      expect(normalized.price.value).toBe(99.99);
      expect(normalized.price.currency).toBe('USD');
      expect(normalized.availability).toBe('in_stock');
    });
  });

  describe('Feed URL Category Extraction', () => {
    let parser: ProductFeedParser;

    beforeEach(() => {
      parser = new ProductFeedParser();
    });

    it('should extract category from URL path', () => {
      const testCases = [
        {
          url: 'https://example.com/electronics/phones/iphone-14',
          expected: 'electronics > phones',
        },
        {
          url: 'https://example.com/home-garden/furniture/chairs/office-chair',
          expected: 'home-garden > furniture > chairs',
        },
        {
          url: 'https://example.com/products/p/12345',
          expected: null, // Should filter out generic paths
        },
        {
          url: 'invalid-url',
          expected: null,
        },
      ];

      testCases.forEach(({ url, expected }) => {
        const result = parser['extractCategoryFromUrl'](url);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Integration Flow', () => {
    it('should complete full sync flow', async () => {
      const parser = new ProductFeedParser();
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: { id: 'sync-123' }, error: null }),
            eq: jest.fn().mockReturnThis(),
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: { id: 'sync-123' }, error: null }),
            })),
          })),
          upsert: jest.fn(() => ({
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
          update: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ error: null }),
          })),
          delete: jest.fn(() => ({
            in: jest.fn().mockResolvedValue({ error: null }),
          })),
        })),
        rpc: jest.fn().mockResolvedValue({ error: null, data: 0 }),
      };

      const syncService = new ProductSyncServiceImpl(mockSupabase);

      const testFeed = {
        products: [
          {
            id: 'TEST001',
            title: 'Test Product',
            link: 'https://example.com/test',
            price: { value: 99.99, currency: 'USD' },
            availability: 'in stock' as const,
            brand: 'TestBrand',
            imageLink: 'https://example.com/test.jpg',
            description: 'Test description',
          },
        ],
      };

      const parsed = await parser.parseFeed(testFeed, 'json');
      const result = await syncService.syncProducts(parsed);

      expect(result).toBeDefined();
      expect(result.errors).toHaveLength(0);
      expect(mockSupabase.from).toHaveBeenCalled();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_category_sku_counts');
    });
  });
});