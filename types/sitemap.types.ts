export enum ContentCategory {
  PRODUCT = 'product',
  CATEGORY = 'category',
  BRAND = 'brand',
  BLOG = 'blog',
  OTHER = 'other',
}

export interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  category?: ContentCategory;
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod?: string;
}

export interface ParsedSitemap {
  type: 'urlset' | 'sitemapindex';
  entries: SitemapEntry[];
  indexEntries?: SitemapIndexEntry[];
}

export interface SitemapParseOptions {
  categorizeUrls?: boolean;
  fetchChildSitemaps?: boolean;
  maxUrls?: number;
  streaming?: boolean;
}

export interface SitemapParseResult {
  success: boolean;
  entries: SitemapEntry[];
  totalUrls: number;
  categoryCounts: Record<ContentCategory, number>;
  errors?: string[];
}

export interface DatabaseSitemapEntry {
  id: string;
  project_id: string;
  url: string;
  category: string;
  last_modified?: Date;
  change_frequency?: string;
  priority?: number;
  imported_at: Date;
}