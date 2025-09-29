import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FeedTaxonomyBuilder, ProductCategory, TaxonomyNode } from '@/lib/core/taxonomy/feed-taxonomy-builder';
import { CategoryMerger } from '@/lib/core/taxonomy/category-merger';

// Mock Supabase client
jest.mock('@/lib/external/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve({ 
          data: [], 
          error: null 
        }))
      }))
    }))
  }))
}));

describe('FeedTaxonomyBuilder', () => {
  let builder: FeedTaxonomyBuilder;
  
  beforeEach(() => {
    builder = new FeedTaxonomyBuilder();
  });
  
  describe('Category Path Extraction', () => {
    it('should extract categories from product_type field', async () => {
      const products = [
        {
          id: 'prod1',
          product_title: 'iPhone 15',
          product_type: 'Electronics > Phones > Smartphones',
        },
        {
          id: 'prod2',
          product_title: 'Samsung Galaxy',
          product_type: 'Electronics > Phones > Smartphones',
        }
      ];
      
      await builder.buildFromProductFeed(products, { skipPersist: true });
      const nodes = builder.getNodes();
      
      expect(nodes.size).toBeGreaterThan(0);
      expect(nodes.has('electronics')).toBe(true);
      expect(nodes.has('electronics-phones')).toBe(true);
      expect(nodes.has('electronics-phones-smartphones')).toBe(true);
    });
    
    it('should use google_product_category as fallback', async () => {
      const products = [
        {
          id: 'prod1',
          product_title: 'Laptop',
          google_product_category: 'Electronics > Computers > Laptops',
        }
      ];
      
      await builder.buildFromProductFeed(products, { skipPersist: true });
      const nodes = builder.getNodes();
      
      expect(nodes.has('electronics')).toBe(true);
      expect(nodes.has('electronics-computers')).toBe(true);
      expect(nodes.has('electronics-computers-laptops')).toBe(true);
    });
    
    it('should prioritize product_type over google_product_category', async () => {
      const products = [
        {
          id: 'prod1',
          product_title: 'Custom Product',
          product_type: 'Custom > Category > Path',
          google_product_category: 'Standard > Google > Category',
        }
      ];
      
      await builder.buildFromProductFeed(products, { skipPersist: true });
      const nodes = builder.getNodes();
      const assignments = builder.getProductAssignments();
      
      // Both paths should be created
      expect(nodes.has('custom')).toBe(true);
      expect(nodes.has('standard')).toBe(true);
      
      // Product should be assigned to the product_type path
      expect(assignments.has('custom-category-path')).toBe(true);
      const customAssignments = assignments.get('custom-category-path');
      expect(customAssignments?.has('prod1')).toBe(true);
    });
  });
  
  describe('Hierarchy Building', () => {
    it('should build correct hierarchy from paths', async () => {
      const products = [
        {
          id: 'prod1',
          product_title: 'Product 1',
          product_type: 'Home > Kitchen > Appliances > Blenders',
        }
      ];
      
      await builder.buildFromProductFeed(products, { skipPersist: true });
      const nodes = builder.getNodes();
      
      // Check hierarchy
      const home = Array.from(nodes.values()).find(n => n.id === 'home');
      const kitchen = Array.from(nodes.values()).find(n => n.id === 'home-kitchen');
      const appliances = Array.from(nodes.values()).find(n => n.id === 'home-kitchen-appliances');
      const blenders = Array.from(nodes.values()).find(n => n.id === 'home-kitchen-appliances-blenders');
      
      expect(home?.depth).toBe(1);
      expect(home?.parent_id).toBeUndefined();
      
      expect(kitchen?.depth).toBe(2);
      expect(kitchen?.parent_id).toBe('home');
      
      expect(appliances?.depth).toBe(3);
      expect(appliances?.parent_id).toBe('home-kitchen');
      
      expect(blenders?.depth).toBe(4);
      expect(blenders?.parent_id).toBe('home-kitchen-appliances');
    });
    
    it('should create parent nodes automatically', async () => {
      const products = [
        {
          id: 'prod1',
          product_title: 'Deep Product',
          product_type: 'A > B > C > D > E',
        }
      ];
      
      await builder.buildFromProductFeed(products, { skipPersist: true });
      const nodes = builder.getNodes();
      
      // All parent nodes should be created
      expect(nodes.has('a')).toBe(true);
      expect(nodes.has('a-b')).toBe(true);
      expect(nodes.has('a-b-c')).toBe(true);
      expect(nodes.has('a-b-c-d')).toBe(true);
      expect(nodes.has('a-b-c-d-e')).toBe(true);
      expect(nodes.size).toBe(5);
    });
  });
  
  describe('Delimiter Handling', () => {
    it('should handle various delimiter formats', async () => {
      const products = [
        {
          id: 'prod1',
          product_title: 'Product 1',
          product_type: 'Cat1 > Cat2 > Cat3', // Standard
        },
        {
          id: 'prod2',
          product_title: 'Product 2',
          product_type: 'Cat1/Cat2/Cat3', // Slash
        },
        {
          id: 'prod3',
          product_title: 'Product 3',
          product_type: 'Cat1 | Cat2 | Cat3', // Pipe
        }
      ];
      
      await builder.buildFromProductFeed(products, { skipPersist: true });
      const nodes = builder.getNodes();
      
      // All should create the same structure
      expect(nodes.has('cat1')).toBe(true);
      expect(nodes.has('cat1-cat2')).toBe(true);
      expect(nodes.has('cat1-cat2-cat3')).toBe(true);
      
      // Should not create duplicates
      const cat1Nodes = Array.from(nodes.values()).filter(n => n.title === 'Cat1');
      expect(cat1Nodes.length).toBe(1);
    });
  });
  
  describe('Product Counting', () => {
    it('should count products accurately per category', async () => {
      const products = [
        {
          id: 'prod1',
          product_title: 'Product 1',
          product_type: 'Electronics > Phones',
        },
        {
          id: 'prod2',
          product_title: 'Product 2',
          product_type: 'Electronics > Phones',
        },
        {
          id: 'prod3',
          product_title: 'Product 3',
          product_type: 'Electronics > Tablets',
        }
      ];
      
      await builder.buildFromProductFeed(products, { skipPersist: true });
      const nodes = builder.getNodes();
      
      const electronics = Array.from(nodes.values()).find(n => n.id === 'electronics');
      const phones = Array.from(nodes.values()).find(n => n.id === 'electronics-phones');
      const tablets = Array.from(nodes.values()).find(n => n.id === 'electronics-tablets');
      
      expect(phones?.product_count).toBe(2);
      expect(tablets?.product_count).toBe(1);
      expect(electronics?.product_count).toBe(3); // Aggregated
    });
    
    it('should aggregate counts to parent categories', async () => {
      const products = [
        {
          id: 'prod1',
          product_title: 'Product 1',
          product_type: 'A > B > C',
        },
        {
          id: 'prod2',
          product_title: 'Product 2',
          product_type: 'A > B > D',
        },
        {
          id: 'prod3',
          product_title: 'Product 3',
          product_type: 'A > E',
        }
      ];
      
      await builder.buildFromProductFeed(products, { skipPersist: true });
      const nodes = builder.getNodes();
      
      const nodeA = Array.from(nodes.values()).find(n => n.id === 'a');
      const nodeB = Array.from(nodes.values()).find(n => n.id === 'a-b');
      const nodeC = Array.from(nodes.values()).find(n => n.id === 'a-b-c');
      const nodeD = Array.from(nodes.values()).find(n => n.id === 'a-b-d');
      const nodeE = Array.from(nodes.values()).find(n => n.id === 'a-e');
      
      expect(nodeC?.product_count).toBe(1);
      expect(nodeD?.product_count).toBe(1);
      expect(nodeB?.product_count).toBe(2); // C + D
      expect(nodeE?.product_count).toBe(1);
      expect(nodeA?.product_count).toBe(3); // B + E
    });
  });
  
  describe('Duplicate Category Handling', () => {
    it('should not create duplicate categories', async () => {
      const products = [
        {
          id: 'prod1',
          product_title: 'Product 1',
          product_type: 'Electronics > Phones',
        },
        {
          id: 'prod2',
          product_title: 'Product 2',
          product_type: 'Electronics > Phones',
        },
        {
          id: 'prod3',
          product_title: 'Product 3',
          product_type: 'Electronics > Phones',
        }
      ];
      
      await builder.buildFromProductFeed(products, { skipPersist: true });
      const nodes = builder.getNodes();
      
      const electronicsNodes = Array.from(nodes.values()).filter(n => n.id === 'electronics');
      const phonesNodes = Array.from(nodes.values()).filter(n => n.id === 'electronics-phones');
      
      expect(electronicsNodes.length).toBe(1);
      expect(phonesNodes.length).toBe(1);
    });
  });
  
  describe('Title Formatting', () => {
    it('should humanize category titles', async () => {
      const products = [
        {
          id: 'prod1',
          product_title: 'Product',
          product_type: 'home-garden > outdoor_furniture > patio-sets',
        }
      ];
      
      await builder.buildFromProductFeed(products, { skipPersist: true });
      const nodes = builder.getNodes();
      
      const homeGarden = Array.from(nodes.values()).find(n => n.id === 'home-garden');
      const outdoor = Array.from(nodes.values()).find(n => n.id === 'home-garden-outdoor-furniture');
      const patio = Array.from(nodes.values()).find(n => n.id === 'home-garden-outdoor-furniture-patio-sets');
      
      expect(homeGarden?.title).toBe('Home Garden');
      expect(outdoor?.title).toBe('Outdoor Furniture');
      expect(patio?.title).toBe('Patio Sets');
    });
  });
});

describe('CategoryMerger', () => {
  let merger: CategoryMerger;
  
  beforeEach(() => {
    merger = new CategoryMerger();
  });
  
  describe('Similar Category Detection', () => {
    it('should merge plural variations', () => {
      const nodes = new Map<string, TaxonomyNode>([
        ['phone', {
          id: 'phone',
          title: 'Phone',
          path: 'phone',
          depth: 1,
          product_count: 5,
          source: 'merchant',
          metadata: { created_from: 'feed' },
          parent_id: undefined
        }],
        ['phones', {
          id: 'phones',
          title: 'Phones',
          path: 'phones',
          depth: 1,
          product_count: 3,
          source: 'merchant',
          metadata: { created_from: 'feed' },
          parent_id: undefined
        }]
      ]);
      
      const merged = merger.mergeSimilarCategories(nodes);
      expect(merged.size).toBe(1);
      
      // Should keep the one with more products
      expect(merged.has('phone')).toBe(true);
      expect(merged.get('phone')?.product_count).toBe(8); // Combined count
    });
    
    it('should merge and/& variations', () => {
      const nodes = new Map<string, TaxonomyNode>([
        ['home-and-garden', {
          id: 'home-and-garden',
          title: 'Home And Garden',
          path: 'home-and-garden',
          depth: 1,
          product_count: 10,
          source: 'merchant',
          metadata: { created_from: 'feed' },
          parent_id: undefined
        }],
        ['home-garden', {
          id: 'home-garden',
          title: 'Home & Garden',
          path: 'home-garden',
          depth: 1,
          product_count: 5,
          source: 'merchant',
          metadata: { created_from: 'feed' },
          parent_id: undefined
        }]
      ]);
      
      const merged = merger.mergeSimilarCategories(nodes);
      expect(merged.size).toBe(1);
      expect(merged.get('home-and-garden')?.product_count).toBe(15);
    });
    
    it('should not merge categories at different depths', () => {
      const nodes = new Map<string, TaxonomyNode>([
        ['electronics', {
          id: 'electronics',
          title: 'Electronics',
          path: 'electronics',
          depth: 1,
          product_count: 10,
          source: 'merchant',
          metadata: { created_from: 'feed' }
        }],
        ['home-electronics', {
          id: 'home-electronics',
          title: 'Electronics',
          path: 'home/electronics',
          depth: 2,
          parent_id: 'home',
          product_count: 5,
          source: 'merchant',
          metadata: { created_from: 'feed' }
        }]
      ]);
      
      const merged = merger.mergeSimilarCategories(nodes);
      expect(merged.size).toBe(2); // Should not merge
    });
    
    it('should not merge categories with different parents', () => {
      const nodes = new Map<string, TaxonomyNode>([
        ['electronics-accessories', {
          id: 'electronics-accessories',
          title: 'Accessories',
          path: 'electronics/accessories',
          depth: 2,
          parent_id: 'electronics',
          product_count: 10,
          source: 'merchant',
          metadata: { created_from: 'feed' }
        }],
        ['clothing-accessories', {
          id: 'clothing-accessories',
          title: 'Accessories',
          path: 'clothing/accessories',
          depth: 2,
          parent_id: 'clothing',
          product_count: 5,
          source: 'merchant',
          metadata: { created_from: 'feed' }
        }]
      ]);
      
      const merged = merger.mergeSimilarCategories(nodes);
      expect(merged.size).toBe(2); // Should not merge
    });
  });
  
  describe('Merge Statistics', () => {
    it('should track merge statistics', () => {
      const nodes = new Map<string, TaxonomyNode>([
        ['category', {
          id: 'category',
          title: 'Category',
          path: 'category',
          depth: 1,
          product_count: 5,
          source: 'merchant',
          metadata: { created_from: 'feed' },
          parent_id: undefined
        }],
        ['categories', {
          id: 'categories',
          title: 'Categories',
          path: 'categories',
          depth: 1,
          product_count: 3,
          source: 'merchant',
          metadata: { created_from: 'feed' },
          parent_id: undefined
        }]
      ]);
      
      merger.mergeSimilarCategories(nodes);
      const stats = merger.getMergeStats();
      
      expect(stats.totalMerges).toBe(1);
      expect(stats.mergeMap.size).toBe(1);
    });
  });
});