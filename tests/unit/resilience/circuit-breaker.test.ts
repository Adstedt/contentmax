import { CircuitBreaker } from '@/lib/resilience/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker();
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute operation when circuit is closed', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should open circuit after threshold failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('failure'));

      // Fail 5 times (threshold)
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe('OPEN');
      expect(circuitBreaker.getFailureCount()).toBe(5);
    });

    it('should throw error when circuit is open', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {
          // Expected to fail
        }
      }

      // Try to execute when open
      const successOperation = jest.fn().mockResolvedValue('success');
      await expect(circuitBreaker.execute(successOperation)).rejects.toThrow(
        'Circuit breaker is OPEN'
      );

      expect(successOperation).not.toHaveBeenCalled();
    });

    it('should transition to half-open state after timeout', async () => {
      jest.useFakeTimers();
      const operation = jest.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Fast-forward past timeout (60 seconds)
      jest.advanceTimersByTime(61000);

      // Next attempt should transition to half-open
      const successOperation = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successOperation);

      expect(successOperation).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('should close circuit after successful reset in half-open state', async () => {
      jest.useFakeTimers();
      const failOperation = jest.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(failOperation);
        } catch {
          // Expected to fail
        }
      }

      // Fast-forward past timeout
      jest.advanceTimersByTime(61000);

      // Success in half-open state (need 2 successes to close)
      const successOperation = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);

      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.getFailureCount()).toBe(0);
      jest.useRealTimers();
    });

    it('should reopen circuit if failure occurs in half-open state', async () => {
      jest.useFakeTimers();
      const failOperation = jest.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(failOperation);
        } catch {
          // Expected to fail
        }
      }

      // Fast-forward past timeout
      jest.advanceTimersByTime(61000);

      // Fail in half-open state
      try {
        await circuitBreaker.execute(failOperation);
      } catch {
        // Expected to fail
      }

      expect(circuitBreaker.getState()).toBe('OPEN');
      jest.useRealTimers();
    });

    it('should reset failure count on success', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValueOnce('success');

      // Two failures
      try {
        await circuitBreaker.execute(operation);
      } catch {
        // Expected
      }
      try {
        await circuitBreaker.execute(operation);
      } catch {
        // Expected
      }

      expect(circuitBreaker.getFailureCount()).toBe(2);

      // Success should reset count
      await circuitBreaker.execute(operation);
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it('should manually reset circuit', () => {
      // Set some state
      circuitBreaker['state'] = 'OPEN';
      circuitBreaker['failureCount'] = 5;

      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });
  });
});
