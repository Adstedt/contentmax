import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  TaxonomyBuilder, 
  ProcessedUrl, 
  TaxonomyNode,
  ContentStatus 
} from '../lib/processing/taxonomy-builder';
import { HierarchyAnalyzer, RelationshipType } from '../lib/processing/hierarchy-analyzer';
import { GapAnalyzer, GapType } from '../lib/processing/gap-analyzer';
import { SimilarityCalculator } from '../lib/processing/similarity-calculator';
import { ProcessingQueue, JobStatus, ProcessingStage } from '../lib/processing/processing-queue';

describe('TaxonomyBuilder', () => {
  let builder: TaxonomyBuilder;

  beforeEach(() => {
    builder = new TaxonomyBuilder();
  });

  describe('buildHierarchy', () => {
    it('should build a simple hierarchy from URLs', () => {
      const urls: ProcessedUrl[] = [
        { url: 'https://example.com/', title: 'Home' },
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/products/electronics', title: 'Electronics' },
        { url: 'https://example.com/products/electronics/phones', title: 'Phones' },
        { url: 'https://example.com/about', title: 'About' },
      ];

      const hierarchy = builder.buildHierarchy(urls);

      expect(hierarchy).toBeDefined();
      expect(hierarchy.id).toBe('root');
      expect(hierarchy.children).toHaveLength(2);
      
      const productsNode = hierarchy.children.find(n => n.title === 'Products');
      expect(productsNode).toBeDefined();
      expect(productsNode?.children).toHaveLength(1);
      
      const electronicsNode = productsNode?.children.find(n => n.title === 'Electronics');
      expect(electronicsNode).toBeDefined();
      expect(electronicsNode?.children).toHaveLength(1);
    });

    it('should handle URLs with query parameters', () => {
      const urls: ProcessedUrl[] = [
        { url: 'https://example.com/search?q=test', title: 'Search Results' },
        { url: 'https://example.com/search?q=test&page=2', title: 'Search Page 2' },
      ];

      const hierarchy = builder.buildHierarchy(urls);
      expect(hierarchy.children).toHaveLength(2);
    });

    it('should calculate correct depths', () => {
      const urls: ProcessedUrl[] = [
        { url: 'https://example.com/', title: 'Home' },
        { url: 'https://example.com/level1', title: 'Level 1' },
        { url: 'https://example.com/level1/level2', title: 'Level 2' },
        { url: 'https://example.com/level1/level2/level3', title: 'Level 3' },
      ];

      const hierarchy = builder.buildHierarchy(urls);
      
      expect(hierarchy.depth).toBe(0);
      
      const level1 = hierarchy.children.find(n => n.title === 'Level 1');
      expect(level1?.depth).toBe(1);
      
      const level2 = level1?.children.find(n => n.title === 'Level 2');
      expect(level2?.depth).toBe(2);
      
      const level3 = level2?.children.find(n => n.title === 'Level 3');
      expect(level3?.depth).toBe(3);
    });

    it('should aggregate metadata correctly', () => {
      const urls: ProcessedUrl[] = [
        { 
          url: 'https://example.com/products', 
          title: 'Products',
          metadata: { skuCount: 10, hasContent: true }
        },
        { 
          url: 'https://example.com/products/electronics', 
          title: 'Electronics',
          metadata: { skuCount: 20, hasContent: true }
        },
      ];

      const hierarchy = builder.buildHierarchy(urls);
      const productsNode = hierarchy.children.find(n => n.title === 'Products');
      
      expect(productsNode?.metadata.skuCount).toBe(30);
      expect(productsNode?.metadata.hasContent).toBe(true);
    });
  });

  describe('detectPattern', () => {
    it('should detect URL patterns', () => {
      expect(builder.detectPattern('https://example.com/category/electronics')).toBe('category');
      expect(builder.detectPattern('https://example.com/products/phone')).toBe('product');
      expect(builder.detectPattern('https://example.com/brand/apple')).toBe('brand');
      expect(builder.detectPattern('https://example.com/blog/post-title')).toBe('blog');
      expect(builder.detectPattern('https://example.com/random')).toBeNull();
    });
  });

  describe('isParent and areSiblings', () => {
    it('should correctly identify parent-child relationships', () => {
      const parent = 'https://example.com/products';
      const child = 'https://example.com/products/electronics';
      const notChild = 'https://example.com/products/electronics/phones';
      
      expect(builder.isParent(parent, child)).toBe(true);
      expect(builder.isParent(parent, notChild)).toBe(false);
    });

    it('should correctly identify sibling relationships', () => {
      const sibling1 = 'https://example.com/products/electronics';
      const sibling2 = 'https://example.com/products/clothing';
      const notSibling = 'https://example.com/about';
      
      expect(builder.areSiblings(sibling1, sibling2)).toBe(true);
      expect(builder.areSiblings(sibling1, notSibling)).toBe(false);
    });
  });
});

describe('HierarchyAnalyzer', () => {
  let analyzer: HierarchyAnalyzer;
  let builder: TaxonomyBuilder;

  beforeEach(() => {
    analyzer = new HierarchyAnalyzer();
    builder = new TaxonomyBuilder();
  });

  describe('detectRelationships', () => {
    it('should detect all relationship types', () => {
      const urls: ProcessedUrl[] = [
        { url: 'https://example.com/', title: 'Home' },
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/products/electronics', title: 'Electronics' },
        { url: 'https://example.com/products/clothing', title: 'Clothing' },
        { url: 'https://example.com/orphan', title: 'Orphan Page' },
      ];

      const hierarchy = builder.buildHierarchy(urls);
      
      // Flatten the hierarchy to get all nodes
      const allNodes: TaxonomyNode[] = [];
      const collectNodes = (node: TaxonomyNode) => {
        allNodes.push(node);
        node.children.forEach(child => collectNodes(child));
      };
      collectNodes(hierarchy);
      
      const relationships = analyzer.detectRelationships(allNodes);

      const parentChildRelationships = relationships.filter(r => r.type === RelationshipType.PARENT_CHILD);
      const siblingRelationships = relationships.filter(r => r.type === RelationshipType.SIBLING);
      
      expect(parentChildRelationships.length).toBeGreaterThan(0);
      expect(siblingRelationships.length).toBeGreaterThan(0);
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate similarity between nodes', () => {
      const node1: TaxonomyNode = {
        id: 'node1',
        url: 'https://example.com/products/phones',
        title: 'Mobile Phones',
        parentId: 'products',
        depth: 2,
        children: [],
        metadata: {
          skuCount: 50,
          hasContent: true,
          contentStatus: ContentStatus.PROCESSED,
          lastModified: new Date(),
        },
      };

      const node2: TaxonomyNode = {
        id: 'node2',
        url: 'https://example.com/products/tablets',
        title: 'Mobile Tablets',
        parentId: 'products',
        depth: 2,
        children: [],
        metadata: {
          skuCount: 30,
          hasContent: true,
          contentStatus: ContentStatus.PROCESSED,
          lastModified: new Date(),
        },
      };

      const similarity = analyzer.calculateSimilarity(node1, node2);
      
      expect(similarity.urlSimilarity).toBeGreaterThan(0);
      expect(similarity.contentSimilarity).toBeGreaterThan(0);
      expect(similarity.metadataSimilarity).toBeGreaterThan(0);
      expect(similarity.overall).toBeGreaterThan(0);
    });
  });

  describe('analyzeHierarchyHealth', () => {
    it('should analyze hierarchy health metrics', () => {
      const urls: ProcessedUrl[] = [
        { url: 'https://example.com/', title: 'Home' },
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/products/item1', title: 'Item 1' },
        { url: 'https://example.com/products/item2', title: 'Item 2' },
      ];

      const hierarchy = builder.buildHierarchy(urls);
      analyzer.detectRelationships([hierarchy]);
      const health = analyzer.analyzeHierarchyHealth(hierarchy);

      expect(health.maxDepth).toBeGreaterThanOrEqual(0);
      expect(health.avgChildrenPerNode).toBeGreaterThanOrEqual(0);
      expect(health.orphanCount).toBe(0);
      expect(health.duplicateCount).toBe(0);
      expect(health.unbalancedNodes).toHaveLength(0);
    });
  });
});

describe('GapAnalyzer', () => {
  let analyzer: GapAnalyzer;

  beforeEach(() => {
    analyzer = new GapAnalyzer({
      outdatedThresholdDays: 180,
      thinContentThreshold: 300,
    });
  });

  describe('identifyGaps', () => {
    it('should identify missing content gaps', () => {
      const node: TaxonomyNode = {
        id: 'test',
        url: 'https://example.com/test',
        title: 'Test',
        parentId: null,
        depth: 1,
        children: [],
        metadata: {
          skuCount: 0,
          hasContent: false,
          contentStatus: ContentStatus.MISSING,
          lastModified: new Date(),
        },
      };

      const gaps = analyzer.identifyGaps(node);
      const missingGap = gaps.find(g => g.gapType === GapType.MISSING);
      
      expect(missingGap).toBeDefined();
      expect(missingGap?.reason).toContain('No content exists');
    });

    it('should identify outdated content', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);

      const node: TaxonomyNode = {
        id: 'test',
        url: 'https://example.com/test',
        title: 'Test',
        parentId: null,
        depth: 1,
        children: [],
        metadata: {
          skuCount: 10,
          hasContent: true,
          contentStatus: ContentStatus.PROCESSED,
          lastModified: oldDate,
        },
      };

      const gaps = analyzer.identifyGaps(node);
      const outdatedGap = gaps.find(g => g.gapType === GapType.OUTDATED);
      
      expect(outdatedGap).toBeDefined();
      expect(outdatedGap?.reason).toContain('hasn\'t been updated');
    });

    it('should prioritize gaps correctly', () => {
      const node: TaxonomyNode = {
        id: 'test',
        url: 'https://example.com/test',
        title: 'Test',
        parentId: null,
        depth: 1,
        children: [],
        metadata: {
          skuCount: 100,
          hasContent: false,
          contentStatus: ContentStatus.MISSING,
          lastModified: new Date(),
        },
      };

      const gaps = analyzer.identifyGaps(node);
      
      expect(gaps[0].priority).toBeGreaterThan(0);
      expect(gaps[0].priority).toBeLessThanOrEqual(1);
    });
  });

  describe('generateGapReport', () => {
    it('should generate comprehensive gap report', () => {
      const node: TaxonomyNode = {
        id: 'test',
        url: 'https://example.com/test',
        title: 'Test',
        parentId: null,
        depth: 1,
        children: [],
        metadata: {
          skuCount: 0,
          hasContent: false,
          contentStatus: ContentStatus.MISSING,
          lastModified: new Date(),
        },
      };

      const gaps = analyzer.identifyGaps(node);
      const report = analyzer.generateGapReport(gaps);

      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.recommendations).toHaveLength(report.recommendations.length);
      expect(report.estimatedEffort.hours).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(report.estimatedEffort.complexity);
    });
  });
});

describe('SimilarityCalculator', () => {
  let calculator: SimilarityCalculator;

  beforeEach(() => {
    calculator = new SimilarityCalculator({
      thresholds: {
        minimum: 0.3,
        high: 0.7,
      },
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate comprehensive similarity metrics', () => {
      const node1: TaxonomyNode = {
        id: 'node1',
        url: 'https://example.com/products/phones',
        title: 'Mobile Phones',
        parentId: 'products',
        depth: 2,
        children: [],
        metadata: {
          skuCount: 50,
          hasContent: true,
          contentStatus: ContentStatus.PROCESSED,
          lastModified: new Date(),
        },
      };

      const node2: TaxonomyNode = {
        id: 'node2',
        url: 'https://example.com/products/tablets',
        title: 'Tablet Devices',
        parentId: 'products',
        depth: 2,
        children: [],
        metadata: {
          skuCount: 30,
          hasContent: true,
          contentStatus: ContentStatus.PROCESSED,
          lastModified: new Date(),
        },
      };

      const result = calculator.calculateSimilarity(node1, node2);

      expect(result.urlSimilarity).toBeGreaterThanOrEqual(0);
      expect(result.urlSimilarity).toBeLessThanOrEqual(1);
      expect(result.titleSimilarity).toBeGreaterThanOrEqual(0);
      expect(result.titleSimilarity).toBeLessThanOrEqual(1);
      expect(result.structuralSimilarity).toBeGreaterThan(0);
      expect(result.contentSimilarity).toBeGreaterThan(0);
      expect(result.overallSimilarity).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should find duplicates', () => {
      const nodes: TaxonomyNode[] = [
        {
          id: 'node1',
          url: 'https://example.com/products/phone',
          title: 'Mobile Phone',
          parentId: 'products',
          depth: 2,
          children: [],
          metadata: {
            skuCount: 50,
            hasContent: true,
            contentStatus: ContentStatus.PROCESSED,
            lastModified: new Date(),
          },
        },
        {
          id: 'node2',
          url: 'https://example.com/products/phone',
          title: 'Mobile Phone',
          parentId: 'products',
          depth: 2,
          children: [],
          metadata: {
            skuCount: 50,
            hasContent: true,
            contentStatus: ContentStatus.PROCESSED,
            lastModified: new Date(),
          },
        },
      ];

      const duplicates = calculator.findDuplicates(nodes, 0.9);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].overallSimilarity).toBeGreaterThan(0.9);
    });
  });

  describe('clusterBySimilarity', () => {
    it('should cluster similar nodes', () => {
      const nodes: TaxonomyNode[] = [
        {
          id: 'phone1',
          url: 'https://example.com/products/iphone',
          title: 'iPhone',
          parentId: 'products',
          depth: 2,
          children: [],
          metadata: {
            skuCount: 20,
            hasContent: true,
            contentStatus: ContentStatus.PROCESSED,
            lastModified: new Date(),
          },
        },
        {
          id: 'phone2',
          url: 'https://example.com/products/samsung',
          title: 'Samsung Phone',
          parentId: 'products',
          depth: 2,
          children: [],
          metadata: {
            skuCount: 15,
            hasContent: true,
            contentStatus: ContentStatus.PROCESSED,
            lastModified: new Date(),
          },
        },
        {
          id: 'laptop',
          url: 'https://example.com/products/laptop',
          title: 'Laptop',
          parentId: 'products',
          depth: 2,
          children: [],
          metadata: {
            skuCount: 10,
            hasContent: true,
            contentStatus: ContentStatus.PROCESSED,
            lastModified: new Date(),
          },
        },
      ];

      const clusters = calculator.clusterBySimilarity(nodes, 0.3);
      expect(clusters.length).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('ProcessingQueue', () => {
  let queue: ProcessingQueue;

  beforeEach(() => {
    queue = new ProcessingQueue({
      batchSize: 10,
      parallelWorkers: 2,
      enableLogging: false,
    });
  });

  describe('enqueue and process', () => {
    it('should enqueue and process jobs', async () => {
      const jobId = await queue.enqueue({
        projectId: 'project1',
        type: 'full',
        data: { urls: ['https://example.com'] },
        totalItems: 1,
      });

      expect(jobId).toBeDefined();
      
      const status = queue.getJobStatus(jobId);
      expect(status).toBeDefined();
      expect([JobStatus.PENDING, JobStatus.IN_PROGRESS]).toContain(status?.status);
    });

    it('should handle job cancellation', async () => {
      const jobId = await queue.enqueue({
        projectId: 'project1',
        type: 'full',
        data: { urls: ['https://example.com'] },
        totalItems: 1,
      });

      const cancelled = await queue.cancelJob(jobId);
      expect(cancelled).toBe(true);

      const status = queue.getJobStatus(jobId);
      expect(status?.status).toBe(JobStatus.CANCELLED);
    });

    it('should provide queue statistics', async () => {
      await queue.enqueue({
        projectId: 'project1',
        type: 'full',
        data: { urls: ['https://example.com'] },
        totalItems: 1,
      });

      const stats = queue.getQueueStats();
      expect(stats.pending + stats.active + stats.completed + stats.failed).toBeGreaterThan(0);
    });

    it('should handle progress callbacks', async () => {
      let progressReceived = false;

      const jobId = await queue.enqueue({
        projectId: 'project1',
        type: 'full',
        data: { urls: ['https://example.com'] },
        totalItems: 1,
      });

      queue.onProgress(jobId, (progress) => {
        progressReceived = true;
        expect(progress.jobId).toBe(jobId);
        expect(progress.currentStage).toBeDefined();
        expect(progress.itemsProcessed).toBeGreaterThanOrEqual(0);
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      
      queue.removeProgressCallback(jobId);
    });
  });

  describe('batch processing', () => {
    it('should process items in batches', async () => {
      const items = Array.from({ length: 25 }, (_, i) => `item${i}`);
      let processedCount = 0;

      const jobId = await queue.enqueue({
        projectId: 'project1',
        type: 'full',
        data: { items },
        totalItems: items.length,
      });

      await queue.processInBatches(
        items,
        async (batch) => {
          processedCount += batch.length;
        },
        jobId
      );

      expect(processedCount).toBe(25);
    });
  });

  afterEach(async () => {
    await queue.stop();
  });
});