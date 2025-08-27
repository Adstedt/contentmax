# Story 4.3: OpenAI Integration with Retry Logic

## User Story
As a content generator,
I want reliable OpenAI API integration with resilience patterns,
So that content generation continues smoothly even during API issues.

## Size & Priority
- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 4
- **Dependencies**: Sprint 1 complete

## Prerequisites
- OpenAI account created and API key obtained (see docs/external-services-setup.md)
- Environment variable `OPENAI_API_KEY` configured

## Description
Implement OpenAI API integration with retry policies, circuit breaker pattern, fallback mechanisms, and prompt management system.

## Implementation Steps

1. **OpenAI client wrapper**
   ```typescript
   import OpenAI from 'openai';
   
   class OpenAIClient {
     private client: OpenAI;
     private circuitBreaker: CircuitBreaker;
     private retryPolicy: RetryPolicy;
     private costTracker: CostTracker;
     
     constructor(config: OpenAIConfig) {
       this.client = new OpenAI({
         apiKey: config.apiKey,
         maxRetries: 0, // We handle retries ourselves
         timeout: config.timeout || 30000
       });
       
       this.circuitBreaker = new CircuitBreaker({
         failureThreshold: 5,
         resetTimeout: 60000,
         monitoringPeriod: 120000
       });
       
       this.retryPolicy = new RetryPolicy({
         maxAttempts: 3,
         baseDelay: 1000,
         maxDelay: 10000,
         backoffMultiplier: 2
       });
       
       this.costTracker = new CostTracker();
     }
     
     async generateText(
       prompt: string,
       options: GenerationOptions = {}
     ): Promise<GenerationResult> {
       return this.circuitBreaker.execute(async () => {
         return this.retryPolicy.execute(async () => {
           const startTime = Date.now();
           
           try {
             const completion = await this.client.chat.completions.create({
               model: options.model || 'gpt-4-turbo-preview',
               messages: [
                 {
                   role: 'system',
                   content: options.systemPrompt || 'You are a helpful content generator.'
                 },
                 {
                   role: 'user',
                   content: prompt
                 }
               ],
               temperature: options.temperature || 0.7,
               max_tokens: options.maxTokens || 2000,
               top_p: options.topP || 1,
               frequency_penalty: options.frequencyPenalty || 0,
               presence_penalty: options.presencePenalty || 0
             });
             
             const response = completion.choices[0].message.content || '';
             const usage = completion.usage;
             
             // Track costs
             if (usage) {
               const cost = this.costTracker.calculateCost(
                 usage.prompt_tokens,
                 usage.completion_tokens,
                 options.model || 'gpt-4-turbo-preview'
               );
               
               await this.costTracker.recordUsage({
                 promptTokens: usage.prompt_tokens,
                 completionTokens: usage.completion_tokens,
                 totalTokens: usage.total_tokens,
                 cost,
                 model: options.model || 'gpt-4-turbo-preview',
                 timestamp: new Date()
               });
             }
             
             return {
               content: response,
               usage,
               latency: Date.now() - startTime,
               model: options.model || 'gpt-4-turbo-preview'
             };
           } catch (error) {
             // Handle specific OpenAI errors
             if (error instanceof OpenAI.APIError) {
               if (error.status === 429) {
                 // Rate limit - throw for retry
                 throw new RateLimitError('Rate limit exceeded', error);
               } else if (error.status === 500 || error.status === 503) {
                 // Server error - throw for retry
                 throw new ServiceError('OpenAI service error', error);
               }
             }
             throw error;
           }
         });
       });
     }
     
     async generateStructuredContent(
       prompt: string,
       schema: JSONSchema,
       options: GenerationOptions = {}
     ): Promise<any> {
       const structuredPrompt = `
         ${prompt}
         
         Please provide your response in valid JSON format matching this schema:
         ${JSON.stringify(schema, null, 2)}
       `;
       
       const result = await this.generateText(structuredPrompt, {
         ...options,
         model: options.model || 'gpt-4-turbo-preview' // Better for structured output
       });
       
       // Parse and validate JSON
       try {
         const parsed = JSON.parse(result.content);
         const validation = validateAgainstSchema(parsed, schema);
         
         if (!validation.valid) {
           // Retry with more specific prompt
           const retryPrompt = `
             ${prompt}
             
             Your previous response had validation errors:
             ${validation.errors.join('\n')}
             
             Please provide valid JSON matching the schema exactly.
           `;
           
           const retryResult = await this.generateText(retryPrompt, options);
           return JSON.parse(retryResult.content);
         }
         
         return parsed;
       } catch (parseError) {
         throw new Error(`Failed to parse structured content: ${parseError.message}`);
       }
     }
   }
   ```

2. **Retry policy implementation**
   ```typescript
   class RetryPolicy {
     constructor(private config: RetryConfig) {}
     
     async execute<T>(
       operation: () => Promise<T>,
       context?: RetryContext
     ): Promise<T> {
       let lastError: Error;
       let delay = this.config.baseDelay;
       
       for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
         try {
           return await operation();
         } catch (error) {
           lastError = error as Error;
           
           // Check if error is retryable
           if (!this.isRetryable(error)) {
             throw error;
           }
           
           // Check if we've exhausted retries
           if (attempt === this.config.maxAttempts) {
             throw new MaxRetriesError(
               `Failed after ${this.config.maxAttempts} attempts`,
               lastError
             );
           }
           
           // Wait before retry with exponential backoff
           await this.delay(delay);
           delay = Math.min(
             delay * this.config.backoffMultiplier,
             this.config.maxDelay
           );
           
           // Add jitter to prevent thundering herd
           delay += Math.random() * 1000;
           
           console.log(`Retry attempt ${attempt} after ${delay}ms delay`);
         }
       }
       
       throw lastError!;
     }
     
     private isRetryable(error: any): boolean {
       // Retry on rate limits
       if (error instanceof RateLimitError) return true;
       
       // Retry on service errors
       if (error instanceof ServiceError) return true;
       
       // Retry on network errors
       if (error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' ||
           error.code === 'ENOTFOUND') {
         return true;
       }
       
       // Don't retry on client errors
       if (error.status >= 400 && error.status < 500) {
         return false;
       }
       
       return false;
     }
     
     private delay(ms: number): Promise<void> {
       return new Promise(resolve => setTimeout(resolve, ms));
     }
   }
   
   interface RetryConfig {
     maxAttempts: number;
     baseDelay: number;
     maxDelay: number;
     backoffMultiplier: number;
     retryableErrors?: string[];
   }
   ```

3. **Circuit breaker pattern**
   ```typescript
   class CircuitBreaker {
     private state: 'closed' | 'open' | 'half-open' = 'closed';
     private failureCount = 0;
     private lastFailureTime?: Date;
     private successCount = 0;
     
     constructor(private config: CircuitBreakerConfig) {}
     
     async execute<T>(operation: () => Promise<T>): Promise<T> {
       // Check if circuit is open
       if (this.state === 'open') {
         if (this.shouldAttemptReset()) {
           this.state = 'half-open';
         } else {
           throw new CircuitOpenError('Circuit breaker is open');
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
       
       if (this.state === 'half-open') {
         this.successCount++;
         if (this.successCount >= this.config.successThreshold) {
           this.state = 'closed';
           this.successCount = 0;
         }
       }
     }
     
     private onFailure() {
       this.failureCount++;
       this.lastFailureTime = new Date();
       
       if (this.state === 'half-open') {
         this.state = 'open';
         this.successCount = 0;
       } else if (this.failureCount >= this.config.failureThreshold) {
         this.state = 'open';
       }
     }
     
     private shouldAttemptReset(): boolean {
       if (!this.lastFailureTime) return false;
       
       const timeSinceLastFailure = 
         Date.now() - this.lastFailureTime.getTime();
       
       return timeSinceLastFailure >= this.config.resetTimeout;
     }
     
     getState(): string {
       return this.state;
     }
     
     getMetrics(): CircuitBreakerMetrics {
       return {
         state: this.state,
         failureCount: this.failureCount,
         successCount: this.successCount,
         lastFailureTime: this.lastFailureTime
       };
     }
   }
   ```

4. **Prompt management system**
   ```typescript
   class PromptManager {
     private prompts = new Map<string, PromptTemplate>();
     private versions = new Map<string, PromptVersion[]>();
     
     async loadPrompts() {
       const prompts = await supabase
         .from('prompt_templates')
         .select('*')
         .eq('active', true);
       
       prompts.data?.forEach(prompt => {
         this.registerPrompt({
           id: prompt.id,
           name: prompt.name,
           template: prompt.template,
           variables: prompt.variables,
           systemPrompt: prompt.system_prompt,
           model: prompt.model,
           parameters: prompt.parameters
         });
       });
     }
     
     registerPrompt(template: PromptTemplate) {
       this.prompts.set(template.id, template);
       
       // Track version history
       if (!this.versions.has(template.id)) {
         this.versions.set(template.id, []);
       }
       
       this.versions.get(template.id)!.push({
         version: template.version || '1.0.0',
         template: template.template,
         timestamp: new Date()
       });
     }
     
     buildPrompt(
       templateId: string,
       variables: Record<string, any>
     ): string {
       const template = this.prompts.get(templateId);
       if (!template) {
         throw new Error(`Prompt template ${templateId} not found`);
       }
       
       let prompt = template.template;
       
       // Replace variables
       Object.entries(variables).forEach(([key, value]) => {
         const placeholder = new RegExp(`{{${key}}}`, 'g');
         prompt = prompt.replace(placeholder, String(value));
       });
       
       // Validate all required variables were provided
       const missingVars = this.findMissingVariables(prompt);
       if (missingVars.length > 0) {
         throw new Error(`Missing variables: ${missingVars.join(', ')}`);
       }
       
       return prompt;
     }
     
     private findMissingVariables(prompt: string): string[] {
       const regex = /{{(\w+)}}/g;
       const matches = [];
       let match;
       
       while ((match = regex.exec(prompt)) !== null) {
         matches.push(match[1]);
       }
       
       return matches;
     }
     
     async testPrompt(
       templateId: string,
       variables: Record<string, any>
     ): Promise<PromptTestResult> {
       const prompt = this.buildPrompt(templateId, variables);
       const template = this.prompts.get(templateId)!;
       
       // Test with smaller model for cost efficiency
       const result = await openAIClient.generateText(prompt, {
         model: 'gpt-3.5-turbo',
         maxTokens: 500,
         temperature: template.parameters?.temperature || 0.7
       });
       
       return {
         prompt,
         response: result.content,
         usage: result.usage,
         cost: result.usage ? 
           costTracker.calculateCost(
             result.usage.prompt_tokens,
             result.usage.completion_tokens,
             'gpt-3.5-turbo'
           ) : 0
       };
     }
   }
   ```

5. **Cost tracking and management**
   ```typescript
   class CostTracker {
     private pricing = {
       'gpt-4-turbo-preview': {
         prompt: 0.01,    // per 1k tokens
         completion: 0.03  // per 1k tokens
       },
       'gpt-4': {
         prompt: 0.03,
         completion: 0.06
       },
       'gpt-3.5-turbo': {
         prompt: 0.0005,
         completion: 0.0015
       }
     };
     
     calculateCost(
       promptTokens: number,
       completionTokens: number,
       model: string
     ): number {
       const modelPricing = this.pricing[model];
       if (!modelPricing) {
         console.warn(`Unknown model ${model}, using GPT-4 pricing`);
         return this.calculateCost(promptTokens, completionTokens, 'gpt-4');
       }
       
       const promptCost = (promptTokens / 1000) * modelPricing.prompt;
       const completionCost = (completionTokens / 1000) * modelPricing.completion;
       
       return Math.round((promptCost + completionCost) * 10000) / 10000;
     }
     
     async recordUsage(usage: UsageRecord) {
       await supabase.from('api_usage').insert({
         service: 'openai',
         model: usage.model,
         prompt_tokens: usage.promptTokens,
         completion_tokens: usage.completionTokens,
         total_tokens: usage.totalTokens,
         cost: usage.cost,
         timestamp: usage.timestamp
       });
     }
     
     async getDailyCost(date: Date): Promise<number> {
       const start = new Date(date);
       start.setHours(0, 0, 0, 0);
       
       const end = new Date(date);
       end.setHours(23, 59, 59, 999);
       
       const { data } = await supabase
         .from('api_usage')
         .select('cost')
         .gte('timestamp', start.toISOString())
         .lte('timestamp', end.toISOString());
       
       return data?.reduce((sum, record) => sum + record.cost, 0) || 0;
     }
   }
   ```

## Files to Create

- `lib/ai/openai-client.ts` - OpenAI API wrapper
- `lib/ai/retry-policy.ts` - Retry logic implementation
- `lib/ai/circuit-breaker.ts` - Circuit breaker pattern
- `lib/ai/prompt-manager.ts` - Prompt template management
- `lib/ai/cost-tracker.ts` - Usage and cost tracking
- `lib/ai/fallback-manager.ts` - Fallback to GPT-3.5
- `lib/ai/errors.ts` - Custom error classes
- `supabase/functions/generate-content/index.ts` - Edge function
- `types/openai.types.ts` - TypeScript interfaces

## Error Handling Strategy

```typescript
interface ErrorStrategy {
  rateLimitError: {
    action: 'retry',
    delay: 'exponential',
    maxRetries: 5,
    fallback: 'queue'
  };
  quotaExceeded: {
    action: 'fallback',
    fallbackModel: 'gpt-3.5-turbo',
    notification: 'alert-admin'
  };
  serviceError: {
    action: 'circuit-breaker',
    fallback: 'cached-response'
  };
  timeoutError: {
    action: 'retry',
    maxRetries: 2,
    increasedTimeout: true
  };
  validationError: {
    action: 'retry-with-correction',
    maxRetries: 1
  };
}
```

## Acceptance Criteria

- [ ] OpenAI client wrapper implemented
- [ ] Retry policy with exponential backoff
- [ ] Circuit breaker prevents cascade failures
- [ ] Prompt management system functional
- [ ] Cost tracking and reporting
- [ ] Fallback to GPT-3.5 when needed
- [ ] Error handling comprehensive
- [ ] Structured content generation working

## Cost Management

- Track daily/monthly spending
- Alert when approaching limits
- Automatic model downgrade when over budget
- Cost estimation before generation
- Per-project cost allocation

## Testing Requirements

- [ ] Test retry logic with mocked failures
- [ ] Test circuit breaker state transitions
- [ ] Test prompt template substitution
- [ ] Test cost calculations
- [ ] Test fallback mechanisms
- [ ] Test timeout handling
- [ ] Test concurrent requests
- [ ] Integration tests with OpenAI

## Definition of Done

- [ ] Code complete and committed
- [ ] OpenAI integration working
- [ ] Resilience patterns implemented
- [ ] Prompt management functional
- [ ] Cost tracking active
- [ ] Error handling robust
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed