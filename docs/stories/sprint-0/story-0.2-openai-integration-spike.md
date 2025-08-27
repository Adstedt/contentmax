# Story 0.2: OpenAI Integration Technical Spike

## User Story
As a technical architect,
I want to validate OpenAI API integration patterns and costs,
So that we can design an efficient and cost-effective generation system.

## Size & Priority
- **Size**: S (3 hours)
- **Priority**: P0 - Critical
- **Sprint**: 0 (Validation Sprint)
- **Dependencies**: None

## Description
Test OpenAI API integration including rate limiting, retry strategies, cost calculations, and response quality for our use case.

## Technical Spike Goals

### Primary Questions to Answer
1. What's the real-world latency for our prompt sizes?
2. How effective is the retry strategy with exponential backoff?
3. What's the cost per typical content generation?
4. Can we handle rate limits gracefully?
5. Is streaming worth the complexity?

## Implementation Steps

1. **Create test environment**
   ```typescript
   // spike/openai-test.ts
   import OpenAI from 'openai';
   import dotenv from 'dotenv';
   
   dotenv.config();
   
   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY,
   });
   
   interface TestResult {
     promptTokens: number;
     completionTokens: number;
     totalCost: number;
     latency: number;
     retries: number;
     success: boolean;
     error?: string;
   }
   
   class OpenAITestHarness {
     private results: TestResult[] = [];
     
     async runLatencyTest(): Promise<void> {
       const testPrompts = [
         { size: 'small', tokens: 100 },
         { size: 'medium', tokens: 500 },
         { size: 'large', tokens: 2000 },
         { size: 'max', tokens: 4000 }
       ];
       
       for (const test of testPrompts) {
         const prompt = this.generateTestPrompt(test.tokens);
         const startTime = Date.now();
         
         try {
           const response = await openai.chat.completions.create({
             model: 'gpt-4o-mini',
             messages: [
               { role: 'system', content: 'You are a content generator.' },
               { role: 'user', content: prompt }
             ],
             temperature: 0.7,
             max_tokens: 1000,
           });
           
           const latency = Date.now() - startTime;
           
           this.results.push({
             promptTokens: response.usage?.prompt_tokens || 0,
             completionTokens: response.usage?.completion_tokens || 0,
             totalCost: this.calculateCost(response.usage),
             latency,
             retries: 0,
             success: true
           });
           
           console.log(`✅ ${test.size} prompt: ${latency}ms`);
           
         } catch (error) {
           console.error(`❌ ${test.size} prompt failed:`, error);
         }
       }
     }
     
     private calculateCost(usage: any): number {
       // GPT-4o-mini pricing
       const inputCost = 0.00015 / 1000; // per token
       const outputCost = 0.0006 / 1000; // per token
       
       return (usage.prompt_tokens * inputCost) + 
              (usage.completion_tokens * outputCost);
     }
     
     private generateTestPrompt(targetTokens: number): string {
       // Approximate 1 token = 4 characters
       const charCount = targetTokens * 4;
       return `Generate a product description for: ${' test'.repeat(charCount / 5)}`;
     }
   }
   ```

2. **Test retry logic**
   ```typescript
   // spike/retry-test.ts
   class RetryStrategy {
     private maxRetries = 3;
     private baseDelay = 1000;
     
     async executeWithRetry<T>(
       operation: () => Promise<T>,
       context: string
     ): Promise<T> {
       let lastError: Error | null = null;
       
       for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
         try {
           if (attempt > 0) {
             const delay = this.baseDelay * Math.pow(2, attempt - 1);
             console.log(`⏳ Retry ${attempt}/${this.maxRetries} after ${delay}ms`);
             await this.sleep(delay);
           }
           
           return await operation();
           
         } catch (error) {
           lastError = error as Error;
           
           if (this.isRetryable(error)) {
             console.log(`🔄 Retryable error: ${error.message}`);
             continue;
           } else {
             console.log(`❌ Non-retryable error: ${error.message}`);
             throw error;
           }
         }
       }
       
       throw lastError;
     }
     
     private isRetryable(error: any): boolean {
       // OpenAI specific error codes
       const retryableCodes = [429, 500, 502, 503, 504];
       return retryableCodes.includes(error?.response?.status);
     }
     
     private sleep(ms: number): Promise<void> {
       return new Promise(resolve => setTimeout(resolve, ms));
     }
   }
   
   // Test the retry strategy
   async function testRetryStrategy() {
     const strategy = new RetryStrategy();
     let callCount = 0;
     
     // Simulate API that fails twice then succeeds
     const flakeyOperation = async () => {
       callCount++;
       if (callCount < 3) {
         throw { response: { status: 429 }, message: 'Rate limited' };
       }
       return { success: true, attempts: callCount };
     };
     
     const result = await strategy.executeWithRetry(
       flakeyOperation,
       'test-operation'
     );
     
     console.log('Result:', result);
   }
   ```

3. **Rate limit testing**
   ```typescript
   // spike/rate-limit-test.ts
   class RateLimitManager {
     private queue: Array<() => Promise<any>> = [];
     private processing = false;
     private requestsPerMinute = 60;
     private minDelay = 60000 / this.requestsPerMinute;
     
     async addRequest<T>(request: () => Promise<T>): Promise<T> {
       return new Promise((resolve, reject) => {
         this.queue.push(async () => {
           try {
             const result = await request();
             resolve(result);
           } catch (error) {
             reject(error);
           }
         });
         
         if (!this.processing) {
           this.processQueue();
         }
       });
     }
     
     private async processQueue() {
       this.processing = true;
       
       while (this.queue.length > 0) {
         const request = this.queue.shift();
         if (request) {
           const startTime = Date.now();
           await request();
           
           const elapsed = Date.now() - startTime;
           if (elapsed < this.minDelay) {
             await this.sleep(this.minDelay - elapsed);
           }
         }
       }
       
       this.processing = false;
     }
     
     private sleep(ms: number): Promise<void> {
       return new Promise(resolve => setTimeout(resolve, ms));
     }
   }
   
   // Burst test
   async function testRateLimiting() {
     const manager = new RateLimitManager();
     const requests = Array.from({ length: 10 }, (_, i) => i);
     
     console.log('Starting burst test...');
     const startTime = Date.now();
     
     const results = await Promise.all(
       requests.map(i => 
         manager.addRequest(async () => {
           console.log(`Request ${i} executing at ${Date.now() - startTime}ms`);
           // Simulate API call
           return { id: i, timestamp: Date.now() };
         })
       )
     );
     
     console.log(`Completed in ${Date.now() - startTime}ms`);
   }
   ```

4. **Cost projection calculator**
   ```typescript
   // spike/cost-calculator.ts
   interface UsageProjection {
     dailyGenerations: number;
     avgPromptTokens: number;
     avgCompletionTokens: number;
     model: string;
   }
   
   function calculateMonthlyCost(projection: UsageProjection): {
     daily: number;
     monthly: number;
     annual: number;
     perGeneration: number;
   } {
     const pricing = {
       'gpt-4o-mini': {
         input: 0.00015 / 1000,
         output: 0.0006 / 1000
       },
       'gpt-4o': {
         input: 0.0025 / 1000,
         output: 0.01 / 1000
       }
     };
     
     const modelPricing = pricing[projection.model];
     
     const costPerGeneration = 
       (projection.avgPromptTokens * modelPricing.input) +
       (projection.avgCompletionTokens * modelPricing.output);
     
     const dailyCost = costPerGeneration * projection.dailyGenerations;
     
     return {
       daily: dailyCost,
       monthly: dailyCost * 30,
       annual: dailyCost * 365,
       perGeneration: costPerGeneration
     };
   }
   
   // Test scenarios
   const scenarios = [
     {
       name: 'Conservative',
       dailyGenerations: 100,
       avgPromptTokens: 500,
       avgCompletionTokens: 800,
       model: 'gpt-4o-mini'
     },
     {
       name: 'Moderate',
       dailyGenerations: 500,
       avgPromptTokens: 800,
       avgCompletionTokens: 1200,
       model: 'gpt-4o-mini'
     },
     {
       name: 'Aggressive',
       dailyGenerations: 2000,
       avgPromptTokens: 1000,
       avgCompletionTokens: 1500,
       model: 'gpt-4o'
     }
   ];
   
   scenarios.forEach(scenario => {
     const cost = calculateMonthlyCost(scenario);
     console.log(`\n${scenario.name} Scenario:`);
     console.log(`  Daily: $${cost.daily.toFixed(2)}`);
     console.log(`  Monthly: $${cost.monthly.toFixed(2)}`);
     console.log(`  Annual: $${cost.annual.toFixed(2)}`);
     console.log(`  Per Generation: $${cost.perGeneration.toFixed(4)}`);
   });
   ```

## Success Criteria

### Performance Benchmarks
- [ ] Average latency under 3 seconds for standard prompts
- [ ] Retry strategy handles 429 errors gracefully
- [ ] Rate limiting prevents API errors
- [ ] Cost per generation under $0.01

### Technical Validation
- [ ] Connection established successfully
- [ ] Error handling comprehensive
- [ ] Streaming API tested (if applicable)
- [ ] Token counting accurate

## Deliverables

1. **Integration Report**
   ```markdown
   ## OpenAI Integration Test Results
   
   ### Latency Results
   | Prompt Size | Tokens | Latency (avg) | Cost    |
   |-------------|--------|---------------|---------|
   | Small       | 100    | 1.2s          | $0.0002 |
   | Medium      | 500    | 2.1s          | $0.0008 |
   | Large       | 2000   | 3.8s          | $0.0030 |
   
   ### Cost Projections (Monthly)
   - Conservative: $45/month
   - Moderate: $225/month
   - Aggressive: $1,800/month
   
   ### Recommendations
   ✅ PROCEED with GPT-4o-mini for MVP
   - Implement caching layer
   - Add usage monitoring
   - Consider tiered pricing model
   ```

2. **Implementation Guidelines**
   - Optimal retry configuration
   - Rate limit settings
   - Error handling patterns
   - Cost optimization strategies

## Alternative Approaches (if spike fails)

1. **Alternative Models**
   - Claude API
   - Local LLMs (Llama)
   - Hybrid approach

2. **Cost Optimization**
   - Prompt compression
   - Response caching
   - Batch processing

## Definition of Done

- [ ] All test scenarios executed
- [ ] Cost projections calculated
- [ ] Performance metrics documented
- [ ] Go/No-Go decision made
- [ ] Implementation pattern selected