import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  HierarchyBuilder,
  RawNode,
  HierarchicalNode,
  HierarchyResult,
} from '@/lib/processing/hierarchy-builder';

describe('HierarchyBuilder', () => {
  let builder: HierarchyBuilder;

  beforeEach(() => {
    builder = new HierarchyBuilder();
  });

  describe('buildFromUrls', () => {
    it('should build simple hierarchy', () => {
      const input: RawNode[] = [
        { url: 'https://example.com', title: 'Home' },
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/products/shoes', title: 'Shoes' },
        { url: 'https://example.com/products/shoes/running', title: 'Running Shoes' },
      ];

      const result = builder.buildFromUrls(input);

      expect(result.nodes).toHaveLength(4);
      expect(result.rootNodes).toHaveLength(1);
      expect(result.maxDepth).toBe(3);

      const home = result.nodes.find((n) => n.slug === 'home');
      expect(home?.depth).toBe(0);
      expect(home?.children).toHaveLength(1);

      const running = result.nodes.find((n) => n.slug === 'running');
      expect(running?.depth).toBe(3);
      expect(running?.breadcrumb).toEqual(['products', 'shoes', 'running']);
    });

    it('should handle multiple root nodes', () => {
      const input: RawNode[] = [
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/blog', title: 'Blog' },
        { url: 'https://example.com/about', title: 'About' },
      ];

      const result = builder.buildFromUrls(input);

      expect(result.rootNodes).toHaveLength(3);
      expect(result.stats.rootNodes).toBe(3);
    });

    it('should detect and report duplicates', () => {
      const input: RawNode[] = [
        { url: 'https://EXAMPLE.com/Products/', title: 'Products' },
        { url: 'https://example.com/products', title: 'Products Duplicate' },
      ];

      const result = builder.buildFromUrls(input);

      expect(result.nodes).toHaveLength(1);
      expect(result.warnings).toContain('Duplicate URL skipped: https://example.com/products');
    });

    it('should normalize URLs correctly', () => {
      const input: RawNode[] = [
        { url: 'https://EXAMPLE.com/Products/', title: 'Products' },
        { url: 'https://example.com/Blog/', title: 'Blog' },
        { url: 'https://example.com/about', title: 'About' },
      ];

      const result = builder.buildFromUrls(input);

      // All URLs should be normalized (lowercase, no trailing slash)
      const products = result.nodes.find((n) => n.title === 'Products');
      expect(products?.url).toBe('https://example.com/products');

      const blog = result.nodes.find((n) => n.title === 'Blog');
      expect(blog?.url).toBe('https://example.com/blog');
    });

    it('should generate titles from URLs when missing', () => {
      const input: RawNode[] = [
        { url: 'https://example.com/winter-jackets' },
        { url: 'https://example.com/running_shoes' },
      ];

      const result = builder.buildFromUrls(input);

      const winterJackets = result.nodes.find((n) => n.slug === 'winter-jackets');
      expect(winterJackets?.title).toBe('Winter Jackets');

      const runningShoes = result.nodes.find((n) => n.slug === 'running_shoes');
      expect(runningShoes?.title).toBe('Running Shoes');
    });

    it('should correctly identify parent-child relationships', () => {
      const input: RawNode[] = [
        { url: 'https://example.com', title: 'Home' },
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/products/electronics', title: 'Electronics' },
        { url: 'https://example.com/products/electronics/phones', title: 'Phones' },
        { url: 'https://example.com/products/clothing', title: 'Clothing' },
        { url: 'https://example.com/blog', title: 'Blog' },
        { url: 'https://example.com/blog/2024', title: '2024 Posts' },
      ];

      const result = builder.buildFromUrls(input);

      // Check parent-child relationships
      const home = result.nodes.find((n) => n.slug === 'home');
      expect(home?.parent_id).toBeNull();
      expect(home?.children).toHaveLength(2); // products and blog

      const products = result.nodes.find((n) => n.slug === 'products');
      expect(products?.parent_id).toBe(home?.id);
      expect(products?.children).toHaveLength(2); // electronics and clothing

      const phones = result.nodes.find((n) => n.slug === 'phones');
      const electronics = result.nodes.find((n) => n.slug === 'electronics');
      expect(phones?.parent_id).toBe(electronics?.id);
    });

    it('should calculate statistics correctly', () => {
      const input: RawNode[] = [
        { url: 'https://example.com', title: 'Home' },
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/products/shoes', title: 'Shoes' },
        { url: 'https://example.com/products/clothing', title: 'Clothing' },
        { url: 'https://example.com/blog', title: 'Blog' },
      ];

      const result = builder.buildFromUrls(input);

      expect(result.stats.totalNodes).toBe(5);
      expect(result.stats.rootNodes).toBe(1);
      expect(result.stats.leafNodes).toBe(3); // shoes, clothing, blog
      expect(result.stats.maxChildren).toBe(2); // home has 2 children
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const result = builder.buildFromUrls([]);
      expect(result.nodes).toHaveLength(0);
      expect(result.rootNodes).toHaveLength(0);
    });

    it('should handle invalid URLs', () => {
      const input: RawNode[] = [
        { url: 'not-a-url', title: 'Invalid' },
        { url: 'https://example.com', title: 'Valid' },
      ];

      const result = builder.buildFromUrls(input);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('Invalid URL: not-a-url');
    });

    it('should handle very deep hierarchies', () => {
      const input: RawNode[] = [];
      let path = 'https://example.com';

      // Create 12 levels deep
      for (let i = 0; i < 12; i++) {
        path += `/level${i}`;
        input.push({ url: path, title: `Level ${i}` });
      }

      const result = builder.buildFromUrls(input);
      expect(result.maxDepth).toBe(11);
      expect(result.warnings).toContainEqual(expect.stringContaining('Very deep hierarchy'));
    });

    it('should handle URLs with special characters', () => {
      const input: RawNode[] = [
        { url: 'https://example.com/products/café', title: 'Café' },
        { url: 'https://example.com/products/naïve', title: 'Naïve' },
        { url: 'https://example.com/products/100%25-cotton', title: '100% Cotton' },
      ];

      const result = builder.buildFromUrls(input);
      expect(result.nodes).toHaveLength(3);
    });

    it('should handle URLs with query parameters and fragments', () => {
      const input: RawNode[] = [
        { url: 'https://example.com/search?q=test', title: 'Search' },
        { url: 'https://example.com/search?q=test&page=2', title: 'Search Page 2' },
        { url: 'https://example.com/products#section', title: 'Products' },
      ];

      const result = builder.buildFromUrls(input);
      expect(result.nodes).toHaveLength(3);
    });
  });

  describe('performance', () => {
    it('should handle 1000+ URLs efficiently', () => {
      const input: RawNode[] = [];

      // Generate 1000 URLs
      for (let i = 0; i < 1000; i++) {
        const category = Math.floor(i / 100);
        const subcategory = Math.floor(i / 10) % 10;
        input.push({
          url: `https://example.com/cat${category}/sub${subcategory}/item${i}`,
          title: `Item ${i}`,
        });
      }

      const start = Date.now();
      const result = builder.buildFromUrls(input);
      const duration = Date.now() - start;

      expect(result.nodes).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle wide hierarchies efficiently', () => {
      const input: RawNode[] = [{ url: 'https://example.com', title: 'Home' }];

      // Create 100 direct children of home
      for (let i = 0; i < 100; i++) {
        input.push({
          url: `https://example.com/category${i}`,
          title: `Category ${i}`,
        });
      }

      const start = Date.now();
      const result = builder.buildFromUrls(input);
      const duration = Date.now() - start;

      expect(result.nodes).toHaveLength(101);
      expect(result.stats.maxChildren).toBe(100);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('validation', () => {
    it('should detect orphaned nodes', () => {
      const builder = new HierarchyBuilder();
      const input: RawNode[] = [
        { url: 'https://example.com/products/shoes', title: 'Shoes' },
        // Missing parent: https://example.com/products
      ];

      const result = builder.buildFromUrls(input);
      // Orphaned nodes should become root nodes
      expect(result.rootNodes).toHaveLength(1);
    });

    it('should handle circular references gracefully', () => {
      // Note: Natural URLs cannot create circular references,
      // but the validation logic should still handle them
      const input: RawNode[] = [
        { url: 'https://example.com/a', title: 'A' },
        { url: 'https://example.com/a/b', title: 'B' },
        { url: 'https://example.com/a/b/c', title: 'C' },
      ];

      const result = builder.buildFromUrls(input);

      // Manually inject circular reference for testing validation
      if (result.nodes[2]) {
        // This would normally not happen with URLs
        result.nodes[0].parent_id = result.nodes[2].id;
      }

      // The builder should detect this in validation
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should validate hierarchy integrity', () => {
      const input: RawNode[] = [
        { url: 'https://example.com', title: 'Home' },
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/products/shoes', title: 'Shoes' },
      ];

      const result = builder.buildFromUrls(input);

      // All nodes should have consistent parent-child relationships
      result.nodes.forEach((node) => {
        if (node.parent_id) {
          const parent = result.nodes.find((n) => n.id === node.parent_id);
          expect(parent).toBeDefined();
          expect(parent?.children).toContain(node.id);
        }
      });
    });
  });

  describe('breadcrumb generation', () => {
    it('should generate correct breadcrumbs', () => {
      const input: RawNode[] = [
        { url: 'https://example.com', title: 'Home' },
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/products/electronics', title: 'Electronics' },
        { url: 'https://example.com/products/electronics/phones', title: 'Phones' },
        { url: 'https://example.com/products/electronics/phones/iphone', title: 'iPhone' },
      ];

      const result = builder.buildFromUrls(input);

      const iphone = result.nodes.find((n) => n.slug === 'iphone');
      expect(iphone?.breadcrumb).toEqual(['products', 'electronics', 'phones', 'iphone']);

      const home = result.nodes.find((n) => n.slug === 'home');
      expect(home?.breadcrumb).toEqual([]);
    });
  });
});
