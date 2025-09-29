import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MetricsSyncJob } from '@/lib/jobs/metrics-sync';
import { MetricsSyncTracker } from '@/lib/jobs/sync-tracker';
import { URLMatcher } from '@/lib/core/analysis/url-matcher';

// Mock dependencies
jest.mock('@/lib/external/analytics');
jest.mock('@/lib/external/supabase/server');

describe('MetricsSyncJob', () => {
  let mockSupabase: any;
  let tracker: MetricsSyncTracker;
  let job: MetricsSyncJob;

  beforeEach(() => {
    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    // Create tracker
    tracker = new MetricsSyncTracker('test-job-123', {
      projectId: 'test-project',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      sources: ['ga4', 'gsc'],
      dryRun: false,
    });

    // Create job
    job = new MetricsSyncJob(mockSupabase, tracker.getConfig(), tracker);
  });

  describe('Job Execution', () => {
    it('should fetch taxonomy nodes for the project', async () => {
      const mockNodes = [
        { id: 'node-1', url: 'https://example.com/page1', project_id: 'test-project' },
        { id: 'node-2', url: 'https://example.com/page2', project_id: 'test-project' },
      ];

      mockSupabase.select.mockResolvedValue({
        data: mockNodes,
        error: null,
      });

      // Mock empty metrics responses
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'taxonomy_nodes') {
          return {
            ...mockSupabase,
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: mockNodes,
              error: null,
            }),
          };
        }
        return {
          ...mockSupabase,
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      });

      await job.execute();

      const progress = tracker.getProgress();
      expect(progress.status).toBe('completed');
      expect(progress.totalNodes).toBe(2);
    });

    it('should handle empty nodes gracefully', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [],
        error: null,
      });

      await job.execute();

      const progress = tracker.getProgress();
      expect(progress.status).toBe('completed');
      expect(progress.totalNodes).toBe(0);
    });

    it('should handle database errors', async () => {
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      await expect(job.execute()).rejects.toThrow('Failed to fetch taxonomy nodes');

      const progress = tracker.getProgress();
      expect(progress.status).toBe('failed');
      expect(progress.errors.length).toBeGreaterThan(0);
    });
  });

  describe('URL Matching', () => {
    it('should match metrics to nodes using URLMatcher', async () => {
      const mockNodes = [
        { id: 'node-1', url: 'https://example.com/products', project_id: 'test-project' },
        { id: 'node-2', url: 'https://example.com/about', project_id: 'test-project' },
      ];

      // Mock GA4 metrics with slightly different URLs
      const mockGA4Metrics = [
        { url: 'https://www.example.com/products/', revenue: 1000 },
        { url: 'https://www.example.com/about/', revenue: 500 },
      ];

      // Test URL matching logic
      const matcher = new URLMatcher({ fuzzyThreshold: 0.7 });
      
      for (const metric of mockGA4Metrics) {
        let matched = false;
        for (const node of mockNodes) {
          const result = matcher.matchURL(metric.url, node.url);
          if (result && result.confidence >= 0.7) {
            matched = true;
            expect(result.confidence).toBeGreaterThanOrEqual(0.7);
            break;
          }
        }
        expect(matched).toBe(true);
      }
    });

    it('should track unmatched URLs', async () => {
      const mockNodes = [
        { id: 'node-1', url: 'https://example.com/products', project_id: 'test-project' },
      ];

      // Mock metrics with non-matching URL
      const unmatchedUrl = 'https://different-site.com/page';
      const matcher = new URLMatcher({ fuzzyThreshold: 0.9 });

      const result = matcher.matchURL(unmatchedUrl, mockNodes[0].url);
      expect(result).toBeNull();
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress accurately', async () => {
      tracker.start(100);
      
      for (let i = 0; i < 50; i++) {
        tracker.incrementProcessed(true);
      }
      
      for (let i = 0; i < 20; i++) {
        tracker.incrementProcessed(false);
      }

      const progress = tracker.getProgress();
      expect(progress.processedNodes).toBe(70);
      expect(progress.matchedNodes).toBe(50);
      expect(progress.unmatchedNodes).toBe(20);
      expect(progress.percentage).toBe(70);
    });

    it('should track source-specific metrics', () => {
      tracker.start(10);
      
      tracker.incrementGA4();
      tracker.incrementGA4();
      tracker.incrementGSC();
      
      const progress = tracker.getProgress();
      expect(progress.ga4Metrics).toBe(2);
      expect(progress.gscMetrics).toBe(1);
    });

    it('should handle errors properly', () => {
      tracker.addError('ga4', 'API quota exceeded');
      tracker.addError('database', 'Connection timeout');
      
      const progress = tracker.getProgress();
      expect(progress.errors).toHaveLength(2);
      expect(progress.errors[0].source).toBe('ga4');
      expect(progress.errors[1].source).toBe('database');
    });

    it('should generate summary report', () => {
      tracker.start(100);
      tracker.incrementProcessed(true);
      tracker.incrementGA4();
      tracker.complete('completed');
      
      const summary = tracker.getSummary();
      expect(summary).toContain('Status: completed');
      expect(summary).toContain('GA4 Metrics: 1');
    });
  });

  describe('Dry Run Mode', () => {
    it('should not store metrics in dry run mode', async () => {
      const dryRunTracker = new MetricsSyncTracker('dry-run-job', {
        projectId: 'test-project',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        sources: ['ga4'],
        dryRun: true,
      });

      const dryRunJob = new MetricsSyncJob(
        mockSupabase,
        dryRunTracker.getConfig(),
        dryRunTracker
      );

      mockSupabase.select.mockResolvedValue({
        data: [
          { id: 'node-1', url: 'https://example.com/test', project_id: 'test-project' },
        ],
        error: null,
      });

      await dryRunJob.execute();

      // Verify upsert was not called in dry run mode
      expect(mockSupabase.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should respect match threshold configuration', () => {
      const strictTracker = new MetricsSyncTracker('strict-job', {
        projectId: 'test-project',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        sources: ['ga4'],
        matchThreshold: 0.95,
      });

      const config = strictTracker.getConfig();
      expect(config.matchThreshold).toBe(0.95);
    });

    it('should allow source selection', () => {
      const ga4OnlyTracker = new MetricsSyncTracker('ga4-only', {
        projectId: 'test-project',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        sources: ['ga4'],
      });

      const config = ga4OnlyTracker.getConfig();
      expect(config.sources).toEqual(['ga4']);
      expect(config.sources).not.toContain('gsc');
    });
  });

  describe('Batch Processing', () => {
    it('should process metrics in batches', async () => {
      // Create 200 mock nodes
      const mockNodes = Array.from({ length: 200 }, (_, i) => ({
        id: `node-${i}`,
        url: `https://example.com/page${i}`,
        project_id: 'test-project',
      }));

      mockSupabase.select.mockResolvedValue({
        data: mockNodes,
        error: null,
      });

      // Mock metrics storage
      let upsertCallCount = 0;
      mockSupabase.upsert.mockImplementation(() => {
        upsertCallCount++;
        return Promise.resolve({ error: null });
      });

      await job.execute();

      // Should batch in chunks of 100
      expect(upsertCallCount).toBeLessThanOrEqual(2);
    });
  });

  describe('Report Generation', () => {
    it('should generate unmatched report', async () => {
      tracker.start(10);
      tracker.incrementProcessed(true);
      tracker.incrementProcessed(false);
      tracker.incrementProcessed(false);
      tracker.complete();

      const report = job.getUnmatchedReport();
      expect(report).toContain('Metrics Sync Report');
      expect(report).toContain('Unmatched Nodes: 2');
    });
  });
});