# Story 5.6: Advanced OpenAI Features

## User Story
As a power user,
I want robust AI generation with retry logic and optimizations,
So that I can reliably generate content at scale without failures.

## Size & Priority
- **Size**: M (4 hours) - Split from original Story 4.3
- **Priority**: P1 - High
- **Sprint**: 5 (Adjusted)
- **Dependencies**: Story 4.3a (Basic OpenAI Integration)

## Description
Add advanced OpenAI features including retry logic with exponential backoff, circuit breaker pattern, streaming responses, prompt optimization, and caching. This completes the OpenAI functionality started in Story 4.3a.

## Implementation Steps

1. **Retry policy with exponential backoff**
   ```typescript
   // lib/openai/retry-policy.ts
   export interface RetryConfig {
     maxRetries: number;
     baseDelayMs: number;
     maxDelayMs: number;
     backoffMultiplier: number;
     retryableErrors: Set<string>;
     onRetry?: (attempt: number, error: Error) => void;
   }
   
   export class RetryPolicy {
     private config: RetryConfig;
     
     constructor(config: Partial<RetryConfig> = {}) {
       this.config = {
         maxRetries: config.maxRetries || 3,
         baseDelayMs: config.baseDelayMs || 1000,
         maxDelayMs: config.maxDelayMs || 30000,
         backoffMultiplier: config.backoffMultiplier || 2,
         retryableErrors: config.retryableErrors || new Set([
           'RATE_LIMIT',
           'TIMEOUT',
           'SERVICE_UNAVAILABLE',
           'INTERNAL_ERROR',
         ]),
         onRetry: config.onRetry,
       };
     }
     
     async execute<T>(
       operation: () => Promise<T>,
       context?: string
     ): Promise<T> {
       let lastError: Error | null = null;
       
       for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
         try {
           if (attempt > 0) {
             const delay = this.calculateDelay(attempt);
             this.config.onRetry?.(attempt, lastError!);
             
             console.log(
               `[RetryPolicy] Attempt ${attempt}/${this.config.maxRetries} ` +
               `for ${context || 'operation'} after ${delay}ms delay`
             );
             
             await this.sleep(delay);
           }
           
           return await operation();
           
         } catch (error) {
           lastError = error as Error;
           
           if (!this.isRetryable(error)) {
             console.error(
               `[RetryPolicy] Non-retryable error for ${context || 'operation'}:`,
               error
             );
             throw error;
           }
           
           if (attempt === this.config.maxRetries) {
             console.error(
               `[RetryPolicy] Max retries exceeded for ${context || 'operation'}`
             );
             throw new Error(
               `Failed after ${this.config.maxRetries} retries: ${lastError.message}`
             );
           }
         }
       }
       
       throw lastError!;
     }
     
     private calculateDelay(attempt: number): number {
       const exponentialDelay = 
         this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
       
       // Add jitter (±25%)
       const jitter = exponentialDelay * (0.75 + Math.random() * 0.5);
       
       return Math.min(jitter, this.config.maxDelayMs);
     }
     
     private isRetryable(error: any): boolean {
       // Check OpenAI specific error codes
       if (error.response?.status) {
         const retryableStatuses = [429, 500, 502, 503, 504];
         return retryableStatuses.includes(error.response.status);
       }
       
       // Check error type
       if (error.code) {
         return this.config.retryableErrors.has(error.code);
       }
       
       // Check error message patterns
       const retryablePatterns = [
         /rate limit/i,
         /timeout/i,
         /unavailable/i,
         /overloaded/i,
       ];
       
       return retryablePatterns.some(pattern => 
         pattern.test(error.message || '')
       );
     }
     
     private sleep(ms: number): Promise<void> {
       return new Promise(resolve => setTimeout(resolve, ms));
     }
   }
   ```

2. **Circuit breaker pattern**
   ```typescript
   // lib/openai/circuit-breaker.ts
   export enum CircuitState {
     CLOSED = 'CLOSED',
     OPEN = 'OPEN',
     HALF_OPEN = 'HALF_OPEN',
   }
   
   export interface CircuitBreakerConfig {
     failureThreshold: number;
     resetTimeoutMs: number;
     monitoringPeriodMs: number;
     halfOpenRequests: number;
     onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
   }
   
   export class CircuitBreaker {
     private state: CircuitState = CircuitState.CLOSED;
     private failureCount = 0;
     private successCount = 0;
     private lastFailureTime = 0;
     private halfOpenAttempts = 0;
     private config: CircuitBreakerConfig;
     
     constructor(config: Partial<CircuitBreakerConfig> = {}) {
       this.config = {
         failureThreshold: config.failureThreshold || 5,
         resetTimeoutMs: config.resetTimeoutMs || 60000, // 1 minute
         monitoringPeriodMs: config.monitoringPeriodMs || 60000,
         halfOpenRequests: config.halfOpenRequests || 3,
         onStateChange: config.onStateChange,
       };
     }
     
     async execute<T>(operation: () => Promise<T>): Promise<T> {
       // Check if circuit should be reset
       this.checkReset();
       
       if (this.state === CircuitState.OPEN) {
         throw new Error('Circuit breaker is OPEN - service unavailable');
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
       this.successCount++;
       
       if (this.state === CircuitState.HALF_OPEN) {
         this.halfOpenAttempts++;
         
         if (this.halfOpenAttempts >= this.config.halfOpenRequests) {
           // Enough successful requests, close the circuit
           this.changeState(CircuitState.CLOSED);
           this.reset();
         }
       } else if (this.state === CircuitState.CLOSED) {
         // Reset failure count on success in closed state
         this.failureCount = 0;
       }
     }
     
     private onFailure() {
       this.failureCount++;
       this.lastFailureTime = Date.now();
       
       if (this.state === CircuitState.HALF_OPEN) {
         // Failure in half-open state, immediately open
         this.changeState(CircuitState.OPEN);
         
       } else if (
         this.state === CircuitState.CLOSED &&
         this.failureCount >= this.config.failureThreshold
       ) {
         // Too many failures, open the circuit
         this.changeState(CircuitState.OPEN);
       }
     }
     
     private checkReset() {
       if (this.state === CircuitState.OPEN) {
         const timeSinceLastFailure = Date.now() - this.lastFailureTime;
         
         if (timeSinceLastFailure >= this.config.resetTimeoutMs) {
           // Enough time has passed, try half-open
           this.changeState(CircuitState.HALF_OPEN);
           this.halfOpenAttempts = 0;
         }
       }
     }
     
     private changeState(newState: CircuitState) {
       if (this.state !== newState) {
         const oldState = this.state;
         this.state = newState;
         
         console.log(
           `[CircuitBreaker] State changed: ${oldState} -> ${newState}`
         );
         
         this.config.onStateChange?.(oldState, newState);
       }
     }
     
     private reset() {
       this.failureCount = 0;
       this.successCount = 0;
       this.halfOpenAttempts = 0;
     }
     
     getState(): CircuitState {
       return this.state;
     }
     
     getStats() {
       return {
         state: this.state,
         failures: this.failureCount,
         successes: this.successCount,
         lastFailure: this.lastFailureTime 
           ? new Date(this.lastFailureTime).toISOString()
           : null,
       };
     }
   }
   ```

3. **Advanced OpenAI service with streaming**
   ```typescript
   // lib/openai/advanced-openai-service.ts
   import { OpenAIService } from './openai-service';
   import { RetryPolicy } from './retry-policy';
   import { CircuitBreaker } from './circuit-breaker';
   import { LRUCache } from 'lru-cache';
   
   export class AdvancedOpenAIService extends OpenAIService {
     private retryPolicy: RetryPolicy;
     private circuitBreaker: CircuitBreaker;
     private cache: LRUCache<string, any>;
     private metrics: {
       totalRequests: number;
       cachedRequests: number;
       failedRequests: number;
       totalCost: number;
       totalTokens: number;
     };
     
     constructor(config: any = {}) {
       super(config);
       
       this.retryPolicy = new RetryPolicy({
         maxRetries: 3,
         baseDelayMs: 1000,
         onRetry: (attempt, error) => {
           console.log(`Retry attempt ${attempt} due to:`, error.message);
         },
       });
       
       this.circuitBreaker = new CircuitBreaker({
         failureThreshold: 5,
         resetTimeoutMs: 60000,
         onStateChange: (oldState, newState) => {
           console.log(`Circuit state changed: ${oldState} -> ${newState}`);
         },
       });
       
       this.cache = new LRUCache<string, any>({
         max: 100,
         ttl: 1000 * 60 * 60, // 1 hour
       });
       
       this.metrics = {
         totalRequests: 0,
         cachedRequests: 0,
         failedRequests: 0,
         totalCost: 0,
         totalTokens: 0,
       };
     }
     
     async generateContent(request: any): Promise<any> {
       this.metrics.totalRequests++;
       
       // Check cache
       const cacheKey = this.getCacheKey(request);
       const cached = this.cache.get(cacheKey);
       
       if (cached) {
         this.metrics.cachedRequests++;
         console.log('[Cache] Hit for request');
         return { ...cached, fromCache: true };
       }
       
       try {
         // Execute with circuit breaker and retry policy
         const response = await this.circuitBreaker.execute(() =>
           this.retryPolicy.execute(
             () => super.generateContent(request),
             'OpenAI generation'
           )
         );
         
         // Update metrics
         this.metrics.totalCost += response.cost;
         this.metrics.totalTokens += response.usage.totalTokens;
         
         // Cache successful response
         this.cache.set(cacheKey, response);
         
         return response;
         
       } catch (error) {
         this.metrics.failedRequests++;
         throw error;
       }
     }
     
     async *generateStream(request: any): AsyncGenerator<string, void, unknown> {
       const stream = await this.client.chat.completions.create({
         model: request.model || this.config.model,
         messages: [
           { role: 'system', content: request.systemPrompt || '' },
           { role: 'user', content: request.prompt },
         ],
         temperature: request.temperature ?? this.config.temperature,
         max_tokens: request.maxTokens ?? this.config.maxTokens,
         stream: true,
       });
       
       let fullContent = '';
       
       for await (const chunk of stream) {
         const content = chunk.choices[0]?.delta?.content || '';
         fullContent += content;
         yield content;
       }
       
       // Cache the complete response
       const cacheKey = this.getCacheKey(request);
       this.cache.set(cacheKey, { content: fullContent });
     }
     
     private getCacheKey(request: any): string {
       // Create deterministic cache key from request
       const key = JSON.stringify({
         prompt: request.prompt,
         systemPrompt: request.systemPrompt,
         model: request.model || this.config.model,
         temperature: request.temperature ?? this.config.temperature,
       });
       
       // Simple hash function
       let hash = 0;
       for (let i = 0; i < key.length; i++) {
         const char = key.charCodeAt(i);
         hash = ((hash << 5) - hash) + char;
         hash = hash & hash;
       }
       
       return `openai_${hash}`;
     }
     
     optimizePrompt(prompt: string): string {
       // Remove unnecessary whitespace
       let optimized = prompt.replace(/\s+/g, ' ').trim();
       
       // Remove redundant instructions
       const redundantPatterns = [
         /please\s+/gi,
         /could you\s+/gi,
         /would you\s+/gi,
         /can you\s+/gi,
       ];
       
       for (const pattern of redundantPatterns) {
         optimized = optimized.replace(pattern, '');
       }
       
       return optimized;
     }
     
     async estimateCost(request: any): Promise<number> {
       // Estimate token count (rough approximation)
       const promptTokens = Math.ceil(request.prompt.length / 4);
       const systemTokens = request.systemPrompt 
         ? Math.ceil(request.systemPrompt.length / 4)
         : 0;
       
       const inputTokens = promptTokens + systemTokens;
       const outputTokens = request.maxTokens || this.config.maxTokens;
       
       return this.calculateCost(
         { prompt_tokens: inputTokens, completion_tokens: outputTokens },
         request.model || this.config.model
       );
     }
     
     getMetrics() {
       return {
         ...this.metrics,
         cacheHitRate: this.metrics.cachedRequests / this.metrics.totalRequests,
         failureRate: this.metrics.failedRequests / this.metrics.totalRequests,
         averageCost: this.metrics.totalCost / 
           (this.metrics.totalRequests - this.metrics.cachedRequests),
         circuitBreakerState: this.circuitBreaker.getState(),
         circuitBreakerStats: this.circuitBreaker.getStats(),
       };
     }
     
     clearCache() {
       this.cache.clear();
       console.log('[Cache] Cleared');
     }
     
     resetCircuitBreaker() {
       this.circuitBreaker = new CircuitBreaker({
         failureThreshold: 5,
         resetTimeoutMs: 60000,
       });
       console.log('[CircuitBreaker] Reset');
     }
   }
   ```

4. **Streaming generation UI**
   ```typescript
   // components/generation/StreamingGenerator.tsx
   import { useState, useRef } from 'react';
   
   export function StreamingGenerator() {
     const [prompt, setPrompt] = useState('');
     const [streaming, setStreaming] = useState(false);
     const [content, setContent] = useState('');
     const [metrics, setMetrics] = useState(null);
     const abortController = useRef<AbortController | null>(null);
     
     const handleStreamGenerate = async () => {
       setStreaming(true);
       setContent('');
       abortController.current = new AbortController();
       
       try {
         const response = await fetch('/api/generate/stream', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ prompt }),
           signal: abortController.current.signal,
         });
         
         if (!response.ok) throw new Error('Stream failed');
         
         const reader = response.body?.getReader();
         const decoder = new TextDecoder();
         
         if (!reader) throw new Error('No reader available');
         
         while (true) {
           const { done, value } = await reader.read();
           
           if (done) break;
           
           const chunk = decoder.decode(value, { stream: true });
           setContent(prev => prev + chunk);
         }
         
       } catch (error) {
         if (error.name !== 'AbortError') {
           console.error('Streaming error:', error);
         }
       } finally {
         setStreaming(false);
         abortController.current = null;
         fetchMetrics();
       }
     };
     
     const handleStop = () => {
       if (abortController.current) {
         abortController.current.abort();
       }
     };
     
     const fetchMetrics = async () => {
       try {
         const response = await fetch('/api/generate/metrics');
         const data = await response.json();
         setMetrics(data);
       } catch (error) {
         console.error('Failed to fetch metrics:', error);
       }
     };
     
     return (
       <div className="space-y-4">
         <div>
           <label className="block text-sm font-medium mb-1">
             Prompt
           </label>
           <textarea
             value={prompt}
             onChange={(e) => setPrompt(e.target.value)}
             className="w-full px-3 py-2 border rounded-md"
             rows={4}
             placeholder="Enter your prompt..."
             disabled={streaming}
           />
         </div>
         
         <div className="flex space-x-2">
           <button
             onClick={handleStreamGenerate}
             disabled={streaming || !prompt}
             className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
           >
             {streaming ? 'Generating...' : 'Generate (Stream)'}
           </button>
           
           {streaming && (
             <button
               onClick={handleStop}
               className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
             >
               Stop
             </button>
           )}
         </div>
         
         {content && (
           <div className="p-4 bg-gray-50 rounded-md">
             <h3 className="font-semibold mb-2">Generated Content</h3>
             <div className="whitespace-pre-wrap">{content}</div>
           </div>
         )}
         
         {metrics && (
           <div className="p-4 bg-blue-50 rounded-md">
             <h3 className="font-semibold mb-2">Service Metrics</h3>
             <div className="grid grid-cols-2 gap-2 text-sm">
               <div>Total Requests: {metrics.totalRequests}</div>
               <div>Cache Hit Rate: {(metrics.cacheHitRate * 100).toFixed(1)}%</div>
               <div>Total Cost: ${metrics.totalCost.toFixed(2)}</div>
               <div>Circuit State: {metrics.circuitBreakerState}</div>
             </div>
           </div>
         )}
       </div>
     );
   }
   ```

## Files to Create

- `lib/openai/retry-policy.ts` - Retry logic implementation
- `lib/openai/circuit-breaker.ts` - Circuit breaker pattern
- `lib/openai/advanced-openai-service.ts` - Advanced features
- `lib/openai/prompt-optimizer.ts` - Prompt optimization
- `components/generation/StreamingGenerator.tsx` - Streaming UI
- `app/api/generate/stream/route.ts` - Streaming endpoint
- `app/api/generate/metrics/route.ts` - Metrics endpoint

## Acceptance Criteria

- [ ] Retry logic with exponential backoff working
- [ ] Circuit breaker prevents cascade failures
- [ ] Streaming responses functional
- [ ] Response caching reduces costs
- [ ] Prompt optimization reduces token usage
- [ ] Metrics tracking accurate
- [ ] Can handle rate limits gracefully
- [ ] Service recovers from failures automatically

## Testing Requirements

- [ ] Test retry logic with simulated failures
- [ ] Test circuit breaker state transitions
- [ ] Test streaming with large responses
- [ ] Test cache hit/miss scenarios
- [ ] Test prompt optimization
- [ ] Load test with 100+ concurrent requests
- [ ] Test recovery from service outages
- [ ] Verify metrics accuracy

## Definition of Done

- [ ] All advanced features implemented
- [ ] Retry and circuit breaker tested
- [ ] Streaming working smoothly
- [ ] Caching reduces API calls by 30%+
- [ ] Metrics dashboard functional
- [ ] Error recovery automatic
- [ ] Performance targets met
- [ ] Documentation complete