import { SupabaseClient } from '@supabase/supabase-js';
import { HierarchyBuilder, RawNode } from '@/lib/processing/hierarchy-builder';
import { ImportProgressTracker } from './progress-tracker';

interface BatchImportOptions {
  chunkSize?: number;
  handleDuplicates?: 'skip' | 'update' | 'error';
  buildRelationships?: boolean;
}

interface BatchImportResult {
  success: boolean;
  successCount: number;
  failedCount: number;
  errors: Array<{ node: string; error: string }>;
  importedNodes: string[];
}

export class BatchImporter {
  private supabase: SupabaseClient;
  private tracker: ImportProgressTracker;
  private hierarchyBuilder: HierarchyBuilder;

  constructor(supabase: SupabaseClient, tracker: ImportProgressTracker) {
    this.supabase = supabase;
    this.tracker = tracker;
    this.hierarchyBuilder = new HierarchyBuilder();
  }

  async import(
    nodes: RawNode[],
    projectId: string,
    options: BatchImportOptions = {}
  ): Promise<BatchImportResult> {
    const {
      chunkSize = 100,
      handleDuplicates = 'skip',
      buildRelationships = true,
    } = options;

    const result: BatchImportResult = {
      success: true,
      successCount: 0,
      failedCount: 0,
      errors: [],
      importedNodes: [],
    };

    try {
      if (buildRelationships) {
        const hierarchyResult = this.hierarchyBuilder.buildFromUrls(nodes, { 
          projectId,
          autoDetectRelationships: true,
          validateIntegrity: true,
        });

        const chunks = this.chunkArray(hierarchyResult.nodes, chunkSize);
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkResult = await this.processChunk(
            chunk,
            projectId,
            handleDuplicates,
            i,
            chunks.length
          );

          result.successCount += chunkResult.successCount;
          result.failedCount += chunkResult.failedCount;
          result.errors.push(...chunkResult.errors);
          result.importedNodes.push(...chunkResult.importedNodes);

          this.tracker.updateProgress({
            processed: result.successCount + result.failedCount,
            successful: result.successCount,
            failed: result.failedCount,
            currentChunk: i + 1,
            totalChunks: chunks.length,
          });
        }
      } else {
        const simpleNodes = nodes.map(node => ({
          id: this.generateId(node.url),
          url: this.normalizeUrl(node.url),
          path: this.extractPath(node.url),
          title: node.title || this.generateTitle(node.url),
          parent_id: null,
          depth: 0,
          children: [],
          slug: this.extractSlug(node.url),
          breadcrumb: this.extractBreadcrumb(node.url),
          project_id: projectId,
          position: 0,
          metadata: node.metadata || {},
        }));

        const chunks = this.chunkArray(simpleNodes, chunkSize);
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkResult = await this.processChunk(
            chunk,
            projectId,
            handleDuplicates,
            i,
            chunks.length
          );

          result.successCount += chunkResult.successCount;
          result.failedCount += chunkResult.failedCount;
          result.errors.push(...chunkResult.errors);
          result.importedNodes.push(...chunkResult.importedNodes);

          this.tracker.updateProgress({
            processed: result.successCount + result.failedCount,
            successful: result.successCount,
            failed: result.failedCount,
            currentChunk: i + 1,
            totalChunks: chunks.length,
          });
        }
      }

      result.success = result.failedCount === 0;
      return result;

    } catch (error) {
      console.error('Batch import error:', error);
      result.success = false;
      result.errors.push({ 
        node: 'batch', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return result;
    }
  }

  private async processChunk(
    chunk: any[],
    projectId: string,
    handleDuplicates: 'skip' | 'update' | 'error',
    chunkIndex: number,
    totalChunks: number
  ): Promise<BatchImportResult> {
    const result: BatchImportResult = {
      success: true,
      successCount: 0,
      failedCount: 0,
      errors: [],
      importedNodes: [],
    };

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        if (handleDuplicates === 'skip') {
          const urls = chunk.map(node => node.url);
          const { data: existing } = await this.supabase
            .from('taxonomy_nodes')
            .select('url')
            .eq('project_id', projectId)
            .in('url', urls);

          const existingUrls = new Set(existing?.map(e => e.url) || []);
          const newNodes = chunk.filter(node => !existingUrls.has(node.url));

          if (newNodes.length > 0) {
            const { data, error } = await this.supabase
              .from('taxonomy_nodes')
              .insert(newNodes)
              .select('id');

            if (error) throw error;

            result.successCount = newNodes.length;
            result.importedNodes = data?.map(d => d.id) || [];
          }

          result.successCount += existingUrls.size;

        } else if (handleDuplicates === 'update') {
          const { data, error } = await this.supabase
            .from('taxonomy_nodes')
            .upsert(chunk, {
              onConflict: 'url,project_id',
              returning: 'minimal',
            })
            .select('id');

          if (error) throw error;

          result.successCount = chunk.length;
          result.importedNodes = data?.map(d => d.id) || [];

        } else {
          const urls = chunk.map(node => node.url);
          const { data: existing } = await this.supabase
            .from('taxonomy_nodes')
            .select('url')
            .eq('project_id', projectId)
            .in('url', urls);

          if (existing && existing.length > 0) {
            throw new Error(`Duplicate URLs found: ${existing.map(e => e.url).join(', ')}`);
          }

          const { data, error } = await this.supabase
            .from('taxonomy_nodes')
            .insert(chunk)
            .select('id');

          if (error) throw error;

          result.successCount = chunk.length;
          result.importedNodes = data?.map(d => d.id) || [];
        }

        break;

      } catch (error) {
        attempt++;
        
        if (attempt >= maxRetries) {
          result.failedCount = chunk.length;
          chunk.forEach(node => {
            result.errors.push({
              node: node.url,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
          result.success = false;
        } else {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    return result;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      let normalized = urlObj.href;
      if (normalized.endsWith('/') && urlObj.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }
      urlObj.search = '';
      urlObj.hash = '';
      return urlObj.href.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  private extractPath(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return '/';
    }
  }

  private extractSlug(url: string): string {
    const path = this.extractPath(url);
    const segments = path.split('/').filter(Boolean);
    return segments[segments.length - 1] || 'home';
  }

  private extractBreadcrumb(url: string): string[] {
    const path = this.extractPath(url);
    return path.split('/').filter(Boolean);
  }

  private generateTitle(url: string): string {
    const slug = this.extractSlug(url);
    return slug
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateId(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `node_${Math.abs(hash).toString(16)}`;
  }
}