export type UrlCategory = 'category' | 'brand' | 'product' | 'blog' | 'other';
export type ContentDepth = 'none' | 'thin' | 'moderate' | 'rich';

export interface SitemapInput {
  categorizedUrls: {
    category: string[];
    brand: string[];
    product: string[];
    blog: string[];
    other: string[];
  };
  totalUrls: number;
}

export interface SEOData {
  title: string;
  metaDescription: string;
  h1: string;
  h2s: string[];
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  schemaMarkup?: any[];
}

export interface ContentData {
  heroText?: string;
  mainDescription?: string;
  secondaryDescription?: string;
  faqSections?: Array<{
    question: string;
    answer: string;
  }>;
  buyingGuide?: string;
  wordCount: number;
  uniqueWordCount: number;
  readabilityScore?: number;
}

export interface CategoryData {
  productCount: number;
  subcategories: Array<{
    name: string;
    url: string;
    description?: string;
    productCount?: number;
  }>;
  breadcrumbs: string[];
  filters: Array<{
    name: string;
    description?: string;
    options: string[];
  }>;
  featuredProducts?: Array<{
    name: string;
    description: string;
  }>;
}

export interface BrandData {
  brandStory?: string;
  brandUSP?: string[];
  authorizedDealer?: boolean;
  certifications?: string[];
  whyChooseSection?: string;
}

export interface TrustSignals {
  hasReviews: boolean;
  reviewCount?: number;
  averageRating?: number;
  expertContent?: string;
  awards?: string[];
  shippingInfo?: string;
  returnPolicy?: string;
}

export interface ContentQuality {
  hasUniqueContent: boolean;
  contentDepth: ContentDepth;
  isTemplatized: boolean;
  lastModified?: Date;
  hasStructuredData: boolean;
  contentToCodeRatio: number;
}

export interface ContentGaps {
  missingMetaTitle: boolean;
  missingMetaDescription: boolean;
  missingHeroContent: boolean;
  thinDescription: boolean;
  noUSP: boolean;
  noFAQ: boolean;
  noBuyingGuide: boolean;
  noSchemaMarkup: boolean;
  templateOnly: boolean;
}

export interface PaginationData {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  nextPageUrl?: string;
  scrapedPages: number[];
}

export interface ScrapedContent {
  url: string;
  urlCategory: UrlCategory;
  seo: SEOData;
  content: ContentData;
  categoryData?: CategoryData;
  brandData?: BrandData;
  trustSignals: TrustSignals;
  quality: ContentQuality;
  gaps: ContentGaps;
  pagination?: PaginationData;
}

export interface ScrapingQueueItem {
  url: string;
  category: UrlCategory;
  priority: number;
  includePagination: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface ScrapingOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  rateLimit?: {
    maxConcurrency: number;
    interval: number;
    intervalCap: number;
  };
}

export interface ScrapingResult {
  success: boolean;
  content?: ScrapedContent;
  error?: string;
  duration?: number;
}

export interface ScrapingProgress {
  totalUrls: number;
  processedUrls: number;
  successfulUrls: number;
  failedUrls: number;
  currentUrl?: string;
  estimatedTimeRemaining?: number;
}

export interface RobotsCheck {
  allowed: boolean;
  crawlDelay?: number;
  userAgent?: string;
}