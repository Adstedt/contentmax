import { createClient } from '@/lib/supabase/client';
import { UrlMatcher } from '@/lib/integration/url-matcher';
import { GtinMatcher } from '@/lib/integration/gtin-matcher';
import { MetricsAggregator } from '@/lib/integration/metrics-aggregator';
import { ConfidenceScorer } from '@/lib/integration/confidence-scorer';
import {
  TaxonomyNode,
  Product,
  IntegratedMetric,
  GSCMetric,
  GA4Metric,
  MarketMetric,
  MatchResult,
  UnmatchedMetric,
} from '@/types/integration';

export interface IntegrationResult {
  success: boolean;
  stats: {
    totalProcessed: number;
    matched: number;
    unmatched: number;
    aggregated: number;
    avgConfidence: number;
  };
  errors: string[];
  processingTimeMs: number;
}

export class MetricsIntegrator {
  private urlMatcher: UrlMatcher;
  private gtinMatcher: GtinMatcher;
  private aggregator: MetricsAggregator;
  private confidenceScorer: ConfidenceScorer;
  private supabase = createClient();

  constructor() {
    this.urlMatcher = new UrlMatcher();
    this.gtinMatcher = new GtinMatcher();
    this.aggregator = new MetricsAggregator();
    this.confidenceScorer = new ConfidenceScorer();
  }

  /**
   * Main integration pipeline
   */
  async integrateAllMetrics(
    userId: string,
    date: string = new Date().toISOString().split('T')[0]
  ): Promise<IntegrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Step 1: Load base data
      console.log('Loading taxonomy and products...');
      const { nodes, products } = await this.loadTaxonomyData(userId);

      if (!nodes.length || !products.length) {
        return {
          success: false,
          stats: { totalProcessed: 0, matched: 0, unmatched: 0, aggregated: 0, avgConfidence: 0 },
          errors: ['No taxonomy or products found'],
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Step 2: Fetch and match external data
      console.log('Fetching external metrics...');
      const [gscResults, ga4Results, marketResults] = await Promise.all([
        this.processGSCData(userId, date, nodes, products),
        this.processGA4Data(userId, date, nodes, products),
        this.processMarketData(userId, date, products),
      ]);

      // Step 3: Combine metrics by entity
      console.log('Combining metrics...');
      const combinedMetrics = await this.combineMetricsByEntity(
        userId,
        date,
        gscResults,
        ga4Results,
        marketResults
      );

      // Step 4: Aggregate to categories
      console.log('Aggregating to categories...');
      const aggregated = this.aggregator.aggregateToCategories(nodes, combinedMetrics);

      // Step 5: Persist to database
      console.log('Saving integrated metrics...');
      await this.persistIntegratedMetrics(userId, date, combinedMetrics, aggregated);

      // Calculate stats
      const totalProcessed = gscResults.total + ga4Results.total + marketResults.total;
      const totalMatched = gscResults.matched + ga4Results.matched + marketResults.matched;
      const totalUnmatched = gscResults.unmatched + ga4Results.unmatched + marketResults.unmatched;

      const allConfidences = [
        ...Array.from(combinedMetrics.values()).map((m) => m.gsc_match_confidence || 0),
        ...Array.from(combinedMetrics.values()).map((m) => m.ga4_match_confidence || 0),
        ...Array.from(combinedMetrics.values()).map((m) => m.market_match_confidence || 0),
      ].filter((c) => c > 0);

      const avgConfidence =
        allConfidences.length > 0
          ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
          : 0;

      return {
        success: true,
        stats: {
          totalProcessed,
          matched: totalMatched,
          unmatched: totalUnmatched,
          aggregated: aggregated.size,
          avgConfidence,
        },
        errors,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Integration failed:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        stats: { totalProcessed: 0, matched: 0, unmatched: 0, aggregated: 0, avgConfidence: 0 },
        errors,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Load taxonomy and products from database
   */
  private async loadTaxonomyData(
    userId: string
  ): Promise<{ nodes: TaxonomyNode[]; products: Product[] }> {
    const [nodesResult, productsResult] = await Promise.all([
      this.supabase.from('taxonomy_nodes').select('*').eq('user_id', userId),
      this.supabase.from('products').select('*').eq('user_id', userId),
    ]);

    if (nodesResult.error) throw nodesResult.error;
    if (productsResult.error) throw productsResult.error;

    return {
      nodes: nodesResult.data || [],
      products: productsResult.data || [],
    };
  }

  /**
   * Process GSC data and match to entities
   */
  private async processGSCData(
    userId: string,
    date: string,
    nodes: TaxonomyNode[],
    products: Product[]
  ): Promise<{ matched: number; unmatched: number; total: number; results: Map<string, any> }> {
    // Fetch GSC data
    const { data: gscData, error } = await this.supabase
      .from('search_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);

    if (error || !gscData) {
      return { matched: 0, unmatched: 0, total: 0, results: new Map() };
    }

    const results = new Map<string, any>();
    const urls = gscData.map((d) => d.url);
    const matches = await this.urlMatcher.batchMatchUrls(urls, nodes, products);

    let matched = 0;
    let unmatched = 0;

    for (const metric of gscData) {
      const match = matches.get(metric.url);

      if (match && this.confidenceScorer.meetsThreshold(match.confidence)) {
        const key = `${match.type}_${match.id}`;
        results.set(key, {
          ...metric,
          entity_type: match.type,
          entity_id: match.id,
          confidence: match.confidence,
        });
        matched++;
      } else {
        // Track unmatched
        await this.trackUnmatchedMetric(userId, 'gsc', metric.url, metric);
        unmatched++;
      }
    }

    return { matched, unmatched, total: gscData.length, results };
  }

  /**
   * Process GA4 data and match to entities
   */
  private async processGA4Data(
    userId: string,
    date: string,
    nodes: TaxonomyNode[],
    products: Product[]
  ): Promise<{ matched: number; unmatched: number; total: number; results: Map<string, any> }> {
    // Fetch GA4 data
    const { data: ga4Data, error } = await this.supabase
      .from('analytics_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);

    if (error || !ga4Data) {
      return { matched: 0, unmatched: 0, total: 0, results: new Map() };
    }

    const results = new Map<string, any>();
    const paths = ga4Data.map((d) => d.page_path);
    const matches = await this.urlMatcher.batchMatchUrls(paths, nodes, products);

    let matched = 0;
    let unmatched = 0;

    for (const metric of ga4Data) {
      const match = matches.get(metric.page_path);

      if (match && this.confidenceScorer.meetsThreshold(match.confidence)) {
        const key = `${match.type}_${match.id}`;
        results.set(key, {
          ...metric,
          entity_type: match.type,
          entity_id: match.id,
          confidence: match.confidence,
        });
        matched++;
      } else {
        // Track unmatched
        await this.trackUnmatchedMetric(userId, 'ga4', metric.page_path, metric);
        unmatched++;
      }
    }

    return { matched, unmatched, total: ga4Data.length, results };
  }

  /**
   * Process market/merchant data and match by GTIN
   */
  private async processMarketData(
    userId: string,
    date: string,
    products: Product[]
  ): Promise<{ matched: number; unmatched: number; total: number; results: Map<string, any> }> {
    // For now, return empty results as market data integration would come from external API
    // This would be implemented when connecting to price comparison APIs
    return { matched: 0, unmatched: 0, total: 0, results: new Map() };
  }

  /**
   * Combine metrics from different sources by entity
   */
  private async combineMetricsByEntity(
    userId: string,
    date: string,
    gscResults: any,
    ga4Results: any,
    marketResults: any
  ): Promise<Map<string, IntegratedMetric>> {
    const combined = new Map<string, IntegratedMetric>();
    const allKeys = new Set([
      ...gscResults.results.keys(),
      ...ga4Results.results.keys(),
      ...marketResults.results.keys(),
    ]);

    for (const key of allKeys) {
      const [entityType, entityId] = key.split('_');
      const gsc = gscResults.results.get(key);
      const ga4 = ga4Results.results.get(key);
      const market = marketResults.results.get(key);

      const metric = this.aggregator.combineMetrics(gsc, ga4, market);
      metric.entity_type = entityType as 'node' | 'product';
      metric.entity_id = entityId;
      metric.metrics_date = new Date(date);
      metric.user_id = userId;

      // Calculate combined confidence
      metric.gsc_match_confidence = gsc?.confidence;
      metric.ga4_match_confidence = ga4?.confidence;
      metric.market_match_confidence = market?.confidence;

      combined.set(key, metric);
    }

    return combined;
  }

  /**
   * Persist integrated metrics to database
   */
  private async persistIntegratedMetrics(
    userId: string,
    date: string,
    productMetrics: Map<string, IntegratedMetric>,
    aggregatedMetrics: Map<string, any>
  ): Promise<void> {
    const metricsToInsert: any[] = [];

    // Add product-level metrics
    for (const [key, metric] of productMetrics) {
      metricsToInsert.push({
        ...metric,
        is_aggregated: false,
      });
    }

    // Add aggregated category metrics
    for (const [nodeId, aggregated] of aggregatedMetrics) {
      metricsToInsert.push({
        entity_type: 'node',
        entity_id: nodeId,
        gsc_clicks: aggregated.clicks,
        gsc_impressions: aggregated.impressions,
        gsc_position: aggregated.avg_position,
        ga4_sessions: aggregated.sessions,
        ga4_revenue: aggregated.revenue,
        ga4_transactions: aggregated.transactions,
        ga4_conversion_rate: aggregated.avg_conversion_rate,
        is_aggregated: true,
        child_count: aggregated.child_node_count + aggregated.product_count,
        metrics_date: date,
        user_id: userId,
      });
    }

    // Batch insert
    if (metricsToInsert.length > 0) {
      const { error } = await this.supabase.from('integrated_metrics').upsert(metricsToInsert, {
        onConflict: 'entity_type,entity_id,metrics_date,user_id',
      });

      if (error) throw error;
    }
  }

  /**
   * Track unmatched metrics for manual review
   */
  private async trackUnmatchedMetric(
    userId: string,
    source: 'gsc' | 'ga4' | 'market',
    identifier: string,
    metrics: any
  ): Promise<void> {
    const { error } = await this.supabase.from('unmatched_metrics').insert({
      source,
      identifier,
      identifier_type: source === 'market' ? 'gtin' : 'url',
      metrics,
      user_id: userId,
    });

    if (error) console.error('Failed to track unmatched metric:', error);
  }

  /**
   * Get integration status summary
   */
  async getIntegrationStatus(userId: string): Promise<{
    lastSync: Date | null;
    totalMatched: number;
    totalUnmatched: number;
    avgConfidence: number;
    topUnmatched: any[];
  }> {
    // Get last sync
    const { data: lastMetric } = await this.supabase
      .from('integrated_metrics')
      .select('last_updated')
      .eq('user_id', userId)
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    // Get match stats
    const { data: matched } = await this.supabase
      .from('integrated_metrics')
      .select('gsc_match_confidence, ga4_match_confidence, market_match_confidence')
      .eq('user_id', userId);

    // Get unmatched count
    const { count: unmatchedCount } = await this.supabase
      .from('unmatched_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('resolved', false);

    // Get top unmatched items
    const { data: topUnmatched } = await this.supabase
      .from('unmatched_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('resolved', false)
      .order('match_attempts', { ascending: false })
      .limit(10);

    // Calculate average confidence
    const confidences =
      matched?.flatMap((m) =>
        [m.gsc_match_confidence, m.ga4_match_confidence, m.market_match_confidence].filter(
          (c) => c !== null
        )
      ) || [];

    const avgConfidence =
      confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

    return {
      lastSync: lastMetric ? new Date(lastMetric.last_updated) : null,
      totalMatched: matched?.length || 0,
      totalUnmatched: unmatchedCount || 0,
      avgConfidence,
      topUnmatched: topUnmatched || [],
    };
  }
}
