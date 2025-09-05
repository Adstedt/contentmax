# STORY-013: Add Error Recovery and Monitoring

## Story Overview

**Story ID:** STORY-013  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P1 - High  
**Estimated Effort:** 3 hours  
**Story Points:** 3  

## User Story

As a **system administrator**,  
I want **robust error handling and monitoring for the data pipeline**,  
So that **imports can recover from failures and I'm alerted to issues**.

## Context

Data ingestion from external sources is prone to failures (API limits, network issues, data format changes). The system needs to handle these gracefully, retry when appropriate, and alert administrators.

## Acceptance Criteria

### Functional Requirements
1. ✅ Automatic retry for transient failures
2. ✅ Dead letter queue for failed imports
3. ✅ Import status dashboard
4. ✅ Email alerts for critical failures
5. ✅ Manual retry capability

### Technical Requirements
6. ✅ Exponential backoff for retries
7. ✅ Circuit breaker for API calls
8. ✅ Structured error logging
9. ✅ Metrics collection
10. ✅ Health check endpoints

### Monitoring Requirements
11. ✅ Track import success/failure rates
12. ✅ Monitor API quota usage
13. ✅ Alert on data quality issues
14. ✅ Dashboard for system health

## Technical Implementation Notes

### Retry Manager
```typescript
// lib/resilience/retry-manager.ts
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export class RetryManager {
  private defaultConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'RATE_LIMIT',
      'TIMEOUT',
      'NETWORK_ERROR',
      'SERVICE_UNAVAILABLE'
    ]
  };
  
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: Error;
    
    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        // Attempt the operation
        const result = await operation();
        
        // Success - reset circuit breaker if needed
        await this.recordSuccess();
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryable(error, finalConfig.retryableErrors)) {
          throw error;
        }
        
        // Check if we've exhausted retries
        if (attempt === finalConfig.maxAttempts) {
          await this.recordFailure(error);
          throw new Error(`Failed after ${attempt} attempts: ${error.message}`);
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          finalConfig.initialDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
          finalConfig.maxDelay
        );
        
        // Log retry attempt
        console.log(`Retry attempt ${attempt}/${finalConfig.maxAttempts} after ${delay}ms`);
        
        await this.delay(delay);
      }
    }
    
    throw lastError!;
  }
  
  private isRetryable(error: any, retryableErrors: string[]): boolean {
    // Check error code
    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check HTTP status codes
    if (error.status === 429 || error.status === 503) {
      return true;
    }
    
    // Check error message patterns
    const retryablePatterns = [
      /rate limit/i,
      /timeout/i,
      /network/i,
      /temporary/i
    ];
    
    return retryablePatterns.some(pattern => 
      pattern.test(error.message || '')
    );
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Circuit Breaker
```typescript
// lib/resilience/circuit-breaker.ts
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute
  private readonly successThreshold = 2;
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }
  
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.successCount = 0;
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      console.error(`Circuit breaker opened after ${this.failureCount} failures`);
    }
  }
  
  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime.getTime() >= this.timeout
    );
  }
}
```

### Import Job Manager
```typescript
// lib/jobs/import-job-manager.ts
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export class ImportJobManager {
  private retryManager: RetryManager;
  private circuitBreaker: CircuitBreaker;
  
  constructor() {
    this.retryManager = new RetryManager();
    this.circuitBreaker = new CircuitBreaker();
  }
  
  async createJob(type: string, config: any, userId: string) {
    const { data: job } = await supabase
      .from('import_jobs')
      .insert({
        type,
        config,
        user_id: userId,
        status: JobStatus.PENDING,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    // Queue job for processing
    await this.queueJob(job);
    
    return job;
  }
  
  async processJob(jobId: string) {
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
      await this.updateJobStatus(jobId, JobStatus.COMPLETED, result);
      
    } catch (error) {
      // Handle failure
      await this.handleJobFailure(jobId, error);
    }
  }
  
  private async executeImport(job: any) {
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
  
  private async handleJobFailure(jobId: string, error: any) {
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
  
  private async scheduleRetry(jobId: string, retryCount: number) {
    const delayMs = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
    
    await supabase
      .from('import_jobs')
      .update({
        status: JobStatus.RETRYING,
        retry_count: retryCount,
        next_retry_at: new Date(Date.now() + delayMs).toISOString()
      })
      .eq('id', jobId);
    
    // Schedule retry
    setTimeout(() => this.processJob(jobId), delayMs);
  }
}
```

### Monitoring Dashboard Data
```typescript
// app/api/monitoring/imports/route.ts
export async function GET(request: NextRequest) {
  const session = await requireAuth(request);
  
  try {
    // Get job statistics
    const { data: stats } = await supabase
      .from('import_jobs')
      .select('status, type')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    // Calculate metrics
    const metrics = {
      total: stats.length,
      successful: stats.filter(j => j.status === 'completed').length,
      failed: stats.filter(j => j.status === 'failed').length,
      pending: stats.filter(j => j.status === 'pending').length,
      processing: stats.filter(j => j.status === 'processing').length,
      successRate: 0,
      byType: {}
    };
    
    metrics.successRate = metrics.total > 0 
      ? (metrics.successful / metrics.total) * 100 
      : 0;
    
    // Group by type
    stats.forEach(job => {
      if (!metrics.byType[job.type]) {
        metrics.byType[job.type] = { total: 0, successful: 0, failed: 0 };
      }
      metrics.byType[job.type].total++;
      if (job.status === 'completed') {
        metrics.byType[job.type].successful++;
      } else if (job.status === 'failed') {
        metrics.byType[job.type].failed++;
      }
    });
    
    // Get recent failures
    const { data: recentFailures } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      metrics,
      recentFailures,
      health: metrics.successRate > 90 ? 'healthy' : 'degraded'
    });
  } catch (error) {
    console.error('Failed to fetch monitoring data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    );
  }
}
```

### Alert Configuration
```typescript
// lib/monitoring/alerting.ts
export class AlertManager {
  async sendFailureAlert(job: any, error: Error) {
    const alert = {
      level: 'ERROR',
      title: `Import Job Failed: ${job.type}`,
      message: `Job ${job.id} failed after ${job.retry_count || 0} retries`,
      error: error.message,
      metadata: {
        job_id: job.id,
        job_type: job.type,
        user_id: job.user_id,
        error_stack: error.stack
      }
    };
    
    // Send to Sentry
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: {
          job_id: job.id,
          job_type: job.type
        }
      });
    }
    
    // Send email notification
    await this.sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: alert.title,
      template: 'job-failure',
      data: alert
    });
    
    // Log to database
    await supabase
      .from('system_alerts')
      .insert(alert);
  }
}
```

## Dependencies

- Existing import functionality
- Monitoring infrastructure (Sentry)
- Email service configured

## Testing Requirements

### Unit Tests
```typescript
describe('RetryManager', () => {
  it('retries on transient failures');
  it('respects max attempts');
  it('uses exponential backoff');
  it('throws on non-retryable errors');
});

describe('CircuitBreaker', () => {
  it('opens after threshold failures');
  it('closes after successful reset');
  it('transitions through states correctly');
});
```

### Integration Tests
- Test retry with real API calls
- Simulate various failure scenarios
- Verify alert notifications
- Test recovery procedures

## Definition of Done

- [ ] Retry logic implemented
- [ ] Circuit breaker working
- [ ] Job manager handles failures
- [ ] Monitoring dashboard created
- [ ] Alerts configured
- [ ] Dead letter queue functional
- [ ] Health checks implemented
- [ ] Unit tests passing
- [ ] Failure scenarios tested

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `lib/resilience/retry-manager.ts` (new)
- `lib/resilience/circuit-breaker.ts` (new)
- `lib/jobs/import-job-manager.ts` (modified)
- `lib/monitoring/alerting.ts` (new)
- `app/api/monitoring/imports/route.ts` (new)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned