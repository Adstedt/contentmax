import { RetryManager } from '@/lib/resilience/retry-manager';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager();
    jest.clearAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should return result on successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryManager.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient failures', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockResolvedValueOnce('success');

      const result = await retryManager.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect max attempts', async () => {
      const error = new Error('NETWORK_ERROR');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(retryManager.executeWithRetry(operation, { maxAttempts: 2 })).rejects.toThrow(
        'Failed after 2 attempts'
      );

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      await retryManager.executeWithRetry(operation, {
        initialDelay: 100,
        backoffMultiplier: 2,
      });
      const duration = Date.now() - startTime;

      // Should have delays of 100ms and 200ms (total 300ms minimum)
      expect(duration).toBeGreaterThanOrEqual(300);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw on non-retryable errors', async () => {
      const error = new Error('INVALID_INPUT');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(retryManager.executeWithRetry(operation)).rejects.toThrow('INVALID_INPUT');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should recognize rate limit errors as retryable', async () => {
      const error = { status: 429, message: 'Rate limit exceeded' };
      const operation = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const result = await retryManager.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should recognize service unavailable as retryable', async () => {
      const error = { status: 503, message: 'Service unavailable' };
      const operation = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success');

      const result = await retryManager.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should respect max delay limit', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      await retryManager.executeWithRetry(operation, {
        initialDelay: 10000,
        maxDelay: 100,
        backoffMultiplier: 10,
      });
      const duration = Date.now() - startTime;

      // Should be capped at maxDelay * 2 attempts = 200ms (plus some execution time)
      expect(duration).toBeLessThan(500);
    });
  });
});
