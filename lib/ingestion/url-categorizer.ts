import { ContentCategory } from '@/types/sitemap.types';

interface PatternConfig {
  patterns: RegExp[];
  category: ContentCategory;
  priority: number; // Higher priority patterns are checked first
}

const URL_PATTERNS: PatternConfig[] = [
  // Product patterns (highest priority)
  {
    category: ContentCategory.PRODUCT,
    priority: 10,
    patterns: [
      /\/product\//i,
      /\/products\//i,
      /\/p\//i,
      /\/item\//i,
      /\/pd\//i,
      /\/detail\//i,
      /\/sku\//i,
      /\/merchandise\//i,
      /\/goods\//i,
      /\/listing\//i,
      /-p-\d+/i, // Common pattern like /something-p-12345
      /\/dp\//i, // Amazon style
      /\/gp\/product\//i, // Amazon style
    ],
  },
  // Category patterns
  {
    category: ContentCategory.CATEGORY,
    priority: 8,
    patterns: [
      /\/category\//i,
      /\/categories\//i,
      /\/c\//i,
      /\/collections?\//i,
      /\/shop\//i,
      /\/catalog\//i,
      /\/browse\//i,
      /\/department\//i,
      /\/section\//i,
      /\/store\//i,
      /\/deals(\/|$)/i,
      /\/sale(\/|$)/i,
      /\/clearance(\/|$)/i,
    ],
  },
  // Brand patterns
  {
    category: ContentCategory.BRAND,
    priority: 7,
    patterns: [
      /\/brand\//i,
      /\/brands\//i,
      /\/manufacturer\//i,
      /\/designer\//i,
      /\/vendor\//i,
      /\/supplier\//i,
      /\/maker\//i,
      /\/label\//i,
      /\/company\//i,
    ],
  },
  // Blog patterns (higher priority than products for article paths)
  {
    category: ContentCategory.BLOG,
    priority: 9,
    patterns: [
      /\/blog\//i,
      /\/blogs\//i,
      /\/news\//i,
      /\/articles?\//i,
      /\/posts?\//i,
      /\/story\//i,
      /\/stories\//i,
      /\/press\//i,
      /\/media\//i,
      /\/updates?\//i,
      /\/insights?\//i,
      /\/resources?\//i,
      /\/guides?\//i,
      /\/tutorials?\//i,
      /\/tips?\//i,
      /\/advice\//i,
      /\/how-to\//i,
      /\/faq\//i,
      /\/help\//i,
      /\/support\//i,
      /\/learn\//i,
      /\/knowledge\//i,
      /\/education\//i,
      /\/\d{4}\/\d{2}\//i, // Date patterns like /2024/01/
    ],
  },
];

// Additional heuristics for better categorization
const PRODUCT_INDICATORS = [
  /[-_]sku[-_]/i,
  /[-_]id[-_]/i,
  /[-_]pid[-_]/i,
  /[-_]productid[-_]/i,
  /\?.*product/i,
  /\?.*item/i,
  /\?.*sku/i,
  /\.html?$/i, // Often product pages end in .html
];

const CATEGORY_INDICATORS = [
  /\?.*category/i,
  /\?.*cat/i,
  /\?.*collection/i,
  /\?.*filter/i,
  /\?.*sort/i,
  /\?.*page=/i,
];

const EXCLUDED_PATTERNS = [
  /\.(jpg|jpeg|png|gif|svg|webp|ico|pdf|doc|docx|xls|xlsx|zip|rar)$/i,
  /\/cdn-cgi\//i,
  /\/wp-content\//i,
  /\/wp-admin\//i,
  /\/admin\//i,
  /\/api\//i,
  /\/ajax\//i,
  /\/cart(\/|$)/i,
  /\/checkout(\/|$)/i,
  /\/account(\/|$)/i,
  /\/login(\/|$)/i,
  /\/register(\/|$)/i,
  /\/wishlist(\/|$)/i,
  /\/compare(\/|$)/i,
  /\/search(\/|$)/i,
  /\/404/i,
  /\/error/i,
  /\/terms/i,
  /\/privacy/i,
  /\/policy/i,
  /\/legal/i,
  /\/sitemap/i,
  /\/robots\.txt/i,
];

export function categorizeUrl(url: string): ContentCategory {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    const fullUrl = url.toLowerCase();

    // Check if URL should be excluded
    if (EXCLUDED_PATTERNS.some(pattern => pattern.test(fullUrl))) {
      return ContentCategory.OTHER;
    }

    // Sort patterns by priority
    const sortedPatterns = [...URL_PATTERNS].sort((a, b) => b.priority - a.priority);

    // Check URL against patterns
    for (const config of sortedPatterns) {
      if (config.patterns.some(pattern => pattern.test(path))) {
        return config.category;
      }
    }

    // Apply additional heuristics
    if (PRODUCT_INDICATORS.some(pattern => pattern.test(fullUrl))) {
      return ContentCategory.PRODUCT;
    }

    if (CATEGORY_INDICATORS.some(pattern => pattern.test(fullUrl))) {
      return ContentCategory.CATEGORY;
    }

    // Check for homepage
    if (path === '/' || path === '') {
      return ContentCategory.OTHER;
    }

    // Check path depth - deeper paths are often products
    const pathSegments = path.split('/').filter(Boolean);
    if (pathSegments.length >= 3) {
      // Deep paths with numbers often indicate products
      if (/\d+/.test(pathSegments[pathSegments.length - 1])) {
        return ContentCategory.PRODUCT;
      }
    }

    // Default to OTHER
    return ContentCategory.OTHER;
  } catch (_error) {
    // Invalid URL
    return ContentCategory.OTHER;
  }
}

export function categorizeUrls(urls: string[]): Map<string, ContentCategory> {
  const categorized = new Map<string, ContentCategory>();
  
  for (const url of urls) {
    categorized.set(url, categorizeUrl(url));
  }
  
  return categorized;
}

export function getCategoryStatistics(urls: string[]): Record<ContentCategory, number> {
  const stats: Record<ContentCategory, number> = {
    [ContentCategory.PRODUCT]: 0,
    [ContentCategory.CATEGORY]: 0,
    [ContentCategory.BRAND]: 0,
    [ContentCategory.BLOG]: 0,
    [ContentCategory.OTHER]: 0,
  };

  for (const url of urls) {
    const category = categorizeUrl(url);
    stats[category]++;
  }

  return stats;
}

// Advanced categorization with confidence score
export interface CategorizedUrl {
  url: string;
  category: ContentCategory;
  confidence: number; // 0-1 confidence score
  matchedPatterns: string[];
}

export function categorizeUrlWithConfidence(url: string): CategorizedUrl {
  const matchedPatterns: string[] = [];
  let highestPriority = -1;
  let matchedCategory = ContentCategory.OTHER;
  let matchCount = 0;

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    const fullUrl = url.toLowerCase();

    // Check exclusions first
    for (const pattern of EXCLUDED_PATTERNS) {
      if (pattern.test(path) || pattern.test(fullUrl)) {
        matchedPatterns.push(`Excluded: ${pattern.source}`);
        return {
          url,
          category: ContentCategory.OTHER,
          confidence: 1.0,
          matchedPatterns,
        };
      }
    }

    // Check all patterns and collect matches
    for (const config of URL_PATTERNS) {
      for (const pattern of config.patterns) {
        if (pattern.test(path)) {
          matchCount++;
          matchedPatterns.push(`${config.category}: ${pattern.source}`);
          if (config.priority > highestPriority) {
            highestPriority = config.priority;
            matchedCategory = config.category;
          }
        }
      }
    }

    // Check additional indicators
    for (const indicator of PRODUCT_INDICATORS) {
      if (indicator.test(fullUrl)) {
        matchCount++;
        matchedPatterns.push(`Product indicator: ${indicator.source}`);
        if (matchedCategory === ContentCategory.OTHER) {
          matchedCategory = ContentCategory.PRODUCT;
        }
      }
    }

    for (const indicator of CATEGORY_INDICATORS) {
      if (indicator.test(fullUrl)) {
        matchCount++;
        matchedPatterns.push(`Category indicator: ${indicator.source}`);
        if (matchedCategory === ContentCategory.OTHER) {
          matchedCategory = ContentCategory.CATEGORY;
        }
      }
    }

    // Calculate confidence based on match count and priority
    let confidence = 0.5; // Base confidence
    if (matchCount > 0) {
      confidence = Math.min(0.5 + (matchCount * 0.15) + (highestPriority * 0.05), 1.0);
    }

    return {
      url,
      category: matchedCategory,
      confidence,
      matchedPatterns,
    };
  } catch (_error) {
    return {
      url,
      category: ContentCategory.OTHER,
      confidence: 0.1,
      matchedPatterns: ['Invalid URL'],
    };
  }
}