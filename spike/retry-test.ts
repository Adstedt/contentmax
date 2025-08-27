import OpenAI from 'openai';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

interface RetryResult<T> {
  data?: T;
  attempts: number;
  totalTime: number;
  errors: Error[];
}

export class RetryStrategy {
  private maxRetries: number;
  private baseDelay: number;
  private maxDelay: number;
  private backoffMultiplier: number;

  constructor(options: RetryOptions = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
  }

  async executeWithRetry<T>(operation: () => Promise<T>, context: string): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const errors: Error[] = [];
    let lastError: Error | null = null;

    console.log(`\n🔄 Starting operation: ${context}`);

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        if (attempt > 1) {
          const delay = this.calculateDelay(attempt - 1);
          console.log(`⏳ Retry ${attempt - 1}/${this.maxRetries} after ${delay}ms delay`);
          await this.sleep(delay);
        }

        console.log(`📡 Attempt ${attempt}: Executing...`);
        const result = await operation();

        const totalTime = Date.now() - startTime;
        console.log(`✅ Success on attempt ${attempt} (total time: ${totalTime}ms)`);

        return {
          data: result,
          attempts: attempt,
          totalTime,
          errors,
        };
      } catch (error) {
        lastError = error as Error;
        errors.push(lastError);

        console.log(`❌ Attempt ${attempt} failed: ${lastError.message}`);

        if (this.isRetryable(error) && attempt <= this.maxRetries) {
          console.log(`🔄 Error is retryable, will retry...`);
          continue;
        } else if (!this.isRetryable(error)) {
          console.log(`🚫 Error is not retryable, stopping...`);
          break;
        } else {
          console.log(`🚫 Max retries reached, stopping...`);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`❌ Operation failed after ${errors.length} attempts (total time: ${totalTime}ms)`);

    return {
      attempts: errors.length,
      totalTime,
      errors,
    };
  }

  private calculateDelay(attemptNumber: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffMultiplier, attemptNumber - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    const delay = Math.min(exponentialDelay + jitter, this.maxDelay);

    return Math.floor(delay);
  }

  private isRetryable(error: any): boolean {
    // OpenAI specific error codes that are retryable
    const retryableCodes = [429, 500, 502, 503, 504];

    // Check for OpenAI API errors
    if (error?.response?.status) {
      return retryableCodes.includes(error.response.status);
    }

    // Check for network errors
    if (error?.code) {
      const retryableNetworkCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
      return retryableNetworkCodes.includes(error.code);
    }

    // Check for specific OpenAI error types
    if (error?.type) {
      const retryableTypes = ['server_error', 'rate_limit_error'];
      return retryableTypes.includes(error.type);
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Test functions
export async function testRetryWithSimulatedFailures() {
  console.log('='.repeat(50));
  console.log('🧪 Testing Retry Strategy with Simulated Failures');
  console.log('='.repeat(50));

  const strategy = new RetryStrategy({
    maxRetries: 3,
    baseDelay: 1000,
    backoffMultiplier: 2,
  });

  let callCount = 0;

  // Test 1: Simulate API that fails twice then succeeds
  console.log('\n📝 Test 1: Fails twice, then succeeds');
  callCount = 0;

  const flakeyOperation = async () => {
    callCount++;
    if (callCount < 3) {
      const error: any = new Error('Rate limit exceeded');
      error.response = { status: 429 };
      throw error;
    }
    return { success: true, message: 'Operation completed!' };
  };

  const result1 = await strategy.executeWithRetry(flakeyOperation, 'Flakey API Call');
  console.log(`\n📊 Result: ${JSON.stringify(result1.data, null, 2)}`);

  // Test 2: Non-retryable error
  console.log('\n📝 Test 2: Non-retryable error (400 Bad Request)');

  const badRequestOperation = async () => {
    const error: any = new Error('Invalid parameters');
    error.response = { status: 400 };
    throw error;
  };

  const result2 = await strategy.executeWithRetry(badRequestOperation, 'Bad Request API Call');
  console.log(`\n📊 Result: Failed as expected with ${result2.errors.length} error(s)`);

  // Test 3: Max retries exceeded
  console.log('\n📝 Test 3: Always fails (max retries exceeded)');

  const alwaysFailsOperation = async () => {
    const error: any = new Error('Server error');
    error.response = { status: 500 };
    throw error;
  };

  const result3 = await strategy.executeWithRetry(alwaysFailsOperation, 'Always Failing API Call');
  console.log(`\n📊 Result: Failed after ${result3.attempts} attempts`);
}

// Test with real OpenAI API
export async function testRetryWithOpenAI() {
  console.log('\n' + '='.repeat(50));
  console.log('🧪 Testing Retry Strategy with OpenAI API');
  console.log('='.repeat(50));

  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ Skipping OpenAI test - no API key found');
    return;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const strategy = new RetryStrategy({
    maxRetries: 3,
    baseDelay: 2000,
    backoffMultiplier: 2,
  });

  // Test with a real API call
  const apiCall = async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "test successful" in 3 words exactly.' },
      ],
      max_tokens: 10,
    });

    return response.choices[0].message.content;
  };

  const result = await strategy.executeWithRetry(apiCall, 'OpenAI API Call');

  if (result.data) {
    console.log(`\n✅ OpenAI Response: "${result.data}"`);
    console.log(`Completed in ${result.attempts} attempt(s), ${result.totalTime}ms total`);
  } else {
    console.log(`\n❌ OpenAI test failed after ${result.attempts} attempts`);
  }
}

// Main execution
if (require.main === module) {
  async function main() {
    // Run simulated tests
    await testRetryWithSimulatedFailures();

    // Run real OpenAI test
    await testRetryWithOpenAI();

    console.log('\n' + '='.repeat(50));
    console.log('✅ All retry strategy tests completed');
    console.log('='.repeat(50));
  }

  main().catch(console.error);
}
