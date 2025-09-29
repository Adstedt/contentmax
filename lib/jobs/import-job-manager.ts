import { createClient } from '@/lib/external/supabase/client';
import { RetryManager } from '@/lib/resilience/retry-manager';
import { CircuitBreaker } from '@/lib/resilience/circuit-breaker';

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export interface ImportJob {
  id: string;
  type: string;
  config: any;
  user_id: string;
  status: JobStatus;
  retry_count?: number;
  created_at: string;
  updated_at?: string;
  error_message?: string;
  result?: any;
}

export class ImportJobManager {
  private retryManager: RetryManager;
  private circuitBreaker: CircuitBreaker;
  private supabase;

  constructor() {
    this.retryManager = new RetryManager();
    this.circuitBreaker = new CircuitBreaker();
    this.supabase = createClient();
  }

  async createJob(type: string, config: any, userId: string): Promise<ImportJob> {
    const { data: job, error } = await this.supabase
      .from('import_jobs')
      .insert({
        type,
        config,
        user_id: userId,
        status: JobStatus.PENDING,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create job: ${error.message}`);
    }

    // Queue job for processing
    await this.queueJob(job);

    return job;
  }

  async processJob(jobId: string): Promise<void> {
    try {
      // Update status
      await this.updateJobStatus(jobId, JobStatus.PROCESSING);

      // Get job details
      const job = await this.getJob(jobId);

      // Execute with circuit breaker and retry
      const result = await this.circuitBreaker.execute(async () => {
        return await this.retryManager.executeWithRetry(async () => {
          return await this.executeImport(job);
        });
      });

      // Mark as completed
      await this.updateJobStatus(jobId, JobStatus.COMPLETED, { result });
    } catch (error) {
      // Handle failure
      await this.handleJobFailure(jobId, error);
    }
  }

  private async getJob(jobId: string): Promise<ImportJob> {
    const { data: job, error } = await this.supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    return job;
  }

  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    updates?: Partial<ImportJob>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('import_jobs')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...updates,
      })
      .eq('id', jobId);

    if (error) {
      console.error(`Failed to update job status: ${error.message}`);
    }
  }

  private async executeImport(job: ImportJob): Promise<any> {
    switch (job.type) {
      case 'sitemap':
        return await this.importSitemap(job.config);
      case 'google_merchant':
        return await this.importGoogleMerchant(job.config);
      case 'search_console':
        return await this.importSearchConsole(job.config);
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  private async importSitemap(config: any): Promise<any> {
    // Placeholder for sitemap import logic
    console.log('Importing sitemap:', config.url);
    // This would integrate with existing sitemap processing
    return { imported: 0, message: 'Sitemap import to be implemented' };
  }

  private async importGoogleMerchant(config: any): Promise<any> {
    // Placeholder for Google Merchant import logic
    console.log('Importing Google Merchant data:', config);
    // This would integrate with existing Google Merchant API
    return { imported: 0, message: 'Google Merchant import to be implemented' };
  }

  private async importSearchConsole(config: any): Promise<any> {
    // Placeholder for Search Console import logic
    console.log('Importing Search Console data:', config);
    // This would integrate with existing Search Console API
    return { imported: 0, message: 'Search Console import to be implemented' };
  }

  private async handleJobFailure(jobId: string, error: any): Promise<void> {
    const job = await this.getJob(jobId);

    // Increment retry count
    const retryCount = (job.retry_count || 0) + 1;

    if (retryCount < 3) {
      // Schedule retry
      await this.scheduleRetry(jobId, retryCount);
    } else {
      // Move to dead letter queue
      await this.moveToDeadLetter(jobId, error);

      // Send alert
      await this.sendFailureAlert(job, error);
    }
  }

  private async scheduleRetry(jobId: string, retryCount: number): Promise<void> {
    const delayMs = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s

    await this.supabase
      .from('import_jobs')
      .update({
        status: JobStatus.RETRYING,
        retry_count: retryCount,
        next_retry_at: new Date(Date.now() + delayMs).toISOString(),
      })
      .eq('id', jobId);

    // Schedule retry
    setTimeout(() => this.processJob(jobId), delayMs);
  }

  private async moveToDeadLetter(jobId: string, error: any): Promise<void> {
    await this.supabase
      .from('import_jobs')
      .update({
        status: JobStatus.FAILED,
        error_message: error.message || 'Unknown error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Also insert into dead letter queue for review
    await this.supabase.from('dead_letter_queue').insert({
      job_id: jobId,
      error_message: error.message,
      error_stack: error.stack,
      created_at: new Date().toISOString(),
    });
  }

  private async sendFailureAlert(job: ImportJob, error: any): Promise<void> {
    // This would integrate with AlertManager
    console.error(`Job ${job.id} failed permanently:`, error);
    // Alert implementation will be in alerting.ts
  }

  private async queueJob(job: ImportJob): Promise<void> {
    // For now, process immediately
    // In production, this would use a proper queue (Redis, SQS, etc.)
    setTimeout(() => this.processJob(job.id), 0);
  }

  async retryJob(jobId: string): Promise<void> {
    // Manual retry capability
    await this.updateJobStatus(jobId, JobStatus.PENDING, {
      retry_count: 0,
      error_message: undefined,
    });
    await this.processJob(jobId);
  }

  async getJobStats(timeWindowMs: number = 24 * 60 * 60 * 1000): Promise<any> {
    const since = new Date(Date.now() - timeWindowMs).toISOString();

    const { data: jobs, error } = await this.supabase
      .from('import_jobs')
      .select('status, type')
      .gte('created_at', since);

    if (error) {
      throw new Error(`Failed to fetch job stats: ${error.message}`);
    }

    const stats = {
      total: jobs.length,
      successful: jobs.filter((j) => j.status === JobStatus.COMPLETED).length,
      failed: jobs.filter((j) => j.status === JobStatus.FAILED).length,
      pending: jobs.filter((j) => j.status === JobStatus.PENDING).length,
      processing: jobs.filter((j) => j.status === JobStatus.PROCESSING).length,
      retrying: jobs.filter((j) => j.status === JobStatus.RETRYING).length,
      successRate: 0,
      byType: {} as Record<string, any>,
    };

    stats.successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;

    // Group by type
    jobs.forEach((job) => {
      if (!stats.byType[job.type]) {
        stats.byType[job.type] = { total: 0, successful: 0, failed: 0 };
      }
      stats.byType[job.type].total++;
      if (job.status === JobStatus.COMPLETED) {
        stats.byType[job.type].successful++;
      } else if (job.status === JobStatus.FAILED) {
        stats.byType[job.type].failed++;
      }
    });

    return stats;
  }
}
