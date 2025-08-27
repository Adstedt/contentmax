# Story 4.3a: Basic OpenAI Integration

## User Story
As a user,
I want to generate content using OpenAI's API,
So that I can create high-quality content automatically.

## Size & Priority
- **Size**: M (4 hours) - Reduced from L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 4 (Adjusted)
- **Dependencies**: Story 0.2 (OpenAI Spike), Story 4.2 (Templates)

## Description
Implement basic OpenAI integration with simple generation capabilities. Advanced features like retry logic, circuit breakers, and streaming will be handled in Story 5.6 (Sprint 5).

## Implementation Steps

1. **Basic OpenAI service**
   ```typescript
   // lib/openai/openai-service.ts
   import OpenAI from 'openai';
   import { z } from 'zod';
   
   // Configuration schema
   const OpenAIConfigSchema = z.object({
     apiKey: z.string(),
     model: z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']),
     temperature: z.number().min(0).max(2).default(0.7),
     maxTokens: z.number().min(1).max(4096).default(1000),
   });
   
   export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;
   
   export interface GenerationRequest {
     prompt: string;
     systemPrompt?: string;
     temperature?: number;
     maxTokens?: number;
     model?: string;
   }
   
   export interface GenerationResponse {
     content: string;
     usage: {
       promptTokens: number;
       completionTokens: number;
       totalTokens: number;
     };
     cost: number;
     model: string;
     finishReason: string;
   }
   
   export class OpenAIService {
     private client: OpenAI;
     private config: OpenAIConfig;
     
     constructor(config: Partial<OpenAIConfig> = {}) {
       this.config = OpenAIConfigSchema.parse({
         apiKey: process.env.OPENAI_API_KEY,
         ...config,
       });
       
       this.client = new OpenAI({
         apiKey: this.config.apiKey,
       });
     }
     
     async generateContent(request: GenerationRequest): Promise<GenerationResponse> {
       try {
         const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
         
         // Add system prompt if provided
         if (request.systemPrompt) {
           messages.push({
             role: 'system',
             content: request.systemPrompt,
           });
         }
         
         // Add user prompt
         messages.push({
           role: 'user',
           content: request.prompt,
         });
         
         // Make API call
         const completion = await this.client.chat.completions.create({
           model: request.model || this.config.model,
           messages,
           temperature: request.temperature ?? this.config.temperature,
           max_tokens: request.maxTokens ?? this.config.maxTokens,
         });
         
         const response = completion.choices[0];
         const usage = completion.usage;
         
         if (!response || !usage) {
           throw new Error('Invalid response from OpenAI');
         }
         
         return {
           content: response.message?.content || '',
           usage: {
             promptTokens: usage.prompt_tokens,
             completionTokens: usage.completion_tokens,
             totalTokens: usage.total_tokens,
           },
           cost: this.calculateCost(usage, request.model || this.config.model),
           model: completion.model,
           finishReason: response.finish_reason || 'unknown',
         };
         
       } catch (error) {
         console.error('OpenAI generation error:', error);
         throw this.handleError(error);
       }
     }
     
     async generateBatch(
       requests: GenerationRequest[]
     ): Promise<GenerationResponse[]> {
       // Simple sequential processing for now
       const results: GenerationResponse[] = [];
       
       for (const request of requests) {
         try {
           const response = await this.generateContent(request);
           results.push(response);
           
           // Basic rate limiting - 1 second between requests
           await this.sleep(1000);
           
         } catch (error) {
           console.error('Batch generation error:', error);
           // Continue with next request even if one fails
           results.push({
             content: '',
             usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
             cost: 0,
             model: this.config.model,
             finishReason: 'error',
           });
         }
       }
       
       return results;
     }
     
     private calculateCost(
       usage: OpenAI.CompletionUsage,
       model: string
     ): number {
       const pricing = {
         'gpt-4o-mini': {
           input: 0.00015 / 1000,
           output: 0.0006 / 1000,
         },
         'gpt-4o': {
           input: 0.0025 / 1000,
           output: 0.01 / 1000,
         },
         'gpt-3.5-turbo': {
           input: 0.0005 / 1000,
           output: 0.0015 / 1000,
         },
       };
       
       const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
       
       return (
         usage.prompt_tokens * modelPricing.input +
         usage.completion_tokens * modelPricing.output
       );
     }
     
     private handleError(error: any): Error {
       if (error.response) {
         const status = error.response.status;
         const message = error.response.data?.error?.message || error.message;
         
         switch (status) {
           case 401:
             return new Error('Invalid API key');
           case 429:
             return new Error('Rate limit exceeded. Please try again later.');
           case 500:
           case 502:
           case 503:
             return new Error('OpenAI service temporarily unavailable');
           default:
             return new Error(`OpenAI API error: ${message}`);
         }
       }
       
       return new Error(`OpenAI service error: ${error.message}`);
     }
     
     private sleep(ms: number): Promise<void> {
       return new Promise(resolve => setTimeout(resolve, ms));
     }
     
     async validateAPIKey(): Promise<boolean> {
       try {
         const response = await this.client.models.list();
         return response.data.length > 0;
       } catch (error) {
         return false;
       }
     }
     
     async getAvailableModels(): Promise<string[]> {
       try {
         const response = await this.client.models.list();
         return response.data
           .filter(model => model.id.startsWith('gpt'))
           .map(model => model.id);
       } catch (error) {
         console.error('Failed to fetch models:', error);
         return ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
       }
     }
   }
   ```

2. **Content generation pipeline**
   ```typescript
   // lib/generation/basic-pipeline.ts
   import { OpenAIService, GenerationRequest } from '@/lib/openai/openai-service';
   import { Template } from '@/lib/templates/template-engine';
   
   export interface ContentGenerationJob {
     id: string;
     templateId: string;
     context: Record<string, any>;
     status: 'pending' | 'processing' | 'completed' | 'failed';
     result?: {
       content: string;
       cost: number;
       tokens: number;
     };
     error?: string;
     createdAt: Date;
     completedAt?: Date;
   }
   
   export class BasicGenerationPipeline {
     private openai: OpenAIService;
     private jobs: Map<string, ContentGenerationJob> = new Map();
     
     constructor() {
       this.openai = new OpenAIService();
     }
     
     async generateFromTemplate(
       template: Template,
       context: Record<string, any>
     ): Promise<ContentGenerationJob> {
       const jobId = crypto.randomUUID();
       
       const job: ContentGenerationJob = {
         id: jobId,
         templateId: template.id,
         context,
         status: 'pending',
         createdAt: new Date(),
       };
       
       this.jobs.set(jobId, job);
       
       // Process asynchronously
       this.processJob(job, template);
       
       return job;
     }
     
     private async processJob(job: ContentGenerationJob, template: Template) {
       try {
         // Update status
         job.status = 'processing';
         this.jobs.set(job.id, job);
         
         // Compile template with context
         const compiledPrompt = this.compileTemplate(template.prompt, job.context);
         const systemPrompt = template.systemPrompt 
           ? this.compileTemplate(template.systemPrompt, job.context)
           : undefined;
         
         // Generate content
         const response = await this.openai.generateContent({
           prompt: compiledPrompt,
           systemPrompt,
           temperature: template.temperature,
           maxTokens: template.maxTokens,
           model: template.model,
         });
         
         // Update job with results
         job.status = 'completed';
         job.result = {
           content: response.content,
           cost: response.cost,
           tokens: response.usage.totalTokens,
         };
         job.completedAt = new Date();
         
       } catch (error) {
         job.status = 'failed';
         job.error = error.message;
         job.completedAt = new Date();
         console.error(`Job ${job.id} failed:`, error);
       }
       
       this.jobs.set(job.id, job);
     }
     
     private compileTemplate(
       template: string,
       context: Record<string, any>
     ): string {
       // Simple template variable replacement
       let compiled = template;
       
       for (const [key, value] of Object.entries(context)) {
         const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
         compiled = compiled.replace(regex, String(value));
       }
       
       return compiled;
     }
     
     getJob(jobId: string): ContentGenerationJob | undefined {
       return this.jobs.get(jobId);
     }
     
     getAllJobs(): ContentGenerationJob[] {
       return Array.from(this.jobs.values());
     }
     
     async waitForJob(jobId: string, timeoutMs = 30000): Promise<ContentGenerationJob> {
       const startTime = Date.now();
       
       while (Date.now() - startTime < timeoutMs) {
         const job = this.jobs.get(jobId);
         
         if (!job) {
           throw new Error(`Job ${jobId} not found`);
         }
         
         if (job.status === 'completed' || job.status === 'failed') {
           return job;
         }
         
         await this.sleep(100);
       }
       
       throw new Error(`Job ${jobId} timed out`);
     }
     
     private sleep(ms: number): Promise<void> {
       return new Promise(resolve => setTimeout(resolve, ms));
     }
     
     getCostSummary(): {
       totalJobs: number;
       completedJobs: number;
       totalCost: number;
       totalTokens: number;
     } {
       const jobs = Array.from(this.jobs.values());
       const completed = jobs.filter(j => j.status === 'completed');
       
       return {
         totalJobs: jobs.length,
         completedJobs: completed.length,
         totalCost: completed.reduce((sum, j) => sum + (j.result?.cost || 0), 0),
         totalTokens: completed.reduce((sum, j) => sum + (j.result?.tokens || 0), 0),
       };
     }
   }
   ```

3. **API endpoint for generation**
   ```typescript
   // app/api/generate/route.ts
   import { NextRequest, NextResponse } from 'next/server';
   import { getServerSession } from 'next-auth';
   import { BasicGenerationPipeline } from '@/lib/generation/basic-pipeline';
   import { supabase } from '@/lib/supabase/server';
   
   const pipeline = new BasicGenerationPipeline();
   
   export async function POST(request: NextRequest) {
     const session = await getServerSession();
     
     if (!session) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }
     
     try {
       const { templateId, context } = await request.json();
       
       if (!templateId || !context) {
         return NextResponse.json(
           { error: 'Template ID and context required' },
           { status: 400 }
         );
       }
       
       // Fetch template from database
       const { data: template, error } = await supabase
         .from('templates')
         .select('*')
         .eq('id', templateId)
         .single();
       
       if (error || !template) {
         return NextResponse.json(
           { error: 'Template not found' },
           { status: 404 }
         );
       }
       
       // Generate content
       const job = await pipeline.generateFromTemplate(template, context);
       
       // Wait for completion (with timeout)
       const completedJob = await pipeline.waitForJob(job.id, 30000);
       
       if (completedJob.status === 'failed') {
         return NextResponse.json(
           { error: completedJob.error },
           { status: 500 }
         );
       }
       
       // Save to database
       const { data: savedContent } = await supabase
         .from('generated_content')
         .insert({
           user_id: session.user.id,
           template_id: templateId,
           content: completedJob.result?.content,
           context,
           cost: completedJob.result?.cost,
           tokens: completedJob.result?.tokens,
           status: 'draft',
         })
         .select()
         .single();
       
       return NextResponse.json({
         success: true,
         content: completedJob.result?.content,
         cost: completedJob.result?.cost,
         tokens: completedJob.result?.tokens,
         id: savedContent?.id,
       });
       
     } catch (error) {
       console.error('Generation error:', error);
       return NextResponse.json(
         { error: 'Generation failed', details: error.message },
         { status: 500 }
       );
     }
   }
   
   export async function GET(request: NextRequest) {
     const session = await getServerSession();
     
     if (!session) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }
     
     // Return cost summary
     const summary = pipeline.getCostSummary();
     
     return NextResponse.json({
       summary,
       jobs: pipeline.getAllJobs(),
     });
   }
   ```

4. **Simple generation UI**
   ```typescript
   // components/generation/SimpleGenerator.tsx
   import { useState } from 'react';
   
   export function SimpleGenerator() {
     const [templateId, setTemplateId] = useState('');
     const [context, setContext] = useState('{}');
     const [generating, setGenerating] = useState(false);
     const [result, setResult] = useState(null);
     const [error, setError] = useState('');
     
     const handleGenerate = async () => {
       setGenerating(true);
       setError('');
       setResult(null);
       
       try {
         const contextObj = JSON.parse(context);
         
         const response = await fetch('/api/generate', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             templateId,
             context: contextObj,
           }),
         });
         
         const data = await response.json();
         
         if (!response.ok) {
           throw new Error(data.error || 'Generation failed');
         }
         
         setResult(data);
         
       } catch (err) {
         setError(err.message);
       } finally {
         setGenerating(false);
       }
     };
     
     return (
       <div className="space-y-4">
         <div>
           <label className="block text-sm font-medium mb-1">
             Template ID
           </label>
           <input
             type="text"
             value={templateId}
             onChange={(e) => setTemplateId(e.target.value)}
             className="w-full px-3 py-2 border rounded-md"
             placeholder="Enter template ID"
           />
         </div>
         
         <div>
           <label className="block text-sm font-medium mb-1">
             Context (JSON)
           </label>
           <textarea
             value={context}
             onChange={(e) => setContext(e.target.value)}
             className="w-full px-3 py-2 border rounded-md font-mono text-sm"
             rows={5}
             placeholder='{"productName": "Example Product"}'
           />
         </div>
         
         <button
           onClick={handleGenerate}
           disabled={generating || !templateId}
           className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
         >
           {generating ? 'Generating...' : 'Generate Content'}
         </button>
         
         {error && (
           <div className="p-4 bg-red-50 text-red-600 rounded-md">
             {error}
           </div>
         )}
         
         {result && (
           <div className="space-y-4">
             <div className="p-4 bg-gray-50 rounded-md">
               <h3 className="font-semibold mb-2">Generated Content</h3>
               <div className="whitespace-pre-wrap">{result.content}</div>
             </div>
             
             <div className="flex space-x-4 text-sm text-gray-600">
               <span>Tokens: {result.tokens}</span>
               <span>Cost: ${result.cost.toFixed(4)}</span>
             </div>
           </div>
         )}
       </div>
     );
   }
   ```

## Files to Create

- `lib/openai/openai-service.ts` - Basic OpenAI service
- `lib/generation/basic-pipeline.ts` - Simple generation pipeline
- `app/api/generate/route.ts` - Generation API endpoint
- `components/generation/SimpleGenerator.tsx` - Basic UI
- `types/openai.ts` - Type definitions

## Acceptance Criteria

- [ ] Basic OpenAI API integration working
- [ ] Can generate content from templates
- [ ] Cost calculation accurate
- [ ] Token usage tracked
- [ ] Simple error handling in place
- [ ] Generated content saved to database
- [ ] Basic UI for testing generation
- [ ] API key validation working

## Testing Requirements

- [ ] Test with valid/invalid API keys
- [ ] Test different models
- [ ] Test various prompt sizes
- [ ] Test template compilation
- [ ] Test cost calculations
- [ ] Test error scenarios
- [ ] Test database storage
- [ ] Verify token counting

## Definition of Done

- [ ] OpenAI integration functional
- [ ] Templates can be used for generation
- [ ] Cost tracking implemented
- [ ] Basic UI working
- [ ] Tests passing
- [ ] Error handling in place
- [ ] Documentation updated
- [ ] Ready for advanced features