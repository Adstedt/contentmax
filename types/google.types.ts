// Google OAuth Types
export interface OAuth2Tokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

export interface GoogleIntegration {
  id: string;
  userId: string;
  email: string;
  refreshToken: string; // Encrypted
  accessToken?: string; // Encrypted
  tokenExpiry?: Date;
  connectedAt: Date;
  lastSync?: Date;
}

// Google Search Console Types
export interface GSCMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface QueryData extends GSCMetrics {
  query: string;
}

export interface PageData extends GSCMetrics {
  page: string;
}

export interface DailyMetric extends GSCMetrics {
  date: string;
}

export interface GSCPerformanceData extends GSCMetrics {
  queries: QueryData[];
  pages: PageData[];
  countries: CountryData[];
  devices: DeviceData[];
  dailyData: DailyMetric[];
}

export interface CountryData extends GSCMetrics {
  country: string;
}

export interface DeviceData extends GSCMetrics {
  device: 'desktop' | 'mobile' | 'tablet';
}

export interface CoverageIssue {
  url: string;
  type: string;
  severity: 'error' | 'warning';
  lastCrawled?: Date;
  firstDetected: Date;
}

export interface MobileIssue {
  url: string;
  issue: string;
  severity: 'error' | 'warning';
  lastChecked: Date;
}

export interface GSCQueryOptions {
  startDate: string;
  endDate: string;
  dimensions?: Array<'page' | 'query' | 'country' | 'device' | 'searchAppearance'>;
  dimensionFilterGroups?: DimensionFilterGroup[];
  aggregationType?: 'auto' | 'byPage' | 'byProperty';
  rowLimit?: number;
  startRow?: number;
  dataState?: 'final' | 'all';
}

export interface DimensionFilterGroup {
  filters: DimensionFilter[];
  groupType?: 'and' | 'or';
}

export interface DimensionFilter {
  dimension: 'page' | 'query' | 'country' | 'device' | 'searchAppearance';
  operator?: 'equals' | 'contains' | 'notContains' | 'notEquals';
  expression?: string;
}

export interface GSCResponse {
  rows?: GSCRow[];
  responseAggregationType?: string;
}

export interface GSCRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export interface GSCData {
  id: string;
  projectId: string;
  url: string;
  date: Date;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  data?: any; // JSONB additional data
  createdAt: Date;
}

export interface IntegrationSettingsProps {
  isConnected: boolean;
  connectedEmail?: string;
  sites?: string[];
  lastSync?: Date;
  syncFrequency?: 'hourly' | 'daily' | 'weekly' | 'manual';
  dataRetention?: number; // Days to keep data
}

// Rate Limiting
export interface RateLimitConfig {
  requestsPerDay: number;
  requestsPerMinute: number;
  rowsPerRequest: number;
  dimensionsPerRequest: number;
  dateRange: number; // Months of data available
}

export const GSC_LIMITS: RateLimitConfig = {
  requestsPerDay: 1200,
  requestsPerMinute: 20,
  rowsPerRequest: 25000,
  dimensionsPerRequest: 5,
  dateRange: 16,
};

// Error Types
export class GSCError extends Error {
  constructor(
    message: string,
    public code: GSCErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'GSCError';
  }
}

export enum GSCErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  NO_ACCESS = 'NO_ACCESS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number; // Time to live in seconds
}

export interface GSCCacheKey {
  projectId: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string;
}