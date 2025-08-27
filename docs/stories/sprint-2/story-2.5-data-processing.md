# Story 2.5: Data Processing Pipeline

## User Story

As a data analyst,
I want scraped content automatically processed into a hierarchical taxonomy,
So that I can visualize the site structure and identify content relationships.

## Size & Priority

- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 2
- **Dependencies**: Task 2.3

## Description

Process scraped data into structured taxonomy with hierarchy detection, content similarity analysis, and performance optimization through materialized views.

## Implementation Steps

1. **Build taxonomy hierarchy from URLs**

   ```typescript
   interface TaxonomyNode {
     id: string;
     url: string;
     title: string;
     parentId: string | null;
     depth: number;
     children: TaxonomyNode[];
     metadata: {
       skuCount: number;
       hasContent: boolean;
       contentStatus: ContentStatus;
       lastModified: Date;
     };
   }

   class TaxonomyBuilder {
     buildHierarchy(urls: string[]): TaxonomyNode {
       // Parse URL paths
       // Detect parent-child relationships
       // Build tree structure
       // Calculate depths
     }
   }
   ```

2. **Detect content relationships**

   ```typescript
   class HierarchyAnalyzer {
     detectRelationships(nodes: TaxonomyNode[]): Relationship[] {
       // Analyze URL patterns
       // Find siblings
       // Detect cross-links
       // Identify orphans
     }

     calculateSimilarity(node1: TaxonomyNode, node2: TaxonomyNode): number {
       // URL similarity
       // Content similarity
       // Metadata similarity
       return similarityScore; // 0-1
     }
   }
   ```

3. **Content gap analysis**

   ```typescript
   interface ContentGap {
     nodeId: string;
     url: string;
     gapType: 'missing' | 'outdated' | 'thin';
     priority: number;
     reason: string;
     suggestedAction: string;
   }

   class GapAnalyzer {
     identifyGaps(taxonomy: TaxonomyNode): ContentGap[] {
       // Find nodes without content
       // Detect outdated content
       // Identify thin content
       // Calculate priority scores
     }
   }
   ```

4. **Create materialized views**

   ```sql
   -- Materialized view for fast hierarchy queries
   CREATE MATERIALIZED VIEW taxonomy_hierarchy AS
   WITH RECURSIVE tree AS (
     SELECT
       id,
       parent_id,
       url,
       title,
       0 as depth,
       ARRAY[id] as path
     FROM taxonomy_nodes
     WHERE parent_id IS NULL

     UNION ALL

     SELECT
       n.id,
       n.parent_id,
       n.url,
       n.title,
       t.depth + 1,
       t.path || n.id
     FROM taxonomy_nodes n
     JOIN tree t ON n.parent_id = t.id
   )
   SELECT * FROM tree;

   -- Index for performance
   CREATE INDEX idx_hierarchy_depth ON taxonomy_hierarchy(depth);
   CREATE INDEX idx_hierarchy_path ON taxonomy_hierarchy USING GIN(path);
   ```

5. **Processing queue implementation**
   ```typescript
   class ProcessingQueue {
     async processInBatches(items: ProcessingJob[], batchSize = 100) {
       for (const batch of chunks(items, batchSize)) {
         await Promise.all(batch.map((job) => this.processJob(job)));
         await this.updateProgress(batch.length);
       }
     }

     private async processJob(job: ProcessingJob) {
       try {
         // Parse content
         // Build relationships
         // Calculate metrics
         // Store results
       } catch (error) {
         await this.handleFailure(job, error);
       }
     }
   }
   ```

## Files to Create

- `lib/processing/taxonomy-builder.ts` - Build hierarchical structure
- `lib/processing/hierarchy-analyzer.ts` - Analyze relationships
- `lib/processing/gap-analyzer.ts` - Identify content gaps
- `lib/processing/similarity-calculator.ts` - Content similarity
- `lib/processing/processing-queue.ts` - Batch processing
- `supabase/functions/process-taxonomy/index.ts` - Edge function
- `supabase/migrations/002_materialized_views.sql` - Performance views
- `tests/processing.test.ts` - Unit and integration tests

## Processing Pipeline Stages

```typescript
enum ProcessingStage {
  URL_PARSING = 'url_parsing',
  HIERARCHY_BUILDING = 'hierarchy_building',
  RELATIONSHIP_DETECTION = 'relationship_detection',
  GAP_ANALYSIS = 'gap_analysis',
  SIMILARITY_CALCULATION = 'similarity_calculation',
  VIEW_REFRESH = 'view_refresh',
  COMPLETE = 'complete',
}

interface PipelineProgress {
  currentStage: ProcessingStage;
  completedStages: ProcessingStage[];
  itemsProcessed: number;
  totalItems: number;
  errors: ProcessingError[];
  estimatedTimeRemaining: number;
}
```

## Hierarchy Detection Rules

```typescript
const hierarchyRules = {
  // URL depth determines hierarchy
  depthSeparator: '/',

  // Common patterns
  patterns: {
    category: /\/(category|categories|c)\//,
    product: /\/(product|products|p)\//,
    brand: /\/(brand|brands|manufacturer)\//,
  },

  // Parent-child detection
  isParent: (url1: string, url2: string) => {
    return url2.startsWith(url1) && url2.split('/').length === url1.split('/').length + 1;
  },

  // Sibling detection
  areSiblings: (url1: string, url2: string) => {
    const parent1 = url1.substring(0, url1.lastIndexOf('/'));
    const parent2 = url2.substring(0, url2.lastIndexOf('/'));
    return parent1 === parent2;
  },
};
```

## Performance Optimization

```typescript
interface OptimizationConfig {
  batchSize: number; // Process in batches (default: 100)
  parallelWorkers: number; // Concurrent processing (default: 5)
  cacheEnabled: boolean; // Cache intermediate results
  viewRefreshInterval: number; // Minutes between view refresh (default: 60)
}

class PerformanceOptimizer {
  async optimizeLargeDataset(nodes: TaxonomyNode[], config: OptimizationConfig) {
    // Use streaming for large datasets
    // Implement caching layers
    // Batch database operations
    // Use connection pooling
  }
}
```

## Acceptance Criteria

- [ ] URLs processed into hierarchical taxonomy
- [ ] Parent-child relationships correctly identified
- [ ] Content gaps detected and prioritized
- [ ] Similarity scores calculated between related nodes
- [ ] Materialized views improve query performance
- [ ] Processing handles 10,000+ pages efficiently
- [ ] Queue system provides progress updates
- [ ] Error recovery for failed processing jobs

## Performance Requirements

- Process 1,000 URLs in <30 seconds
- Build hierarchy for 10,000 nodes in <2 minutes
- Materialized view refresh <10 seconds
- Memory usage <1GB for 50,000 nodes
- Support incremental updates

## Database Indexes

```sql
-- Performance-critical indexes
CREATE INDEX idx_nodes_parent ON taxonomy_nodes(parent_id);
CREATE INDEX idx_nodes_project ON taxonomy_nodes(project_id);
CREATE INDEX idx_nodes_status ON taxonomy_nodes(content_status);
CREATE INDEX idx_nodes_url ON taxonomy_nodes(url);

-- Full-text search
CREATE INDEX idx_nodes_search ON taxonomy_nodes
  USING GIN(to_tsvector('english', title || ' ' || url));
```

## Testing Requirements

- [ ] Test hierarchy building with various URL structures
- [ ] Test with flat vs deep site structures
- [ ] Test circular reference handling
- [ ] Test orphan node detection
- [ ] Test performance with large datasets
- [ ] Test materialized view updates
- [ ] Test error recovery
- [ ] Test incremental processing

## Definition of Done

- [ ] Code complete and committed
- [ ] Taxonomy hierarchy correctly built
- [ ] Relationships accurately detected
- [ ] Content gaps identified
- [ ] Materialized views functional
- [ ] Performance targets met
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed
