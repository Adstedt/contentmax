import OpenAI from 'openai';
import dotenv from 'dotenv';
import * as path from 'path';
import https from 'https';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

interface LatencyBreakdown {
  testName: string;
  totalTime: number;
  connectionTime?: number;
  firstByteTime?: number;
  streamTime?: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
  streaming: boolean;
}

class LatencyInvestigator {
  private openai: OpenAI;
  private results: LatencyBreakdown[] = [];

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
      maxRetries: 0, // No retries for accurate timing
    });
  }

  async runAllTests() {
    console.log('🔍 OpenAI Latency Investigation');
    console.log('='.repeat(60));

    // Test 1: Minimal prompt, minimal response
    await this.testMinimalPrompt();

    // Test 2: Network latency check
    await this.testNetworkLatency();

    // Test 3: Streaming vs non-streaming
    await this.testStreamingComparison();

    // Test 4: Different models comparison
    await this.testModelComparison();

    // Test 5: Token limit impact
    await this.testTokenLimits();

    // Print analysis
    this.analyzeResults();
  }

  private async testMinimalPrompt() {
    console.log('\n📝 Test 1: Minimal Prompt (baseline)');
    console.log('-'.repeat(40));

    const startTime = Date.now();

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply with just "ok"' }],
        max_tokens: 5,
        temperature: 0,
      });

      const totalTime = Date.now() - startTime;

      this.results.push({
        testName: 'Minimal Prompt',
        totalTime,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        model: 'gpt-4o-mini',
        streaming: false,
      });

      console.log(`✅ Response: "${response.choices[0].message.content}"`);
      console.log(`⏱️  Latency: ${totalTime}ms`);
      console.log(
        `📊 Tokens: ${response.usage?.prompt_tokens}/${response.usage?.completion_tokens}`
      );
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  private async testNetworkLatency() {
    console.log('\n📝 Test 2: Network Latency to OpenAI');
    console.log('-'.repeat(40));

    const startTime = Date.now();

    return new Promise<void>((resolve) => {
      https
        .get('https://api.openai.com', (res) => {
          const responseTime = Date.now() - startTime;
          console.log(`🌐 HTTPS handshake to api.openai.com: ${responseTime}ms`);
          console.log(`📍 Status: ${res.statusCode}`);
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ Network test failed:', err);
          resolve();
        });
    });
  }

  private async testStreamingComparison() {
    console.log('\n📝 Test 3: Streaming vs Non-Streaming');
    console.log('-'.repeat(40));

    const prompt = 'Generate a 3-sentence product description for a smart water bottle.';

    // Non-streaming test
    console.log('\n🔄 Non-Streaming Request:');
    const nonStreamStart = Date.now();

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7,
        stream: false,
      });

      const nonStreamTime = Date.now() - nonStreamStart;

      this.results.push({
        testName: 'Non-Streaming',
        totalTime: nonStreamTime,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        model: 'gpt-4o-mini',
        streaming: false,
      });

      console.log(`⏱️  Total time: ${nonStreamTime}ms`);
      console.log(`📊 Tokens generated: ${response.usage?.completion_tokens}`);
    } catch (error) {
      console.error('❌ Non-streaming failed:', error);
    }

    // Streaming test
    console.log('\n🔄 Streaming Request:');
    const streamStart = Date.now();
    let firstChunkTime = 0;
    let chunkCount = 0;

    try {
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7,
        stream: true,
      });

      let fullContent = '';

      for await (const chunk of stream) {
        if (chunkCount === 0) {
          firstChunkTime = Date.now() - streamStart;
          console.log(`⏱️  First chunk: ${firstChunkTime}ms`);
        }
        chunkCount++;

        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
      }

      const streamTotalTime = Date.now() - streamStart;

      this.results.push({
        testName: 'Streaming',
        totalTime: streamTotalTime,
        firstByteTime: firstChunkTime,
        streamTime: streamTotalTime - firstChunkTime,
        promptTokens: 0, // Not available in streaming
        completionTokens: 0,
        model: 'gpt-4o-mini',
        streaming: true,
      });

      console.log(`⏱️  Total time: ${streamTotalTime}ms`);
      console.log(`📦 Chunks received: ${chunkCount}`);
      console.log(`⚡ Time to complete after first chunk: ${streamTotalTime - firstChunkTime}ms`);
    } catch (error) {
      console.error('❌ Streaming failed:', error);
    }
  }

  private async testModelComparison() {
    console.log('\n📝 Test 4: Model Comparison');
    console.log('-'.repeat(40));

    const prompt = 'Write a one-sentence summary of artificial intelligence.';
    const models = ['gpt-4o-mini', 'gpt-3.5-turbo'];

    for (const model of models) {
      console.log(`\n🤖 Testing ${model}:`);
      const startTime = Date.now();

      try {
        const response = await this.openai.chat.completions.create({
          model: model as any,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 50,
          temperature: 0.7,
        });

        const totalTime = Date.now() - startTime;

        this.results.push({
          testName: `Model: ${model}`,
          totalTime,
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          model,
          streaming: false,
        });

        console.log(`⏱️  Latency: ${totalTime}ms`);
        console.log(`📊 Tokens: ${response.usage?.total_tokens} total`);
      } catch (error: any) {
        if (error.code === 'model_not_found') {
          console.log(`⚠️  Model ${model} not available`);
        } else {
          console.error(`❌ Error testing ${model}:`, error.message);
        }
      }
    }
  }

  private async testTokenLimits() {
    console.log('\n📝 Test 5: Token Limit Impact');
    console.log('-'.repeat(40));

    const tokenLimits = [10, 50, 200, 500];
    const prompt = 'Tell me an interesting fact about technology.';

    for (const limit of tokenLimits) {
      console.log(`\n📏 Max tokens: ${limit}`);
      const startTime = Date.now();

      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: limit,
          temperature: 0.7,
        });

        const totalTime = Date.now() - startTime;

        this.results.push({
          testName: `Token Limit: ${limit}`,
          totalTime,
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          model: 'gpt-4o-mini',
          streaming: false,
        });

        console.log(`⏱️  Latency: ${totalTime}ms`);
        console.log(`📊 Actual tokens generated: ${response.usage?.completion_tokens}`);
      } catch (error) {
        console.error(`❌ Test failed for ${limit} tokens:`, error);
      }
    }
  }

  private analyzeResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 LATENCY ANALYSIS RESULTS');
    console.log('='.repeat(60));

    // Sort by latency
    const sorted = [...this.results].sort((a, b) => a.totalTime - b.totalTime);

    console.log('\n🏆 Performance Ranking:');
    sorted.forEach((result, index) => {
      console.log(`${index + 1}. ${result.testName}: ${result.totalTime}ms`);
      if (result.firstByteTime) {
        console.log(`   → First byte: ${result.firstByteTime}ms`);
      }
    });

    // Calculate averages
    const nonStreamingResults = this.results.filter((r) => !r.streaming);
    const avgLatency =
      nonStreamingResults.reduce((sum, r) => sum + r.totalTime, 0) / nonStreamingResults.length;

    console.log('\n📈 Key Insights:');
    console.log(`• Average latency (non-streaming): ${avgLatency.toFixed(0)}ms`);

    const minimalTest = this.results.find((r) => r.testName === 'Minimal Prompt');
    if (minimalTest) {
      console.log(`• Baseline latency (minimal prompt): ${minimalTest.totalTime}ms`);
    }

    const streamingTest = this.results.find((r) => r.testName === 'Streaming');
    if (streamingTest && streamingTest.firstByteTime) {
      console.log(`• Streaming first byte: ${streamingTest.firstByteTime}ms`);
    }

    console.log('\n💡 Recommendations:');

    if (avgLatency > 5000) {
      console.log('⚠️  HIGH LATENCY DETECTED - Possible causes:');
      console.log('   1. Network/routing issues to OpenAI servers');
      console.log('   2. API key rate limiting or throttling');
      console.log('   3. Geographic distance from OpenAI servers');
      console.log('   4. Local network/firewall delays');

      console.log('\n✅ Suggested Optimizations:');
      console.log('   1. Implement streaming for immediate user feedback');
      console.log('   2. Use connection pooling/keep-alive');
      console.log('   3. Add response caching layer (Redis)');
      console.log('   4. Consider edge function deployment');
      console.log('   5. Implement request batching where possible');
    }

    if (
      streamingTest &&
      streamingTest.firstByteTime &&
      streamingTest.firstByteTime < avgLatency / 2
    ) {
      console.log(
        '\n✅ Streaming provides ' +
          Math.round((1 - streamingTest.firstByteTime / avgLatency) * 100) +
          '% faster initial response'
      );
    }
  }
}

// Main execution
if (require.main === module) {
  async function main() {
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ Error: OPENAI_API_KEY not found');
      process.exit(1);
    }

    const investigator = new LatencyInvestigator();
    await investigator.runAllTests();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Latency investigation complete');
    console.log('='.repeat(60));
  }

  main().catch(console.error);
}
