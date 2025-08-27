import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

interface UsageProjection {
  dailyGenerations: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-4-turbo';
}

interface CostBreakdown {
  daily: number;
  monthly: number;
  annual: number;
  perGeneration: number;
  promptCost: number;
  completionCost: number;
}

interface ModelPricing {
  input: number; // Cost per 1000 tokens
  output: number; // Cost per 1000 tokens
}

export class CostCalculator {
  private readonly pricing: Record<string, ModelPricing> = {
    'gpt-4o-mini': {
      input: 0.15 / 1000, // $0.15 per 1M tokens
      output: 0.6 / 1000, // $0.60 per 1M tokens
    },
    'gpt-4o': {
      input: 2.5 / 1000, // $2.50 per 1M tokens
      output: 10.0 / 1000, // $10.00 per 1M tokens
    },
    'gpt-4-turbo': {
      input: 10.0 / 1000, // $10.00 per 1M tokens
      output: 30.0 / 1000, // $30.00 per 1M tokens
    },
  };

  calculateCost(projection: UsageProjection): CostBreakdown {
    const modelPricing = this.pricing[projection.model];

    if (!modelPricing) {
      throw new Error(`Unknown model: ${projection.model}`);
    }

    const promptCost = (projection.avgPromptTokens / 1000) * modelPricing.input;
    const completionCost = (projection.avgCompletionTokens / 1000) * modelPricing.output;
    const costPerGeneration = promptCost + completionCost;

    const dailyCost = costPerGeneration * projection.dailyGenerations;

    return {
      daily: dailyCost,
      monthly: dailyCost * 30,
      annual: dailyCost * 365,
      perGeneration: costPerGeneration,
      promptCost,
      completionCost,
    };
  }

  calculateBreakEven(
    monthlyRevenue: number,
    projection: UsageProjection
  ): {
    generationsNeeded: number;
    revenuePerGeneration: number;
    profitMargin: number;
  } {
    const costs = this.calculateCost(projection);
    const revenuePerGeneration = monthlyRevenue / (projection.dailyGenerations * 30);
    const profitMargin =
      ((revenuePerGeneration - costs.perGeneration) / revenuePerGeneration) * 100;

    return {
      generationsNeeded: Math.ceil(monthlyRevenue / costs.perGeneration),
      revenuePerGeneration,
      profitMargin,
    };
  }

  compareModels(baseProjection: Omit<UsageProjection, 'model'>): Record<string, CostBreakdown> {
    const models = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] as const;
    const comparison: Record<string, CostBreakdown> = {};

    for (const model of models) {
      comparison[model] = this.calculateCost({
        ...baseProjection,
        model,
      });
    }

    return comparison;
  }

  printCostAnalysis(projection: UsageProjection, label: string): void {
    const costs = this.calculateCost(projection);

    console.log(`\n📊 ${label} - ${projection.model.toUpperCase()}`);
    console.log('─'.repeat(50));
    console.log(`Usage Pattern:`);
    console.log(`  Daily generations: ${projection.dailyGenerations.toLocaleString()}`);
    console.log(`  Avg prompt tokens: ${projection.avgPromptTokens.toLocaleString()}`);
    console.log(`  Avg completion tokens: ${projection.avgCompletionTokens.toLocaleString()}`);
    console.log(`\nCost Breakdown:`);
    console.log(`  Per generation: $${costs.perGeneration.toFixed(4)}`);
    console.log(`    ├─ Prompt cost: $${costs.promptCost.toFixed(4)}`);
    console.log(`    └─ Completion cost: $${costs.completionCost.toFixed(4)}`);
    console.log(`  Daily: $${costs.daily.toFixed(2)}`);
    console.log(`  Monthly (30d): $${costs.monthly.toFixed(2)}`);
    console.log(`  Annual (365d): $${costs.annual.toFixed(2)}`);
  }

  printModelComparison(baseProjection: Omit<UsageProjection, 'model'>): void {
    const comparison = this.compareModels(baseProjection);

    console.log('\n🔍 Model Cost Comparison');
    console.log('─'.repeat(50));
    console.log(`Based on: ${baseProjection.dailyGenerations} daily generations`);
    console.log(
      `Tokens: ${baseProjection.avgPromptTokens} prompt / ${baseProjection.avgCompletionTokens} completion\n`
    );

    console.log('| Model         | Per Gen  | Daily    | Monthly  | Annual     |');
    console.log('|---------------|----------|----------|----------|------------|');

    for (const [model, costs] of Object.entries(comparison)) {
      console.log(
        `| ${model.padEnd(13)} ` +
          `| $${costs.perGeneration.toFixed(4).padEnd(7)} ` +
          `| $${costs.daily.toFixed(2).padEnd(7)} ` +
          `| $${costs.monthly.toFixed(2).padEnd(7)} ` +
          `| $${costs.annual.toFixed(2).padEnd(9)} |`
      );
    }
  }

  calculateOptimalPricing(
    projection: UsageProjection,
    targetMargin: number = 50
  ): {
    suggestedPricePerGeneration: number;
    suggestedMonthlyPrice: number;
    breakEvenGenerations: number;
  } {
    const costs = this.calculateCost(projection);
    const marginMultiplier = 1 / (1 - targetMargin / 100);
    const suggestedPricePerGeneration = costs.perGeneration * marginMultiplier;
    const suggestedMonthlyPrice = costs.monthly * marginMultiplier;

    return {
      suggestedPricePerGeneration,
      suggestedMonthlyPrice,
      breakEvenGenerations: Math.ceil(suggestedMonthlyPrice / suggestedPricePerGeneration),
    };
  }
}

// Test scenarios
export function runCostAnalysis() {
  const calculator = new CostCalculator();

  console.log('='.repeat(50));
  console.log('💰 OpenAI API Cost Analysis');
  console.log('='.repeat(50));

  // Scenario 1: Conservative (MVP Launch)
  const conservativeScenario: UsageProjection = {
    dailyGenerations: 100,
    avgPromptTokens: 500,
    avgCompletionTokens: 800,
    model: 'gpt-4o-mini',
  };

  // Scenario 2: Moderate (Growth Phase)
  const moderateScenario: UsageProjection = {
    dailyGenerations: 500,
    avgPromptTokens: 800,
    avgCompletionTokens: 1200,
    model: 'gpt-4o-mini',
  };

  // Scenario 3: Aggressive (Scale Phase)
  const aggressiveScenario: UsageProjection = {
    dailyGenerations: 2000,
    avgPromptTokens: 1000,
    avgCompletionTokens: 1500,
    model: 'gpt-4o',
  };

  // Scenario 4: Premium (Enterprise)
  const premiumScenario: UsageProjection = {
    dailyGenerations: 500,
    avgPromptTokens: 2000,
    avgCompletionTokens: 3000,
    model: 'gpt-4o',
  };

  // Print individual scenarios
  calculator.printCostAnalysis(conservativeScenario, 'Conservative Scenario (MVP)');
  calculator.printCostAnalysis(moderateScenario, 'Moderate Scenario (Growth)');
  calculator.printCostAnalysis(aggressiveScenario, 'Aggressive Scenario (Scale)');
  calculator.printCostAnalysis(premiumScenario, 'Premium Scenario (Enterprise)');

  // Model comparison for moderate usage
  calculator.printModelComparison({
    dailyGenerations: 500,
    avgPromptTokens: 1000,
    avgCompletionTokens: 1500,
  });

  // Pricing recommendations
  console.log('\n💵 Pricing Recommendations (50% margin)');
  console.log('─'.repeat(50));

  for (const [name, scenario] of [
    ['Conservative', conservativeScenario],
    ['Moderate', moderateScenario],
    ['Aggressive', aggressiveScenario],
    ['Premium', premiumScenario],
  ] as const) {
    const pricing = calculator.calculateOptimalPricing(scenario, 50);
    console.log(`\n${name}:`);
    console.log(
      `  Suggested price per generation: $${pricing.suggestedPricePerGeneration.toFixed(3)}`
    );
    console.log(`  Suggested monthly subscription: $${pricing.suggestedMonthlyPrice.toFixed(2)}`);
    console.log(`  Break-even generations: ${pricing.breakEvenGenerations.toLocaleString()}`);
  }

  // ROI Analysis
  console.log('\n📈 ROI Analysis');
  console.log('─'.repeat(50));

  const monthlySubscriptionPrices = [29, 99, 299, 999];

  for (const price of monthlySubscriptionPrices) {
    console.log(`\n$${price}/month subscription:`);

    const moderateCosts = calculator.calculateCost(moderateScenario);
    const profit = price - moderateCosts.monthly;
    const margin = (profit / price) * 100;

    console.log(`  API costs: $${moderateCosts.monthly.toFixed(2)}`);
    console.log(`  Profit: $${profit.toFixed(2)}`);
    console.log(`  Margin: ${margin.toFixed(1)}%`);
    console.log(`  Max daily generations: ${Math.floor(price / 30 / moderateCosts.perGeneration)}`);
  }
}

// Token usage estimator
export function estimateTokenUsage(contentType: string): {
  promptTokens: number;
  completionTokens: number;
} {
  const estimates: Record<string, { promptTokens: number; completionTokens: number }> = {
    'short-description': { promptTokens: 200, completionTokens: 150 },
    'product-page': { promptTokens: 500, completionTokens: 800 },
    'blog-post': { promptTokens: 800, completionTokens: 1500 },
    'email-campaign': { promptTokens: 400, completionTokens: 600 },
    'social-media': { promptTokens: 150, completionTokens: 100 },
    'landing-page': { promptTokens: 1000, completionTokens: 2000 },
    'technical-doc': { promptTokens: 1200, completionTokens: 2500 },
  };

  return estimates[contentType] || { promptTokens: 500, completionTokens: 1000 };
}

// Main execution
if (require.main === module) {
  runCostAnalysis();

  console.log('\n' + '='.repeat(50));
  console.log('✅ Cost analysis completed');
  console.log('='.repeat(50));
}
