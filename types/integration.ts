// Types for STORY-023: Metrics Data Integration Layer

export interface TaxonomyNode {
  id: string;
  title: string;
  path?: string;
  url?: string;
  parent_id?: string;
  children?: TaxonomyNode[];
  level?: number;
  user_id: string;
}

export interface Product {
  id: string;
  title: string;
  link?: string;
  gtin?: string;
  mpn?: string;
  sku?: string;
  category_id?: string;
  user_id: string;
}

export interface MatchResult {
  type: 'node' | 'product';
  id: string;
  confidence: number;
  strategy:
    | 'exact_url'
    | 'path_match'
    | 'product_id'
    | 'category_match'
    | 'fuzzy_match'
    | 'gtin_exact'
    | 'manual';
  metadata?: Record<string, any>;
}

export interface IntegratedMetric {
  entity_type: 'node' | 'product';
  entity_id: string;

  // GSC metrics
  gsc_clicks?: number;
  gsc_impressions?: number;
  gsc_ctr?: number;
  gsc_position?: number;
  gsc_match_confidence?: number;

  // GA4 metrics
  ga4_sessions?: number;
  ga4_revenue?: number;
  ga4_transactions?: number;
  ga4_conversion_rate?: number;
  ga4_match_confidence?: number;

  // Market metrics
  market_price_median?: number;
  market_competitor_count?: number;
  price_position?: 'below' | 'at' | 'above' | 'lowest' | 'highest';
  market_match_confidence?: number;

  // Metadata
  is_aggregated: boolean;
  child_count: number;
  metrics_date: Date;
  last_updated: Date;
  user_id: string;
}

export interface UnmatchedMetric {
  source: 'gsc' | 'ga4' | 'market' | 'merchant';
  identifier: string;
  identifier_type: 'url' | 'path' | 'gtin' | 'sku';
  metrics: Record<string, any>;
  match_attempts: number;
  resolved: boolean;
  user_id: string;
}

export interface MetricMapping {
  source_identifier: string;
  source_type: 'url' | 'path' | 'gtin' | 'sku';
  entity_type: 'node' | 'product';
  entity_id: string;
  confidence: number;
  active: boolean;
  created_by: string;
}

export interface MatchHistory {
  source: 'gsc' | 'ga4' | 'market' | 'merchant';
  identifier: string;
  match_strategy: string;
  matched_entity_type?: 'node' | 'product';
  matched_entity_id?: string;
  confidence?: number;
  success: boolean;
  error_reason?: string;
  processing_time_ms?: number;
  user_id: string;
}

export interface GSCMetric {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
}

export interface GA4Metric {
  page_path: string;
  sessions: number;
  users: number;
  revenue: number;
  transactions: number;
  conversion_rate: number;
  bounce_rate: number;
  date: string;
}

export interface MarketMetric {
  gtin: string;
  median_price: number;
  competitor_count: number;
  lowest_price: number;
  highest_price: number;
  date: string;
}

export interface AggregatedMetrics {
  node_id: string;
  clicks: number;
  impressions: number;
  revenue: number;
  sessions: number;
  transactions: number;
  avg_position: number;
  avg_conversion_rate: number;
  product_count: number;
  child_node_count: number;
  confidence: number;
}
