import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@/lib/external/supabase/server';
import { BatchImporter } from '@/lib/data/import/batch-importer';
import { ImportProgressTracker } from '@/lib/data/import/progress-tracker';

jest.mock('@/lib/external/supabase/server');

describe('Batch Import API', () => {
  let mockSupabase: any;
  let importer: BatchImporter;
  let tracker: ImportProgressTracker;

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
        }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    tracker = new ImportProgressTracker('test-import-id', 100);
    importer = new BatchImporter(mockSupabase, tracker);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BatchImporter', () => {
    it('should process nodes in chunks', async () => {
      const nodes = generateTestNodes(250);
      
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });
      
      mockSupabase.select.mockResolvedValue({
        data: nodes.map((_, i) => ({ id: `node-${i}` })),
        error: null,
      });

      const result = await importer.import(nodes, 'test-project-id', {
        chunkSize: 50,
        handleDuplicates: 'skip',
        buildRelationships: false,
      });

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(250);
      expect(result.failedCount).toBe(0);
      expect(mockSupabase.from).toHaveBeenCalledWith('taxonomy_nodes');
    });

    it('should handle duplicates according to strategy', async () => {
      const nodes = generateTestNodes(10);
      
      mockSupabase.select.mockResolvedValue({
        data: [{ url: nodes[0].url }],
        error: null,
      });

      const result = await importer.import(nodes, 'test-project-id', {
        chunkSize: 10,
        handleDuplicates: 'skip',
        buildRelationships: false,
      });

      expect(result.successCount).toBe(10);
    });

    it('should build relationships when enabled', async () => {
      const nodes = [
        { url: 'https://example.com', title: 'Home' },
        { url: 'https://example.com/products', title: 'Products' },
        { url: 'https://example.com/products/shoes', title: 'Shoes' },
      ];

      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await importer.import(nodes, 'test-project-id', {
        chunkSize: 10,
        handleDuplicates: 'skip',
        buildRelationships: true,
      });

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(3);
    });

    it('should retry failed chunks with exponential backoff', async () => {
      const nodes = generateTestNodes(50);
      let attemptCount = 0;

      mockSupabase.select.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.resolve({
            data: null,
            error: new Error('Database error'),
          });
        }
        return Promise.resolve({
          data: nodes.map((_, i) => ({ id: `node-${i}` })),
          error: null,
        });
      });

      const result = await importer.import(nodes, 'test-project-id', {
        chunkSize: 50,
        handleDuplicates: 'skip',
        buildRelationships: false,
      });

      expect(attemptCount).toBe(3);
      expect(result.successCount).toBe(50);
    });

    it('should handle 1000+ nodes efficiently', async () => {
      const nodes = generateTestNodes(1000);
      
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null,
      });

      const startTime = Date.now();
      
      const result = await importer.import(nodes, 'test-project-id', {
        chunkSize: 100,
        handleDuplicates: 'skip',
        buildRelationships: false,
      });

      const duration = Date.now() - startTime;

      expect(result.successCount).toBe(1000);
      expect(duration).toBeLessThan(30000);
    });

    it('should update progress during import', async () => {
      const nodes = generateTestNodes(100);
      const progressUpdates: any[] = [];

      tracker.on('progress', (progress) => {
        progressUpdates.push(progress);
      });

      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null,
      });

      await importer.import(nodes, 'test-project-id', {
        chunkSize: 25,
        handleDuplicates: 'skip',
        buildRelationships: false,
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].percentage).toBe(100);
    });

    it('should handle errors gracefully', async () => {
      const nodes = generateTestNodes(50);
      
      mockSupabase.select.mockRejectedValue(new Error('Database connection failed'));

      const result = await importer.import(nodes, 'test-project-id', {
        chunkSize: 50,
        handleDuplicates: 'skip',
        buildRelationships: false,
      });

      expect(result.success).toBe(false);
      expect(result.failedCount).toBe(50);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('ImportProgressTracker', () => {
    it('should track progress accurately', () => {
      const tracker = new ImportProgressTracker('test-id', 100);
      
      tracker.updateProgress({
        processed: 25,
        successful: 20,
        failed: 5,
      });

      const progress = tracker.getProgress();
      expect(progress.percentage).toBe(25);
      expect(progress.successful).toBe(20);
      expect(progress.failed).toBe(5);
      expect(progress.status).toBe('processing');
    });

    it('should emit progress events', (done) => {
      const tracker = new ImportProgressTracker('test-id', 100);
      
      tracker.on('progress', (progress) => {
        expect(progress.processed).toBe(50);
        expect(progress.percentage).toBe(50);
        done();
      });

      tracker.updateProgress({
        processed: 50,
        successful: 50,
        failed: 0,
      });
    });

    it('should complete when all nodes are processed', () => {
      const tracker = new ImportProgressTracker('test-id', 100);
      
      tracker.complete(95, 5);

      const progress = tracker.getProgress();
      expect(progress.status).toBe('failed');
      expect(progress.processed).toBe(100);
      expect(progress.successful).toBe(95);
      expect(progress.failed).toBe(5);
    });

    it('should maintain progress history', () => {
      const tracker = new ImportProgressTracker('test-id', 100);
      
      tracker.updateProgress({ processed: 25 });
      tracker.updateProgress({ processed: 50 });
      tracker.updateProgress({ processed: 75 });
      tracker.updateProgress({ processed: 100 });

      const history = tracker.getHistory();
      expect(history.length).toBe(4);
      expect(history[0].processed).toBe(25);
      expect(history[3].processed).toBe(100);
    });
  });

  describe('SSE Streaming', () => {
    it('should stream progress updates', async () => {
      const mockRequest = {
        nextUrl: {
          searchParams: new URLSearchParams({ id: 'test-import-id' }),
        },
        signal: new AbortController().signal,
      };

      const response = await fetch('/api/import/stream?id=test-import-id');
      
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });
  });
});

function generateTestNodes(count: number) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const category = Math.floor(i / 100);
    const subcategory = Math.floor(i / 10) % 10;
    nodes.push({
      url: `https://example.com/cat${category}/sub${subcategory}/item${i}`,
      title: `Item ${i}`,
      metadata: {
        index: i,
        category,
        subcategory,
      },
    });
  }
  return nodes;
}