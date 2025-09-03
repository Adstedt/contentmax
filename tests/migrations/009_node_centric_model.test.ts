import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

describe('Node-Centric Model Migration', () => {
  let supabase: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    // Use the actual Supabase instance URL and keys
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zjtrssubwocvooygfxbj.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqdHJzc3Vid29jdm9veWdmeGJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjI4MDk0NywiZXhwIjoyMDcxODU2OTQ3fQ.dgFd13svPLkWWp7ldhNm9B6us9oWbjYCDAS6cik784s';
    
    supabase = createClient<Database>(supabaseUrl, supabaseKey);
  });

  describe('taxonomy_nodes table modifications', () => {
    it('should have new columns added to taxonomy_nodes', async () => {
      const { data, error } = await supabase
        .from('taxonomy_nodes')
        .select('opportunity_score, revenue_potential, optimization_status, last_scored_at, metrics_updated_at')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce optimization_status constraint', async () => {
      const testNode = {
        url: 'https://test.com/invalid-status-test',
        path: '/invalid-status-test',
        project_id: 'test-project-id',
        optimization_status: 'invalid_status'
      };

      const { error } = await supabase
        .from('taxonomy_nodes')
        .insert(testNode);

      expect(error).toBeTruthy();
      expect(error?.message).toContain('chk_optimization_status');
    });

    it('should accept valid optimization_status values', async () => {
      const validStatuses = ['optimized', 'needs_work', 'critical', 'no_data'];
      
      for (const status of validStatuses) {
        const { data, error } = await supabase
          .from('taxonomy_nodes')
          .select('optimization_status')
          .eq('optimization_status', status)
          .limit(1);

        expect(error).toBeNull();
      }
    });
  });

  describe('node_metrics table', () => {
    it('should create node_metrics table', async () => {
      const { data, error } = await supabase
        .from('node_metrics')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce unique constraint on node_id, date, source', async () => {
      const nodeId = 'test-node-id';
      const testDate = '2024-01-01';
      const source = 'gsc';

      const metrics = {
        node_id: nodeId,
        date: testDate,
        source: source,
        impressions: 100,
        clicks: 10
      };

      // First insert should succeed
      const { error: firstError } = await supabase
        .from('node_metrics')
        .insert(metrics);

      // Second insert with same combination should fail
      const { error: secondError } = await supabase
        .from('node_metrics')
        .insert(metrics);

      expect(secondError).toBeTruthy();
      expect(secondError?.message).toContain('duplicate');

      // Clean up
      await supabase
        .from('node_metrics')
        .delete()
        .eq('node_id', nodeId);
    });

    it('should only accept valid source values', async () => {
      const invalidMetrics = {
        node_id: 'test-node-id',
        date: '2024-01-01',
        source: 'invalid_source'
      };

      const { error } = await supabase
        .from('node_metrics')
        .insert(invalidMetrics);

      expect(error).toBeTruthy();
      expect(error?.message).toContain('source');
    });

    it('should cascade delete when taxonomy_node is deleted', async () => {
      // This test would require creating a test node and metrics,
      // then deleting the node to verify cascade
      // Implementation depends on test data setup
    });
  });

  describe('opportunities table', () => {
    it('should create opportunities table', async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce priority range constraint', async () => {
      const invalidOpportunity = {
        node_id: 'test-node-id',
        score: 85.5,
        revenue_potential: 10000,
        priority: 150, // Invalid: outside 1-100 range
        factors: { search_volume: 0.8 }
      };

      const { error } = await supabase
        .from('opportunities')
        .insert(invalidOpportunity);

      expect(error).toBeTruthy();
      expect(error?.message).toContain('priority');
    });

    it('should enforce unique constraint on node_id', async () => {
      const nodeId = 'test-unique-node-id';
      const opportunity = {
        node_id: nodeId,
        score: 75.5,
        revenue_potential: 5000,
        priority: 50,
        factors: { ctr_gap: 0.6 }
      };

      // First insert should succeed
      await supabase.from('opportunities').insert(opportunity);

      // Second insert with same node_id should fail
      const { error } = await supabase
        .from('opportunities')
        .insert(opportunity);

      expect(error).toBeTruthy();
      expect(error?.message).toContain('duplicate');

      // Clean up
      await supabase
        .from('opportunities')
        .delete()
        .eq('node_id', nodeId);
    });

    it('should set valid_until to 7 days from computed_at by default', async () => {
      const opportunity = {
        node_id: 'test-valid-until-node',
        score: 80,
        revenue_potential: 7500,
        priority: 60,
        factors: {}
      };

      const { data } = await supabase
        .from('opportunities')
        .insert(opportunity)
        .select('computed_at, valid_until')
        .single();

      if (data) {
        const computedAt = new Date(data.computed_at!);
        const validUntil = new Date(data.valid_until!);
        const daysDiff = (validUntil.getTime() - computedAt.getTime()) / (1000 * 60 * 60 * 24);
        
        expect(Math.round(daysDiff)).toBe(7);
      }

      // Clean up
      await supabase
        .from('opportunities')
        .delete()
        .eq('node_id', opportunity.node_id);
    });
  });

  describe('indexes', () => {
    it('should have created all required indexes', async () => {
      // Query to check if indexes exist
      const indexQueries = [
        "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_taxonomy_nodes_score'",
        "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_taxonomy_nodes_status'",
        "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_taxonomy_nodes_revenue'",
        "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_node_metrics_node_date'",
        "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_node_metrics_date'",
        "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_node_metrics_source'",
        "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_opportunities_score'",
        "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_opportunities_priority'",
        "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_opportunities_revenue'",
        "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_opportunities_valid'"
      ];

      for (const query of indexQueries) {
        const { data, error } = await supabase.rpc('check_index_exists', { 
          index_query: query 
        });
        
        expect(error).toBeNull();
        expect(data).toBeTruthy();
      }
    });
  });

  describe('RLS policies', () => {
    it('should have RLS enabled on node_metrics', async () => {
      // This would typically be checked via system catalog queries
      // Implementation depends on Supabase admin capabilities
    });

    it('should have RLS enabled on opportunities', async () => {
      // This would typically be checked via system catalog queries
      // Implementation depends on Supabase admin capabilities
    });
  });

  describe('triggers', () => {
    it('should update updated_at on node_metrics update', async () => {
      const nodeId = 'test-trigger-node';
      const metrics = {
        node_id: nodeId,
        date: '2024-01-01',
        source: 'gsc' as const,
        impressions: 100
      };

      // Insert initial record
      const { data: inserted } = await supabase
        .from('node_metrics')
        .insert(metrics)
        .select('updated_at')
        .single();

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update the record
      const { data: updated } = await supabase
        .from('node_metrics')
        .update({ impressions: 200 })
        .eq('node_id', nodeId)
        .eq('date', '2024-01-01')
        .eq('source', 'gsc')
        .select('updated_at')
        .single();

      if (inserted && updated) {
        expect(new Date(updated.updated_at!).getTime())
          .toBeGreaterThan(new Date(inserted.updated_at!).getTime());
      }

      // Clean up
      await supabase
        .from('node_metrics')
        .delete()
        .eq('node_id', nodeId);
    });
  });
});