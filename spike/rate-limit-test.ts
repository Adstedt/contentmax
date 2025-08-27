import OpenAI from 'openai';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

interface RateLimitOptions {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  burstSize?: number;
}

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  addedAt: number;
  priority?: number;
}

export class RateLimitManager {
  private queue: QueuedRequest<any>[] = [];
  private processing = false;
  private requestsPerMinute: number;
  private requestsPerHour: number;
  private requestsPerDay: number;
  private burstSize: number;
  private minDelay: number;
  private recentRequests: number[] = [];
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    queuedRequests: 0,
    averageWaitTime: 0,
  };

  constructor(options: RateLimitOptions = {}) {
    this.requestsPerMinute = options.requestsPerMinute || 60;
    this.requestsPerHour = options.requestsPerHour || 3000;
    this.requestsPerDay = options.requestsPerDay || 50000;
    this.burstSize = options.burstSize || 10;
    this.minDelay = 60000 / this.requestsPerMinute;

    // Clean up old requests periodically
    setInterval(() => this.cleanupRecentRequests(), 60000);
  }

  async addRequest<T>(request: () => Promise<T>, priority: number = 0): Promise<T> {
    this.metrics.queuedRequests++;
    const addedAt = Date.now();

    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        execute: request,
        resolve,
        reject,
        addedAt,
        priority,
      };

      // Add to queue based on priority
      const insertIndex = this.findInsertIndex(priority);
      this.queue.splice(insertIndex, 0, queuedRequest);

      console.log(
        `📥 Request queued (priority: ${priority}, position: ${insertIndex + 1}/${this.queue.length})`
      );

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private findInsertIndex(priority: number): number {
    for (let i = 0; i < this.queue.length; i++) {
      if ((this.queue[i].priority || 0) < priority) {
        return i;
      }
    }
    return this.queue.length;
  }

  private async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const canProceed = await this.checkRateLimits();

      if (!canProceed) {
        const waitTime = this.calculateWaitTime();
        console.log(`⏳ Rate limit reached, waiting ${waitTime}ms...`);
        await this.sleep(waitTime);
        continue;
      }

      const request = this.queue.shift();
      if (request) {
        const waitTime = Date.now() - request.addedAt;
        this.metrics.averageWaitTime =
          (this.metrics.averageWaitTime * this.metrics.totalRequests + waitTime) /
          (this.metrics.totalRequests + 1);

        const startTime = Date.now();

        try {
          console.log(`🚀 Executing request (waited ${waitTime}ms)`);
          const result = await request.execute();

          this.recentRequests.push(Date.now());
          this.metrics.totalRequests++;
          this.metrics.successfulRequests++;

          request.resolve(result);

          const elapsed = Date.now() - startTime;

          // Ensure minimum delay between requests
          if (elapsed < this.minDelay && this.queue.length > 0) {
            await this.sleep(this.minDelay - elapsed);
          }
        } catch (error) {
          console.error(`❌ Request failed:`, error);
          this.metrics.failedRequests++;
          request.reject(error);
        }
      }
    }

    this.processing = false;
    console.log(`✅ Queue processing complete`);
  }

  private async checkRateLimits(): Promise<boolean> {
    const now = Date.now();

    // Check burst limit
    const recentBurst = this.recentRequests.filter((time) => now - time < 1000).length;

    if (recentBurst >= this.burstSize) {
      console.log(`🚫 Burst limit reached (${recentBurst}/${this.burstSize})`);
      return false;
    }

    // Check minute limit
    const lastMinute = this.recentRequests.filter((time) => now - time < 60000).length;

    if (lastMinute >= this.requestsPerMinute) {
      console.log(`🚫 Minute limit reached (${lastMinute}/${this.requestsPerMinute})`);
      return false;
    }

    // Check hour limit
    const lastHour = this.recentRequests.filter((time) => now - time < 3600000).length;

    if (lastHour >= this.requestsPerHour) {
      console.log(`🚫 Hour limit reached (${lastHour}/${this.requestsPerHour})`);
      return false;
    }

    return true;
  }

  private calculateWaitTime(): number {
    const now = Date.now();

    // Find the oldest request that would violate the rate limit
    const oldestRelevant = this.recentRequests.find((time) => now - time < 60000);

    if (oldestRelevant) {
      // Wait until the oldest request is outside the window
      return Math.max(this.minDelay, 60000 - (now - oldestRelevant) + 100);
    }

    return this.minDelay;
  }

  private cleanupRecentRequests() {
    const now = Date.now();
    // Keep only requests from the last day
    this.recentRequests = this.recentRequests.filter((time) => now - time < 86400000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getMetrics() {
    return {
      ...this.metrics,
      queueLength: this.queue.length,
      recentRequests: this.recentRequests.length,
    };
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

// Test functions
export async function testRateLimiting() {
  console.log('='.repeat(50));
  console.log('🧪 Testing Rate Limit Manager');
  console.log('='.repeat(50));

  const manager = new RateLimitManager({
    requestsPerMinute: 20, // Low limit for testing
    burstSize: 5,
  });

  // Test 1: Burst test
  console.log('\n📝 Test 1: Burst of 10 requests');
  const burstStartTime = Date.now();

  const burstRequests = Array.from({ length: 10 }, (_, i) => i);

  const burstResults = await Promise.all(
    burstRequests.map((i) =>
      manager.addRequest(async () => {
        const executionTime = Date.now() - burstStartTime;
        console.log(`  Request ${i} executed at ${executionTime}ms`);
        return { id: i, timestamp: Date.now() };
      })
    )
  );

  const burstTotalTime = Date.now() - burstStartTime;
  console.log(`\n📊 Burst test completed in ${burstTotalTime}ms`);
  console.log(`Average spacing: ${burstTotalTime / 10}ms`);

  // Test 2: Priority queue test
  console.log('\n📝 Test 2: Priority queue test');

  const priorityPromises = [
    manager.addRequest(async () => {
      console.log('  Low priority request executed');
      return 'low';
    }, 0),

    manager.addRequest(async () => {
      console.log('  High priority request executed');
      return 'high';
    }, 10),

    manager.addRequest(async () => {
      console.log('  Medium priority request executed');
      return 'medium';
    }, 5),
  ];

  const priorityResults = await Promise.all(priorityPromises);
  console.log(`\n📊 Priority test results: ${priorityResults}`);

  // Display metrics
  console.log('\n📊 Final Metrics:');
  const metrics = manager.getMetrics();
  console.log(`  Total requests: ${metrics.totalRequests}`);
  console.log(`  Successful: ${metrics.successfulRequests}`);
  console.log(`  Failed: ${metrics.failedRequests}`);
  console.log(`  Average wait time: ${metrics.averageWaitTime.toFixed(2)}ms`);
}

export async function testRateLimitWithOpenAI() {
  console.log('\n' + '='.repeat(50));
  console.log('🧪 Testing Rate Limiter with OpenAI API');
  console.log('='.repeat(50));

  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ Skipping OpenAI test - no API key found');
    return;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const manager = new RateLimitManager({
    requestsPerMinute: 30,
    burstSize: 5,
  });

  console.log('\n📝 Sending 5 OpenAI requests with rate limiting');

  const requests = Array.from({ length: 5 }, (_, i) =>
    manager.addRequest(async () => {
      const startTime = Date.now();

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: `Generate a 3-word product name #${i + 1}` },
        ],
        max_tokens: 10,
      });

      const latency = Date.now() - startTime;
      const content = response.choices[0].message.content;

      console.log(`  Request ${i + 1}: "${content}" (${latency}ms)`);

      return {
        id: i + 1,
        content,
        latency,
      };
    })
  );

  const results = await Promise.all(requests);

  console.log('\n📊 OpenAI Rate Limit Test Summary:');
  const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
  console.log(`  Average latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`  All requests completed successfully`);
}

// Main execution
if (require.main === module) {
  async function main() {
    // Run basic rate limiting test
    await testRateLimiting();

    // Wait a bit before OpenAI test
    console.log('\n⏳ Waiting 2 seconds before OpenAI test...\n');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Run OpenAI rate limiting test
    await testRateLimitWithOpenAI();

    console.log('\n' + '='.repeat(50));
    console.log('✅ All rate limiting tests completed');
    console.log('='.repeat(50));
  }

  main().catch(console.error);
}
