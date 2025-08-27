# Story 5.2: Smart Prioritization Algorithm

## User Story
As a content strategist,
I want an intelligent prioritization system,
So that I can focus on generating content that will have the highest impact.

## Size & Priority
- **Size**: M (6 hours)
- **Priority**: P0 - Critical
- **Sprint**: 5
- **Dependencies**: Tasks 2.4, 2.5

## Description
Implement a smart prioritization algorithm that scores and ranks content opportunities based on multiple factors including search volume, competition, conversion potential, seasonal trends, and business value.

## Implementation Steps

1. **Priority scoring engine**
   ```typescript
   interface PriorityFactors {
     searchVolume: number;        // Monthly search volume
     difficulty: number;           // SEO difficulty (0-100)
     conversionRate: number;       // Historical conversion rate
     competitorGap: boolean;       // Competitors have content
     seasonality: SeasonalData;    // Seasonal trends
     businessValue: number;        // Revenue potential
     contentAge: number | null;    // Days since last update
     trendVelocity: number;        // Rate of search growth
     brandAlignment: number;       // Alignment with brand (0-1)
     userIntent: 'informational' | 'transactional' | 'navigational';
   }
   
   class PriorityScoreEngine {
     private weights: PriorityWeights;
     
     constructor(weights?: Partial<PriorityWeights>) {
       this.weights = {
         searchVolume: 0.20,
         difficulty: 0.15,
         conversionPotential: 0.25,
         competitorGap: 0.10,
         seasonality: 0.10,
         businessValue: 0.15,
         freshness: 0.05,
         ...weights
       };
     }
     
     calculateScore(item: ContentItem, factors: PriorityFactors): PriorityScore {
       const scores = {
         searchVolumeScore: this.calculateSearchVolumeScore(factors.searchVolume),
         difficultyScore: this.calculateDifficultyScore(factors.difficulty),
         conversionScore: this.calculateConversionScore(factors.conversionRate),
         competitorScore: this.calculateCompetitorScore(factors.competitorGap),
         seasonalityScore: this.calculateSeasonalityScore(factors.seasonality),
         businessScore: this.calculateBusinessScore(factors.businessValue),
         freshnessScore: this.calculateFreshnessScore(factors.contentAge),
         trendScore: this.calculateTrendScore(factors.trendVelocity),
         intentScore: this.calculateIntentScore(factors.userIntent)
       };
       
       // Calculate weighted total
       const totalScore = Object.entries(scores).reduce((sum, [key, score]) => {
         const weight = this.weights[key.replace('Score', '')] || 0;
         return sum + (score * weight);
       }, 0);
       
       return {
         total: Math.round(totalScore * 100),
         breakdown: scores,
         confidence: this.calculateConfidence(factors),
         recommendation: this.getRecommendation(totalScore),
         estimatedImpact: this.estimateImpact(factors)
       };
     }
     
     private calculateSearchVolumeScore(volume: number): number {
       // Logarithmic scale for search volume
       if (volume <= 0) return 0;
       if (volume <= 100) return 0.2;
       if (volume <= 500) return 0.4;
       if (volume <= 1000) return 0.6;
       if (volume <= 5000) return 0.8;
       if (volume <= 10000) return 0.9;
       return 1.0;
     }
     
     private calculateDifficultyScore(difficulty: number): number {
       // Inverse relationship - lower difficulty = higher score
       return Math.max(0, (100 - difficulty) / 100);
     }
     
     private calculateConversionScore(rate: number): number {
       // Benchmark against average conversion rate (2%)
       const benchmark = 0.02;
       if (rate <= 0) return 0;
       if (rate <= benchmark * 0.5) return 0.3;
       if (rate <= benchmark) return 0.5;
       if (rate <= benchmark * 1.5) return 0.7;
       if (rate <= benchmark * 2) return 0.85;
       return 1.0;
     }
     
     private calculateCompetitorScore(hasGap: boolean): number {
       // Binary with slight preference for gaps
       return hasGap ? 0.8 : 0.2;
     }
     
     private calculateSeasonalityScore(seasonality: SeasonalData): number {
       const now = new Date();
       const currentMonth = now.getMonth();
       const weeksUntilPeak = this.getWeeksUntilPeak(seasonality, currentMonth);
       
       // Score based on proximity to peak season
       if (weeksUntilPeak <= 4) return 1.0;   // Peak or near peak
       if (weeksUntilPeak <= 8) return 0.8;   // Approaching peak
       if (weeksUntilPeak <= 12) return 0.6;  // Mid-season
       if (weeksUntilPeak <= 20) return 0.4;  // Off-season approaching
       return 0.2; // Deep off-season
     }
     
     private calculateBusinessScore(value: number): number {
       // Normalized business value (assuming max value of $10,000)
       const maxValue = 10000;
       return Math.min(1, value / maxValue);
     }
     
     private calculateFreshnessScore(ageInDays: number | null): number {
       if (ageInDays === null) return 1.0; // No content = highest priority
       if (ageInDays <= 30) return 0.1;     // Very fresh
       if (ageInDays <= 90) return 0.3;     // Recent
       if (ageInDays <= 180) return 0.5;    // Aging
       if (ageInDays <= 365) return 0.7;    // Old
       return 0.9; // Very old
     }
     
     private calculateTrendScore(velocity: number): number {
       // Velocity is % change in search volume
       if (velocity <= -20) return 0.1;  // Declining fast
       if (velocity <= 0) return 0.3;    // Declining
       if (velocity <= 10) return 0.5;   // Stable
       if (velocity <= 30) return 0.7;   // Growing
       if (velocity <= 50) return 0.85;  // Growing fast
       return 1.0; // Exploding
     }
     
     private calculateIntentScore(intent: string): number {
       // Prioritize transactional intent
       switch (intent) {
         case 'transactional': return 1.0;
         case 'informational': return 0.6;
         case 'navigational': return 0.3;
         default: return 0.5;
       }
     }
     
     private calculateConfidence(factors: PriorityFactors): number {
       // Confidence based on data completeness
       let dataPoints = 0;
       let filledPoints = 0;
       
       Object.values(factors).forEach(value => {
         dataPoints++;
         if (value !== null && value !== undefined) {
           filledPoints++;
         }
       });
       
       return filledPoints / dataPoints;
     }
     
     private getRecommendation(score: number): PriorityRecommendation {
       if (score >= 0.8) return 'immediate';
       if (score >= 0.6) return 'high';
       if (score >= 0.4) return 'medium';
       if (score >= 0.2) return 'low';
       return 'skip';
     }
     
     private estimateImpact(factors: PriorityFactors): ImpactEstimate {
       const monthlyTraffic = factors.searchVolume * this.estimateCTR(factors.difficulty);
       const monthlyRevenue = monthlyTraffic * factors.conversionRate * factors.businessValue;
       
       return {
         estimatedTraffic: Math.round(monthlyTraffic),
         estimatedRevenue: Math.round(monthlyRevenue),
         confidenceLevel: this.calculateConfidence(factors)
       };
     }
     
     private estimateCTR(difficulty: number): number {
       // Estimate CTR based on difficulty (position)
       if (difficulty <= 20) return 0.30;  // Top 3
       if (difficulty <= 40) return 0.15;  // Top 5
       if (difficulty <= 60) return 0.08;  // Top 10
       if (difficulty <= 80) return 0.03;  // Page 2
       return 0.01; // Beyond
     }
   }
   ```

2. **Batch prioritization system**
   ```typescript
   class BatchPrioritizationSystem {
     private scoreEngine: PriorityScoreEngine;
     private dataAggregator: DataAggregator;
     
     constructor() {
       this.scoreEngine = new PriorityScoreEngine();
       this.dataAggregator = new DataAggregator();
     }
     
     async prioritizeBatch(
       items: ContentItem[],
       options: PrioritizationOptions = {}
     ): Promise<PrioritizedBatch> {
       // Gather data for all items
       const itemsWithData = await Promise.all(
         items.map(item => this.gatherItemData(item))
       );
       
       // Score all items
       const scoredItems = itemsWithData.map(item => ({
         ...item,
         score: this.scoreEngine.calculateScore(item.item, item.factors)
       }));
       
       // Apply filters
       const filteredItems = this.applyFilters(scoredItems, options.filters);
       
       // Sort by priority
       const sortedItems = this.sortByPriority(filteredItems, options.sortBy);
       
       // Group into tiers
       const tiers = this.groupIntoTiers(sortedItems);
       
       // Generate insights
       const insights = this.generateInsights(sortedItems);
       
       return {
         items: sortedItems,
         tiers,
         insights,
         metadata: {
           totalItems: items.length,
           scoredItems: sortedItems.length,
           timestamp: new Date(),
           options
         }
       };
     }
     
     private async gatherItemData(item: ContentItem): Promise<ItemWithData> {
       const [
         searchData,
         competitorData,
         analyticsData,
         seasonalData
       ] = await Promise.all([
         this.dataAggregator.getSearchData(item),
         this.dataAggregator.getCompetitorData(item),
         this.dataAggregator.getAnalyticsData(item),
         this.dataAggregator.getSeasonalData(item)
       ]);
       
       return {
         item,
         factors: {
           searchVolume: searchData.monthlyVolume,
           difficulty: searchData.difficulty,
           conversionRate: analyticsData.conversionRate || 0.02,
           competitorGap: competitorData.hasContent,
           seasonality: seasonalData,
           businessValue: this.calculateBusinessValue(item, analyticsData),
           contentAge: this.getContentAge(item),
           trendVelocity: searchData.trendVelocity,
           brandAlignment: this.calculateBrandAlignment(item),
           userIntent: searchData.intent
         }
       };
     }
     
     private calculateBusinessValue(
       item: ContentItem,
       analytics: AnalyticsData
     ): number {
       // Calculate based on average order value and lifetime value
       const aov = analytics.averageOrderValue || 100;
       const ltv = analytics.customerLifetimeValue || aov * 3;
       const categoryMultiplier = this.getCategoryMultiplier(item.category);
       
       return aov * categoryMultiplier * (ltv / 1000);
     }
     
     private getCategoryMultiplier(category: string): number {
       const multipliers: Record<string, number> = {
         'high-margin': 1.5,
         'bestseller': 1.3,
         'seasonal': 1.2,
         'standard': 1.0,
         'clearance': 0.7
       };
       
       return multipliers[category] || 1.0;
     }
     
     private applyFilters(
       items: ScoredItem[],
       filters?: PriorityFilters
     ): ScoredItem[] {
       if (!filters) return items;
       
       return items.filter(item => {
         if (filters.minScore && item.score.total < filters.minScore) {
           return false;
         }
         if (filters.maxDifficulty && item.factors.difficulty > filters.maxDifficulty) {
           return false;
         }
         if (filters.minVolume && item.factors.searchVolume < filters.minVolume) {
           return false;
         }
         if (filters.requireCompetitorGap && !item.factors.competitorGap) {
           return false;
         }
         if (filters.categories && !filters.categories.includes(item.item.category)) {
           return false;
         }
         return true;
       });
     }
     
     private sortByPriority(
       items: ScoredItem[],
       sortBy: SortStrategy = 'score'
     ): ScoredItem[] {
       const strategies: Record<SortStrategy, (a: ScoredItem, b: ScoredItem) => number> = {
         score: (a, b) => b.score.total - a.score.total,
         volume: (a, b) => b.factors.searchVolume - a.factors.searchVolume,
         difficulty: (a, b) => a.factors.difficulty - b.factors.difficulty,
         value: (a, b) => b.factors.businessValue - a.factors.businessValue,
         opportunity: (a, b) => {
           const oppA = a.factors.searchVolume / (a.factors.difficulty + 1);
           const oppB = b.factors.searchVolume / (b.factors.difficulty + 1);
           return oppB - oppA;
         }
       };
       
       return [...items].sort(strategies[sortBy]);
     }
     
     private groupIntoTiers(items: ScoredItem[]): PriorityTiers {
       const tiers: PriorityTiers = {
         immediate: [],
         high: [],
         medium: [],
         low: [],
         skip: []
       };
       
       items.forEach(item => {
         const tier = item.score.recommendation;
         tiers[tier].push(item);
       });
       
       return tiers;
     }
     
     private generateInsights(items: ScoredItem[]): PriorityInsights {
       const totalVolume = items.reduce((sum, i) => sum + i.factors.searchVolume, 0);
       const avgDifficulty = items.reduce((sum, i) => sum + i.factors.difficulty, 0) / items.length;
       const competitorGaps = items.filter(i => i.factors.competitorGap).length;
       
       const topOpportunities = items
         .filter(i => i.score.total >= 70)
         .slice(0, 10);
       
       const quickWins = items
         .filter(i => i.factors.difficulty < 30 && i.factors.searchVolume > 500)
         .slice(0, 5);
       
       return {
         summary: {
           totalItems: items.length,
           totalSearchVolume: totalVolume,
           averageDifficulty: avgDifficulty,
           competitorGaps,
           estimatedTotalRevenue: this.estimateTotalRevenue(items)
         },
         topOpportunities,
         quickWins,
         recommendations: this.generateRecommendations(items)
       };
     }
   }
   ```

3. **Dynamic weight adjustment**
   ```typescript
   class DynamicWeightOptimizer {
     private historicalData: HistoricalPerformance[] = [];
     private currentWeights: PriorityWeights;
     
     constructor(initialWeights: PriorityWeights) {
       this.currentWeights = initialWeights;
       this.loadHistoricalData();
     }
     
     async optimizeWeights(): Promise<PriorityWeights> {
       // Analyze historical performance
       const performance = this.analyzePerformance();
       
       // Use gradient descent to optimize weights
       const optimizedWeights = this.gradientDescent(
         this.currentWeights,
         performance
       );
       
       // Validate weights sum to 1
       const normalizedWeights = this.normalizeWeights(optimizedWeights);
       
       // Store for future reference
       await this.saveWeights(normalizedWeights);
       
       return normalizedWeights;
     }
     
     private analyzePerformance(): PerformanceMetrics {
       // Group items by their initial scores
       const buckets = this.createScoreBuckets(this.historicalData);
       
       // Calculate actual performance for each bucket
       const bucketPerformance = buckets.map(bucket => ({
         scoreRange: bucket.range,
         items: bucket.items,
         actualConversion: this.calculateActualConversion(bucket.items),
         actualRevenue: this.calculateActualRevenue(bucket.items),
         actualTraffic: this.calculateActualTraffic(bucket.items)
       }));
       
       // Identify which factors best predicted success
       const factorCorrelations = this.calculateFactorCorrelations();
       
       return {
         bucketPerformance,
         factorCorrelations,
         overallAccuracy: this.calculateOverallAccuracy()
       };
     }
     
     private gradientDescent(
       weights: PriorityWeights,
       performance: PerformanceMetrics
     ): PriorityWeights {
       const learningRate = 0.01;
       const iterations = 100;
       let currentWeights = { ...weights };
       
       for (let i = 0; i < iterations; i++) {
         const gradients = this.calculateGradients(currentWeights, performance);
         
         // Update weights
         Object.keys(currentWeights).forEach(key => {
           currentWeights[key] -= learningRate * gradients[key];
           currentWeights[key] = Math.max(0, Math.min(1, currentWeights[key]));
         });
         
         // Check convergence
         if (this.hasConverged(gradients)) break;
       }
       
       return currentWeights;
     }
     
     private calculateGradients(
       weights: PriorityWeights,
       performance: PerformanceMetrics
     ): PriorityWeights {
       const gradients: PriorityWeights = {};
       const epsilon = 0.0001;
       
       Object.keys(weights).forEach(key => {
         // Calculate partial derivative
         const weightsPlus = { ...weights, [key]: weights[key] + epsilon };
         const weightsMinus = { ...weights, [key]: weights[key] - epsilon };
         
         const lossPlus = this.calculateLoss(weightsPlus, performance);
         const lossMinus = this.calculateLoss(weightsMinus, performance);
         
         gradients[key] = (lossPlus - lossMinus) / (2 * epsilon);
       });
       
       return gradients;
     }
     
     private calculateLoss(
       weights: PriorityWeights,
       performance: PerformanceMetrics
     ): number {
       // Mean squared error between predicted and actual performance
       let totalError = 0;
       
       performance.bucketPerformance.forEach(bucket => {
         const predicted = this.predictPerformance(bucket.items, weights);
         const actual = bucket.actualRevenue;
         totalError += Math.pow(predicted - actual, 2);
       });
       
       return totalError / performance.bucketPerformance.length;
     }
   }
   ```

4. **Priority visualization component**
   ```tsx
   const PriorityVisualization: React.FC<{ items: ScoredItem[] }> = ({ items }) => {
     const [view, setView] = useState<'matrix' | 'list' | 'tiers'>('matrix');
     
     return (
       <div className="priority-visualization">
         <div className="view-selector">
           <button onClick={() => setView('matrix')} className={view === 'matrix' ? 'active' : ''}>
             Priority Matrix
           </button>
           <button onClick={() => setView('list')} className={view === 'list' ? 'active' : ''}>
             Ranked List
           </button>
           <button onClick={() => setView('tiers')} className={view === 'tiers' ? 'active' : ''}>
             Priority Tiers
           </button>
         </div>
         
         {view === 'matrix' && <PriorityMatrix items={items} />}
         {view === 'list' && <PriorityList items={items} />}
         {view === 'tiers' && <PriorityTiers items={items} />}
       </div>
     );
   };
   
   const PriorityMatrix: React.FC<{ items: ScoredItem[] }> = ({ items }) => {
     const canvasRef = useRef<HTMLCanvasElement>(null);
     
     useEffect(() => {
       if (!canvasRef.current) return;
       
       const canvas = canvasRef.current;
       const ctx = canvas.getContext('2d')!;
       
       // Draw quadrant grid
       drawQuadrants(ctx, canvas.width, canvas.height);
       
       // Plot items
       items.forEach(item => {
         const x = (item.factors.businessValue / 10000) * canvas.width;
         const y = canvas.height - ((item.factors.searchVolume / 10000) * canvas.height);
         const radius = Math.sqrt(item.score.total) * 2;
         const color = getScoreColor(item.score.total);
         
         ctx.beginPath();
         ctx.arc(x, y, radius, 0, 2 * Math.PI);
         ctx.fillStyle = color;
         ctx.fill();
       });
     }, [items]);
     
     return (
       <div className="priority-matrix">
         <canvas ref={canvasRef} width={800} height={600} />
         <div className="axis-labels">
           <span className="x-label">Business Value →</span>
           <span className="y-label">Search Volume ↑</span>
         </div>
         <div className="quadrant-labels">
           <span className="q1">Quick Wins</span>
           <span className="q2">Major Opportunities</span>
           <span className="q3">Fill-ins</span>
           <span className="q4">Strategic Investments</span>
         </div>
       </div>
     );
   };
   ```

## Files to Create

- `lib/prioritization/PriorityScoreEngine.ts` - Core scoring logic
- `lib/prioritization/BatchPrioritizationSystem.ts` - Batch processing
- `lib/prioritization/DynamicWeightOptimizer.ts` - Weight optimization
- `lib/prioritization/DataAggregator.ts` - Data collection
- `components/prioritization/PriorityVisualization.tsx` - Visual display
- `components/prioritization/PriorityMatrix.tsx` - Matrix view
- `components/prioritization/PrioritySettings.tsx` - Weight configuration
- `types/prioritization.types.ts` - TypeScript types

## Acceptance Criteria

- [ ] Score calculation includes all factors
- [ ] Batch prioritization processes 1000+ items
- [ ] Dynamic weight optimization working
- [ ] Priority matrix visualization
- [ ] Tier grouping functional
- [ ] Quick wins identified accurately
- [ ] Insights generation comprehensive
- [ ] Custom weight configuration

## Testing Requirements

- [ ] Test scoring algorithm accuracy
- [ ] Test weight optimization convergence
- [ ] Test batch processing performance
- [ ] Test filter application
- [ ] Test insight generation
- [ ] Test visualization rendering
- [ ] Test data aggregation
- [ ] Test edge cases (null data)

## Definition of Done

- [ ] Code complete and committed
- [ ] Scoring engine operational
- [ ] Batch processing efficient
- [ ] Visualizations clear
- [ ] Weight optimization functional
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed