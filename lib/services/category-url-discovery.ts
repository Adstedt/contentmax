import { createServerSupabaseClient } from '@/lib/external/supabase/server';

interface DiscoveredCategory {
  categoryPath: string;
  url: string;
  metaTitle?: string;
  metaDescription?: string;
  confidence: number;
}

export class CategoryUrlDiscovery {
  private baseUrl: string = '';
  private discoveredUrls: Map<string, DiscoveredCategory> = new Map();

  /**
   * Discover category URLs from product URLs and sitemap
   */
  async discoverCategoryUrls(productUrls: string[], sitemapUrl?: string): Promise<Map<string, DiscoveredCategory>> {
    // Extract base URL from products
    this.extractBaseUrl(productUrls);

    // Method 1: Analyze product URL patterns to find category pages
    await this.analyzeProductUrlPatterns(productUrls);

    // Method 2: Check sitemap for category pages
    if (sitemapUrl || this.baseUrl) {
      await this.checkSitemap(sitemapUrl || `${this.baseUrl}/sitemap.xml`);
    }

    // Method 3: Try common category URL patterns
    await this.tryCommonPatterns();

    return this.discoveredUrls;
  }

  /**
   * Extract base URL from product URLs
   */
  private extractBaseUrl(productUrls: string[]): void {
    for (const url of productUrls) {
      if (url) {
        try {
          const urlObj = new URL(url);
          this.baseUrl = `${urlObj.protocol}//${urlObj.host}`;
          break;
        } catch (e) {
          // Invalid URL, continue
        }
      }
    }
  }

  /**
   * Analyze product URLs to find category page patterns
   */
  private async analyzeProductUrlPatterns(productUrls: string[]): Promise<void> {
    const pathSegments = new Map<string, number>();

    // Count occurrences of path segments
    for (const url of productUrls) {
      if (!url) continue;

      try {
        const urlObj = new URL(url);
        const parts = urlObj.pathname.split('/').filter(Boolean);

        // Usually categories are in the first 1-3 segments
        for (let i = 0; i < Math.min(parts.length - 1, 3); i++) {
          const segment = parts.slice(0, i + 1).join('/');
          pathSegments.set(segment, (pathSegments.get(segment) || 0) + 1);
        }
      } catch (e) {
        // Invalid URL
      }
    }

    // Segments that appear frequently are likely category pages
    for (const [segment, count] of pathSegments.entries()) {
      if (count >= 3) { // At least 3 products in this path
        const potentialUrl = `${this.baseUrl}/${segment}`;

        // Verify if this URL actually exists
        const exists = await this.verifyUrl(potentialUrl);
        if (exists) {
          this.discoveredUrls.set(segment, {
            categoryPath: segment,
            url: potentialUrl,
            confidence: Math.min(count / productUrls.length, 1)
          });
        }
      }
    }
  }

  /**
   * Check sitemap for category pages
   */
  private async checkSitemap(sitemapUrl: string): Promise<void> {
    try {
      const response = await fetch(sitemapUrl);
      if (!response.ok) return;

      const sitemapXml = await response.text();

      // Parse URLs from sitemap
      const urlMatches = sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/gi);

      for (const match of urlMatches) {
        const url = match[1];

        // Look for URLs that might be category pages
        if (this.looksLikeCategoryUrl(url)) {
          const urlObj = new URL(url);
          const path = urlObj.pathname.replace(/^\/|\/$/g, '');

          if (!this.discoveredUrls.has(path)) {
            this.discoveredUrls.set(path, {
              categoryPath: path,
              url: url,
              confidence: 0.7 // Medium confidence from sitemap
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch sitemap:', error);
    }
  }

  /**
   * Try common category URL patterns
   */
  private async tryCommonPatterns(): Promise<void> {
    const commonPatterns = [
      'category',
      'categories',
      'shop',
      'products',
      'collections',
      'catalog'
    ];

    // Get known category names from database
    const supabase = await createServerSupabaseClient();
    const { data: nodes } = await supabase
      .from('taxonomy_nodes')
      .select('title, path')
      .limit(100);

    if (!nodes) return;

    for (const node of nodes) {
      const slug = this.slugify(node.title);

      // Try different URL patterns
      for (const pattern of commonPatterns) {
        const potentialUrls = [
          `${this.baseUrl}/${pattern}/${slug}`,
          `${this.baseUrl}/${slug}`,
          `${this.baseUrl}/shop/${slug}`,
        ];

        for (const url of potentialUrls) {
          const exists = await this.verifyUrl(url);
          if (exists) {
            this.discoveredUrls.set(node.path, {
              categoryPath: node.path,
              url: url,
              confidence: 0.5 // Lower confidence for pattern matching
            });
            break;
          }
        }
      }
    }
  }

  /**
   * Check if URL looks like a category page
   */
  private looksLikeCategoryUrl(url: string): boolean {
    const categoryIndicators = [
      '/category/',
      '/categories/',
      '/shop/',
      '/products/',
      '/collections/',
      '/catalog/'
    ];

    const productIndicators = [
      '/product/',
      '/item/',
      '/p/',
      '.html',
      'sku=',
      'id='
    ];

    const urlLower = url.toLowerCase();

    // Check if it contains category indicators
    const hasCategory = categoryIndicators.some(ind => urlLower.includes(ind));

    // Make sure it's not a product page
    const isProduct = productIndicators.some(ind => urlLower.includes(ind));

    return hasCategory && !isProduct;
  }

  /**
   * Verify if a URL actually exists (returns 200)
   */
  private async verifyUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentMachine/1.0)',
        },
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert text to URL slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Update taxonomy nodes with discovered URLs
   */
  async updateTaxonomyWithDiscoveredUrls(): Promise<number> {
    const supabase = await createServerSupabaseClient();
    let updatedCount = 0;

    for (const [path, discovery] of this.discoveredUrls.entries()) {
      const { error } = await supabase
        .from('taxonomy_nodes')
        .update({
          url: discovery.url,
          meta_title: discovery.metaTitle,
          meta_description: discovery.metaDescription
        })
        .eq('path', path);

      if (!error) {
        updatedCount++;
      }
    }

    return updatedCount;
  }
}