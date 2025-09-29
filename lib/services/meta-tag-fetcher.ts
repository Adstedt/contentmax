import { createServerSupabaseClient } from '@/lib/external/supabase/server';

interface MetaTags {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  canonical?: string;
}

export class MetaTagFetcher {
  private cache: Map<string, MetaTags> = new Map();

  /**
   * Fetch meta tags from a URL
   * Note: This requires server-side fetching to avoid CORS issues
   */
  async fetchMetaTags(url: string): Promise<MetaTags> {
    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentMachine/1.0; +https://contentmachine.app)',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch ${url}: ${response.status}`);
        return {};
      }

      const html = await response.text();
      const metaTags = this.extractMetaTags(html);

      // Cache the result
      this.cache.set(url, metaTags);

      return metaTags;
    } catch (error) {
      console.error(`Error fetching meta tags from ${url}:`, error);
      return {};
    }
  }

  /**
   * Extract meta tags from HTML content
   */
  private extractMetaTags(html: string): MetaTags {
    const metaTags: MetaTags = {};

    // Extract regular title tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      metaTags.title = titleMatch[1].trim();
    }

    // Extract meta description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (descMatch) {
      metaTags.description = descMatch[1].trim();
    }

    // Extract Open Graph title
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (ogTitleMatch) {
      metaTags.ogTitle = ogTitleMatch[1].trim();
    }

    // Extract Open Graph description
    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    if (ogDescMatch) {
      metaTags.ogDescription = ogDescMatch[1].trim();
    }

    // Extract canonical URL
    const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    if (canonicalMatch) {
      metaTags.canonical = canonicalMatch[1].trim();
    }

    return metaTags;
  }

  /**
   * Batch fetch and update meta tags for products
   */
  async updateProductMetaTags(productIds: string[], batchSize: number = 10): Promise<void> {
    const supabase = await createServerSupabaseClient();

    // Fetch products that need meta tags
    const { data: products, error } = await supabase
      .from('products')
      .select('id, link, meta_title, meta_description')
      .in('id', productIds)
      .is('meta_title', null)
      .not('link', 'is', null);

    if (error || !products) {
      console.error('Failed to fetch products:', error);
      return;
    }

    console.log(`Fetching meta tags for ${products.length} products...`);

    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (product) => {
          if (!product.link) return;

          const metaTags = await this.fetchMetaTags(product.link);

          if (metaTags.title || metaTags.description) {
            const { error: updateError } = await supabase
              .from('products')
              .update({
                meta_title: metaTags.ogTitle || metaTags.title || null,
                meta_description: metaTags.ogDescription || metaTags.description || null,
              })
              .eq('id', product.id);

            if (updateError) {
              console.error(`Failed to update product ${product.id}:`, updateError);
            } else {
              console.log(`Updated meta tags for product ${product.id}`);
            }
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Batch fetch and update meta tags for taxonomy nodes
   */
  async updateTaxonomyMetaTags(nodeIds: string[], batchSize: number = 10): Promise<void> {
    const supabase = await createServerSupabaseClient();

    // Fetch nodes that need meta tags
    const { data: nodes, error } = await supabase
      .from('taxonomy_nodes')
      .select('id, url, meta_title, meta_description')
      .in('id', nodeIds)
      .is('meta_title', null)
      .not('url', 'is', null);

    if (error || !nodes) {
      console.error('Failed to fetch taxonomy nodes:', error);
      return;
    }

    console.log(`Fetching meta tags for ${nodes.length} taxonomy nodes...`);

    // Process in batches
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (node) => {
          if (!node.url) return;

          const metaTags = await this.fetchMetaTags(node.url);

          if (metaTags.title || metaTags.description) {
            const { error: updateError } = await supabase
              .from('taxonomy_nodes')
              .update({
                meta_title: metaTags.ogTitle || metaTags.title || null,
                meta_description: metaTags.ogDescription || metaTags.description || null,
              })
              .eq('id', node.id);

            if (updateError) {
              console.error(`Failed to update node ${node.id}:`, updateError);
            } else {
              console.log(`Updated meta tags for node ${node.id}`);
            }
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < nodes.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Generate fallback meta tags if fetching fails
   */
  generateFallbackMetaTags(item: { title?: string; description?: string; path?: string }): MetaTags {
    const metaTags: MetaTags = {};

    if (item.title) {
      // Generate meta title
      metaTags.title = item.title.length > 60
        ? `${item.title.substring(0, 57)}...`
        : item.title;
    }

    if (item.description) {
      // Generate meta description (limit to 160 chars)
      metaTags.description = item.description.length > 160
        ? `${item.description.substring(0, 157)}...`
        : item.description;
    } else if (item.title) {
      // Fallback description
      metaTags.description = `Explore our selection of ${item.title}. Find quality products at great prices.`;
    }

    return metaTags;
  }
}