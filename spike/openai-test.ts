import OpenAI from 'openai';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

interface TestResult {
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  latency: number;
  retries: number;
  success: boolean;
  error?: string;
}

export class OpenAITestHarness {
  private results: TestResult[] = [];
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async runLatencyTest(): Promise<void> {
    const testPrompts = [
      { size: 'small', tokens: 100 },
      { size: 'medium', tokens: 500 },
      { size: 'large', tokens: 2000 },
      { size: 'max', tokens: 4000 },
    ];

    console.log('🚀 Starting OpenAI Latency Tests\n');
    console.log('='.repeat(50));

    for (const test of testPrompts) {
      const prompt = this.generateTestPrompt(test.tokens);
      const startTime = Date.now();

      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a content generator.' },
            { role: 'user', content: prompt },
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
          success: true,
        });

        console.log(`✅ ${test.size} prompt (${test.tokens} tokens):`);
        console.log(`   Latency: ${latency}ms`);
        console.log(`   Prompt tokens: ${response.usage?.prompt_tokens}`);
        console.log(`   Completion tokens: ${response.usage?.completion_tokens}`);
        console.log(`   Cost: $${this.calculateCost(response.usage).toFixed(4)}\n`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ ${test.size} prompt failed: ${errorMessage}\n`);

        this.results.push({
          promptTokens: 0,
          completionTokens: 0,
          totalCost: 0,
          latency: Date.now() - startTime,
          retries: 0,
          success: false,
          error: errorMessage,
        });
      }
    }

    this.printSummary();
  }

  private calculateCost(usage: any): number {
    if (!usage) return 0;

    // GPT-4o-mini pricing (as of 2024)
    const inputCost = 0.00015 / 1000; // per token
    const outputCost = 0.0006 / 1000; // per token

    return usage.prompt_tokens * inputCost + usage.completion_tokens * outputCost;
  }

  private generateTestPrompt(targetTokens: number): string {
    // Approximate 1 token = 4 characters
    const charCount = targetTokens * 4;
    const basePrompt =
      'Generate a detailed product description for an innovative smart home device that ';
    const padding = 'includes advanced features and benefits ';
    const paddingCount = Math.max(0, (charCount - basePrompt.length) / padding.length);

    return basePrompt + padding.repeat(paddingCount);
  }

  private printSummary(): void {
    console.log('='.repeat(50));
    console.log('📊 Test Summary\n');

    const successfulTests = this.results.filter((r) => r.success);

    if (successfulTests.length > 0) {
      const avgLatency =
        successfulTests.reduce((sum, r) => sum + r.latency, 0) / successfulTests.length;
      const totalCost = successfulTests.reduce((sum, r) => sum + r.totalCost, 0);
      const avgTokensGenerated =
        successfulTests.reduce((sum, r) => sum + r.completionTokens, 0) / successfulTests.length;

      console.log(`Average latency: ${avgLatency.toFixed(0)}ms`);
      console.log(`Total test cost: $${totalCost.toFixed(4)}`);
      console.log(`Average tokens generated: ${avgTokensGenerated.toFixed(0)}`);
      console.log(
        `Success rate: ${((successfulTests.length / this.results.length) * 100).toFixed(0)}%`
      );
    }

    console.log('\n' + '='.repeat(50));
  }

  getResults(): TestResult[] {
    return this.results;
  }
}

// Main execution
if (require.main === module) {
  async function main() {
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ Error: OPENAI_API_KEY not found in environment variables');
      console.log('Please add OPENAI_API_KEY to your .env file');
      process.exit(1);
    }

    const harness = new OpenAITestHarness();
    await harness.runLatencyTest();
  }

  main().catch(console.error);
}
