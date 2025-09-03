export interface GA4Metrics {
  url: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  revenue: number;
  transactions: number;
  conversionRate: number;
  averageOrderValue: number;
  sessions: number;
  bounceRate: number;
  engagementRate: number;
  averageEngagementTime: number;
  eventsPerSession: number;
  newUsers: number;
  totalUsers: number;
}

export interface GA4Config {
  propertyId: string;
  serviceAccountKey?: string;
  serviceAccountPath?: string;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  rateLimit?: {
    maxConcurrent: number;
    interval: number;
  };
}

export interface GA4BatchRequest {
  urls: string[];
  startDate: string;
  endDate: string;
  metrics?: string[];
  dimensions?: string[];
}

export interface GA4Error extends Error {
  code: string;
  statusCode?: number;
  details?: any;
  quotaExceeded?: boolean;
}

export interface GA4CacheEntry {
  data: GA4Metrics;
  timestamp: number;
  ttl: number;
}

export interface GA4RateLimitConfig {
  maxRequestsPerSecond: number;
  maxConcurrent: number;
  retryDelay: number;
  maxRetries: number;
}

export interface GA4Dimension {
  name: string;
  value: string;
}

export interface GA4Metric {
  name: string;
  value: number;
}

export interface GA4ReportRow {
  dimensionValues: GA4Dimension[];
  metricValues: GA4Metric[];
}

export interface GA4ReportResponse {
  rows?: GA4ReportRow[];
  metadata?: any;
  propertyQuota?: {
    tokensPerDay: {
      consumed: number;
      remaining: number;
    };
    tokensPerHour: {
      consumed: number;
      remaining: number;
    };
  };
}

export const GA4_METRICS = {
  ECOMMERCE: [
    'totalRevenue',
    'transactions',
    'ecommercePurchases',
    'averagePurchaseRevenue',
    'purchaseToViewRate'
  ],
  ENGAGEMENT: [
    'sessions',
    'bounceRate',
    'engagementRate',
    'averageSessionDuration',
    'screenPageViews',
    'screenPageViewsPerSession',
    'eventCount'
  ],
  USER: [
    'totalUsers',
    'newUsers',
    'activeUsers',
    'userEngagementDuration'
  ]
} as const;

export const GA4_DIMENSIONS = {
  PAGE: 'landingPagePlusQueryString',
  DATE: 'date',
  DEVICE: 'deviceCategory',
  SOURCE: 'sessionSource',
  MEDIUM: 'sessionMedium',
  CAMPAIGN: 'sessionCampaignName'
} as const;