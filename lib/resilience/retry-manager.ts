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
    retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'],
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
          throw new Error(`Failed after ${attempt} attempts: ${(error as Error).message}`);
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
    const retryablePatterns = [/rate limit/i, /timeout/i, /network/i, /temporary/i];

    return retryablePatterns.some((pattern) => pattern.test(error.message || ''));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async recordSuccess(): Promise<void> {
    // Record success metrics (to be implemented with monitoring)
  }

  private async recordFailure(error: any): Promise<void> {
    // Record failure metrics (to be implemented with monitoring)
    console.error('Operation failed permanently:', error);
  }
}
