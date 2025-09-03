# TASK-003: Batch Import API

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 4 hours  
**Owner**: Backend Developer  
**Dependencies**: TASK-001 (Database Schema), TASK-002 (Hierarchy Builder)  
**Status**: Not Started

## Problem Statement

We need an efficient API endpoint to import large numbers of taxonomy nodes (1000+) with progress tracking, error recovery, and transaction management. The current implementation doesn't handle large imports efficiently or provide real-time progress updates.

## Technical Requirements

### 1. API Endpoint Implementation

#### File: `app/api/import/batch/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { HierarchyBuilder } from '@/lib/ingestion/hierarchy-builder';
import { BatchImporter } from '@/lib/import/batch-importer';
import { ImportProgressTracker } from '@/lib/import/progress-tracker';

// Request validation schema
const BatchImportSchema = z.object({
  projectId: z.string().uuid(),
  source: z.enum(['sitemap', 'csv', 'api', 'manual']),
  nodes: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .min(1)
    .max(10000),
  options: z
    .object({
      updateExisting: z.boolean().default(false),
      validateUrls: z.boolean().default(true),
      buildHierarchy: z.boolean().default(true),
      chunkSize: z.number().min(10).max(500).default(100),
      parallel: z.boolean().default(false),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  const importId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Parse and validate request
    const body = await request.json();
    const validated = BatchImportSchema.parse(body);

    // Initialize Supabase client
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', validated.projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Initialize progress tracker
    const tracker = new ImportProgressTracker(importId);
    await tracker.init({
      totalNodes: validated.nodes.length,
      projectId: validated.projectId,
      userId: user.id,
      source: validated.source,
    });

    // Build hierarchy if requested
    let processedNodes = validated.nodes;
    if (validated.options?.buildHierarchy) {
      const hierarchyBuilder = new HierarchyBuilder();
      const hierarchy = hierarchyBuilder.buildFromUrls(
        validated.nodes.map((n) => ({
          url: n.url,
          title: n.title,
        }))
      );

      processedNodes = hierarchy.nodes.map((node) => ({
        ...node,
        url: node.url,
        title: node.title,
        metadata: {
          ...validated.nodes.find((n) => n.url === node.url)?.metadata,
          hierarchy: {
            parent_id: node.parent_id,
            depth: node.depth,
            children: node.children,
            breadcrumb: node.breadcrumb,
          },
        },
      }));

      await tracker.updatePhase('hierarchy_built', {
        rootNodes: hierarchy.rootNodes.length,
        maxDepth: hierarchy.maxDepth,
      });
    }

    // Initialize batch importer
    const importer = new BatchImporter(supabase, tracker);

    // Import nodes in chunks
    const result = await importer.importNodes({
      projectId: validated.projectId,
      nodes: processedNodes,
      chunkSize: validated.options?.chunkSize || 100,
      updateExisting: validated.options?.updateExisting || false,
      parallel: validated.options?.parallel || false,
    });

    // Record import history
    await supabase.from('import_history').insert({
      id: importId,
      project_id: validated.projectId,
      user_id: user.id,
      source: validated.source,
      total_nodes: validated.nodes.length,
      successful: result.successful,
      failed: result.failed,
      duration: Date.now() - startTime,
      metadata: {
        errors: result.errors,
        warnings: result.warnings,
        stats: result.stats,
      },
    });

    // Return success response
    return NextResponse.json({
      importId,
      status: 'completed',
      results: {
        total: validated.nodes.length,
        successful: result.successful,
        failed: result.failed,
        updated: result.updated,
        skipped: result.skipped,
      },
      stats: result.stats,
      errors: result.errors,
      warnings: result.warnings,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    // Log error
    console.error('Batch import error:', error);

    // Update tracker with error
    const tracker = new ImportProgressTracker(importId);
    await tracker.setError(error instanceof Error ? error.message : 'Unknown error');

    // Return error response
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Import failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint for progress tracking
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const importId = searchParams.get('importId');

  if (!importId) {
    return NextResponse.json({ error: 'Import ID required' }, { status: 400 });
  }

  const tracker = new ImportProgressTracker(importId);
  const progress = await tracker.getProgress();

  if (!progress) {
    return NextResponse.json({ error: 'Import not found' }, { status: 404 });
  }

  return NextResponse.json(progress);
}
```

### 2. Batch Importer Implementation

#### File: `lib/import/batch-importer.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { ImportProgressTracker } from './progress-tracker';

export interface ImportNode {
  url: string;
  title?: string;
  metadata?: Record<string, any>;
  parent_id?: string | null;
  depth?: number;
}

export interface ImportOptions {
  projectId: string;
  nodes: ImportNode[];
  chunkSize: number;
  updateExisting: boolean;
  parallel: boolean;
}

export interface ImportResult {
  successful: number;
  failed: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
  warnings: string[];
  stats: ImportStats;
}

interface ImportError {
  url: string;
  error: string;
  index: number;
}

interface ImportStats {
  averageTimePerNode: number;
  chunksProcessed: number;
  retries: number;
  duplicatesFound: number;
}

export class BatchImporter {
  constructor(
    private supabase: SupabaseClient,
    private tracker: ImportProgressTracker
  ) {}

  async importNodes(options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = {
      successful: 0,
      failed: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      stats: {
        averageTimePerNode: 0,
        chunksProcessed: 0,
        retries: 0,
        duplicatesFound: 0,
      },
    };

    // Split nodes into chunks
    const chunks = this.chunkArray(options.nodes, options.chunkSize);

    // Process chunks
    if (options.parallel) {
      await this.processParallel(chunks, options, result);
    } else {
      await this.processSequential(chunks, options, result);
    }

    // Calculate final stats
    result.stats.averageTimePerNode =
      result.successful > 0
        ? Math.round((Date.now() - this.tracker.startTime) / result.successful)
        : 0;

    return result;
  }

  private async processSequential(
    chunks: ImportNode[][],
    options: ImportOptions,
    result: ImportResult
  ): Promise<void> {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await this.processChunk(chunk, options, result, i);
      result.stats.chunksProcessed++;

      // Update progress
      await this.tracker.updateProgress({
        processed: result.successful + result.failed + result.skipped,
        successful: result.successful,
        failed: result.failed,
        currentChunk: i + 1,
        totalChunks: chunks.length,
      });
    }
  }

  private async processParallel(
    chunks: ImportNode[][],
    options: ImportOptions,
    result: ImportResult
  ): Promise<void> {
    const MAX_CONCURRENT = 3;

    for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
      const batch = chunks.slice(i, i + MAX_CONCURRENT);

      await Promise.all(
        batch.map((chunk, index) => this.processChunk(chunk, options, result, i + index))
      );

      result.stats.chunksProcessed += batch.length;

      // Update progress
      await this.tracker.updateProgress({
        processed: result.successful + result.failed + result.skipped,
        successful: result.successful,
        failed: result.failed,
        currentChunk: Math.min(i + MAX_CONCURRENT, chunks.length),
        totalChunks: chunks.length,
      });
    }
  }

  private async processChunk(
    chunk: ImportNode[],
    options: ImportOptions,
    result: ImportResult,
    chunkIndex: number
  ): Promise<void> {
    const MAX_RETRIES = 3;
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
      try {
        // Check for existing URLs
        const urls = chunk.map((n) => n.url);
        const { data: existing } = await this.supabase
          .from('taxonomy_nodes')
          .select('id, url')
          .eq('project_id', options.projectId)
          .in('url', urls);

        const existingUrls = new Set(existing?.map((e) => e.url) || []);
        result.stats.duplicatesFound += existingUrls.size;

        // Separate new and existing nodes
        const newNodes = chunk.filter((n) => !existingUrls.has(n.url));
        const updateNodes = chunk.filter((n) => existingUrls.has(n.url));

        // Handle updates if requested
        if (options.updateExisting && updateNodes.length > 0) {
          await this.updateNodes(updateNodes, options.projectId, existing || [], result);
        } else {
          result.skipped += updateNodes.length;
          updateNodes.forEach((node) => {
            result.warnings.push(`Skipped existing URL: ${node.url}`);
          });
        }

        // Insert new nodes
        if (newNodes.length > 0) {
          await this.insertNodes(newNodes, options.projectId, result, chunkIndex);
        }

        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        result.stats.retries++;

        if (retryCount >= MAX_RETRIES) {
          // Record all nodes in chunk as failed
          chunk.forEach((node, index) => {
            result.failed++;
            result.errors.push({
              url: node.url,
              error: error instanceof Error ? error.message : 'Unknown error',
              index: chunkIndex * options.chunkSize + index,
            });
          });
        } else {
          // Wait before retry with exponential backoff
          await this.sleep(Math.pow(2, retryCount) * 1000);
        }
      }
    }
  }

  private async insertNodes(
    nodes: ImportNode[],
    projectId: string,
    result: ImportResult,
    chunkIndex: number
  ): Promise<void> {
    const toInsert = nodes.map((node) => ({
      project_id: projectId,
      url: node.url,
      title: node.title || this.generateTitle(node.url),
      path: this.extractPath(node.url),
      parent_id: node.parent_id || null,
      depth: node.depth || 0,
      metadata: node.metadata || {},
    }));

    const { data, error } = await this.supabase
      .from('taxonomy_nodes')
      .insert(toInsert)
      .select('id');

    if (error) {
      throw error;
    }

    result.successful += data?.length || 0;
  }

  private async updateNodes(
    nodes: ImportNode[],
    projectId: string,
    existing: any[],
    result: ImportResult
  ): Promise<void> {
    for (const node of nodes) {
      const existingNode = existing.find((e) => e.url === node.url);
      if (!existingNode) continue;

      const { error } = await this.supabase
        .from('taxonomy_nodes')
        .update({
          title: node.title,
          metadata: node.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingNode.id);

      if (error) {
        result.failed++;
        result.errors.push({
          url: node.url,
          error: error.message,
          index: -1,
        });
      } else {
        result.updated++;
      }
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private extractPath(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return '/';
    }
  }

  private generateTitle(url: string): string {
    const path = this.extractPath(url);
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || 'home';

    return lastSegment
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 3. Progress Tracker Implementation

#### File: `lib/import/progress-tracker.ts`

```typescript
import { createClient } from '@/lib/supabase/server';

export interface ImportProgress {
  importId: string;
  status: 'initializing' | 'processing' | 'completed' | 'failed';
  totalNodes: number;
  processed: number;
  successful: number;
  failed: number;
  percentage: number;
  currentPhase: string;
  currentChunk?: number;
  totalChunks?: number;
  estimatedTimeRemaining?: number;
  metadata?: Record<string, any>;
  error?: string;
  startTime: number;
  lastUpdate: number;
}

export class ImportProgressTracker {
  private progress: ImportProgress;
  public startTime: number;

  constructor(public importId: string) {
    this.startTime = Date.now();
    this.progress = {
      importId,
      status: 'initializing',
      totalNodes: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      percentage: 0,
      currentPhase: 'initializing',
      startTime: this.startTime,
      lastUpdate: this.startTime,
    };
  }

  async init(params: {
    totalNodes: number;
    projectId: string;
    userId: string;
    source: string;
  }): Promise<void> {
    this.progress = {
      ...this.progress,
      totalNodes: params.totalNodes,
      metadata: {
        projectId: params.projectId,
        userId: params.userId,
        source: params.source,
      },
    };

    await this.saveProgress();
  }

  async updateProgress(updates: Partial<ImportProgress>): Promise<void> {
    this.progress = {
      ...this.progress,
      ...updates,
      status: 'processing',
      lastUpdate: Date.now(),
    };

    // Calculate percentage
    if (this.progress.totalNodes > 0) {
      this.progress.percentage = Math.round(
        (this.progress.processed / this.progress.totalNodes) * 100
      );
    }

    // Estimate time remaining
    if (this.progress.processed > 0) {
      const elapsed = Date.now() - this.startTime;
      const timePerNode = elapsed / this.progress.processed;
      const remaining = this.progress.totalNodes - this.progress.processed;
      this.progress.estimatedTimeRemaining = Math.round(timePerNode * remaining);
    }

    await this.saveProgress();
  }

  async updatePhase(phase: string, metadata?: Record<string, any>): Promise<void> {
    this.progress.currentPhase = phase;
    if (metadata) {
      this.progress.metadata = {
        ...this.progress.metadata,
        ...metadata,
      };
    }

    await this.saveProgress();
  }

  async setCompleted(): Promise<void> {
    this.progress.status = 'completed';
    this.progress.percentage = 100;
    await this.saveProgress();
  }

  async setError(error: string): Promise<void> {
    this.progress.status = 'failed';
    this.progress.error = error;
    await this.saveProgress();
  }

  async getProgress(): Promise<ImportProgress | null> {
    // In production, this would fetch from Redis or database
    // For now, we'll use in-memory storage
    return this.progress;
  }

  private async saveProgress(): Promise<void> {
    // In production, save to Redis or database for persistence
    // Example Redis implementation:
    // await redis.setex(
    //   `import:${this.importId}`,
    //   3600, // 1 hour TTL
    //   JSON.stringify(this.progress)
    // );

    // For now, we'll use Supabase
    const supabase = await createClient();
    await supabase.from('import_progress').upsert({
      import_id: this.importId,
      progress: this.progress,
      updated_at: new Date().toISOString(),
    });
  }
}
```

### 4. WebSocket/SSE for Real-time Updates

#### File: `app/api/import/stream/route.ts`

```typescript
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const importId = searchParams.get('importId');

  if (!importId) {
    return new Response('Import ID required', { status: 400 });
  }

  // Set up Server-Sent Events
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const tracker = new ImportProgressTracker(importId);
      let lastUpdate = 0;

      const interval = setInterval(async () => {
        const progress = await tracker.getProgress();

        if (!progress) {
          controller.enqueue(encoder.encode('event: error\ndata: Import not found\n\n'));
          clearInterval(interval);
          controller.close();
          return;
        }

        // Only send update if changed
        if (progress.lastUpdate > lastUpdate) {
          lastUpdate = progress.lastUpdate;
          controller.enqueue(
            encoder.encode(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`)
          );
        }

        // Close stream when completed or failed
        if (progress.status === 'completed' || progress.status === 'failed') {
          clearInterval(interval);
          controller.close();
        }
      }, 1000); // Check every second

      // Clean up on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### 5. Frontend Usage Example

```typescript
// components/import/BatchImportUI.tsx
'use client';

import { useState } from 'react';
import { Progress } from '@/components/ui/Progress';

export function BatchImportUI() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const startImport = async (nodes: ImportNode[]) => {
    setImporting(true);

    // Start import
    const response = await fetch('/api/import/batch', {
      method: 'POST',
      body: JSON.stringify({
        projectId: currentProjectId,
        source: 'sitemap',
        nodes,
        options: {
          buildHierarchy: true,
          chunkSize: 100
        }
      })
    });

    const { importId } = await response.json();

    // Connect to SSE for progress updates
    const eventSource = new EventSource(`/api/import/stream?importId=${importId}`);

    eventSource.addEventListener('progress', (event) => {
      const progress = JSON.parse(event.data);
      setProgress(progress);
    });

    eventSource.addEventListener('error', () => {
      eventSource.close();
      setImporting(false);
    });
  };

  return (
    <div>
      {progress && (
        <div>
          <Progress value={progress.percentage} />
          <div className="text-sm text-gray-600 mt-2">
            Processing chunk {progress.currentChunk} of {progress.totalChunks}
            ({progress.processed}/{progress.totalNodes} nodes)
          </div>
          {progress.estimatedTimeRemaining && (
            <div className="text-sm text-gray-500">
              Estimated time remaining: {Math.round(progress.estimatedTimeRemaining / 1000)}s
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Imports 1000+ nodes in <30 seconds
- [ ] Chunk-based processing with configurable size
- [ ] Real-time progress updates via SSE/WebSocket
- [ ] Transaction management for data consistency
- [ ] Retry logic with exponential backoff
- [ ] Handles duplicate URLs appropriately
- [ ] Validates project access
- [ ] Records import history
- [ ] Detailed error reporting per node
- [ ] Memory efficient for large imports

## Testing

```typescript
// __tests__/api/import/batch.test.ts
describe('Batch Import API', () => {
  it('should import 1000 nodes successfully', async () => {
    const nodes = generateTestNodes(1000);

    const response = await fetch('/api/import/batch', {
      method: 'POST',
      body: JSON.stringify({
        projectId: testProjectId,
        source: 'test',
        nodes,
      }),
    });

    const result = await response.json();
    expect(result.results.successful).toBe(1000);
    expect(result.duration).toBeLessThan(30000);
  });

  it('should handle failures gracefully', async () => {
    const nodes = [
      { url: 'https://example.com/valid' },
      { url: 'invalid-url' },
      { url: 'https://example.com/another' },
    ];

    const response = await fetch('/api/import/batch', {
      method: 'POST',
      body: JSON.stringify({
        projectId: testProjectId,
        source: 'test',
        nodes,
      }),
    });

    const result = await response.json();
    expect(result.results.successful).toBe(2);
    expect(result.results.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
  });
});
```

## Implementation Steps

1. **Hour 1**: Create batch import endpoint
2. **Hour 2**: Implement BatchImporter class
3. **Hour 3**: Add progress tracking and SSE
4. **Hour 4**: Testing and optimization

## Performance Optimizations

- Use database transactions for chunk inserts
- Implement connection pooling
- Consider using database COPY for very large imports
- Add caching for duplicate detection

## Security Considerations

- Validate all URLs to prevent injection
- Rate limit import endpoints
- Limit maximum import size
- Sanitize metadata fields

## Notes

- Consider adding CSV import support
- May need queue system (Bull) for very large imports
- Could add import templates for common structures
- Progress tracking could use Redis for better performance
