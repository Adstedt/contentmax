import { z } from 'zod';

// Product schema that works across different feed formats
export const ProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  link: z.string().url().optional(),
  price: z
    .union([
      z.string(),
      z.number(),
      z.object({
        value: z.union([z.string(), z.number()]),
        currency: z.string().optional(),
      }),
    ])
    .optional(),
  image_link: z.string().url().optional(),
  product_type: z.string().optional(),
  google_product_category: z.string().optional(),
  availability: z.string().optional(),
  brand: z.string().optional(),
  gtin: z.string().optional(),
  mpn: z.string().optional(),
  condition: z.string().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

export interface FeedMetadata {
  url: string;
  format: 'xml' | 'json' | 'csv' | 'tsv';
  totalProducts: number;
  fetchedAt: Date;
  title?: string;
  updated?: Date;
}

export class FeedFetcher {
  private readonly MAX_FEED_SIZE = 100 * 1024 * 1024; // 100MB limit
  private readonly TIMEOUT = 30000; // 30 seconds

  async fetchFromUrl(feedUrl: string): Promise<{ products: Product[]; metadata: FeedMetadata }> {
    console.log(`Fetching feed from: ${feedUrl}`);

    try {
      // Validate URL
      const url = new URL(feedUrl);

      // Detect feed format from URL or content-type
      const format = await this.detectFeedFormat(url);

      // Fetch the feed with timeout
      const response = await this.fetchWithTimeout(url.toString());

      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
      }

      // Check content size
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.MAX_FEED_SIZE) {
        throw new Error(
          `Feed too large: ${parseInt(contentLength) / 1024 / 1024}MB (max: ${this.MAX_FEED_SIZE / 1024 / 1024}MB)`
        );
      }

      const contentType = response.headers.get('content-type') || '';
      const content = await response.text();

      // Parse based on format
      let products: Product[] = [];
      let metadata: Partial<FeedMetadata> = {
        url: feedUrl,
        format,
        fetchedAt: new Date(),
      };

      if (format === 'xml' || contentType.includes('xml') || content.trim().startsWith('<?xml')) {
        const result = await this.parseXmlFeed(content);
        products = result.products;
        metadata = { ...metadata, ...result.metadata, format: 'xml' };
      } else if (
        format === 'json' ||
        contentType.includes('json') ||
        content.trim().startsWith('{') ||
        content.trim().startsWith('[')
      ) {
        const result = await this.parseJsonFeed(content);
        products = result.products;
        metadata = { ...metadata, ...result.metadata, format: 'json' };
      } else if (
        format === 'csv' ||
        format === 'tsv' ||
        contentType.includes('csv') ||
        contentType.includes('tab-separated')
      ) {
        const result = await this.parseCsvFeed(content, format === 'tsv' ? '\t' : ',');
        products = result.products;
        metadata = { ...metadata, ...result.metadata, format: format || 'csv' };
      } else {
        // Try to auto-detect
        const result = await this.autoDetectAndParse(content);
        products = result.products;
        metadata = { ...metadata, ...result.metadata };
      }

      console.log(`Successfully parsed ${products.length} products from ${metadata.format} feed`);

      return {
        products: this.normalizeProducts(products),
        metadata: metadata as FeedMetadata,
      };
    } catch (error) {
      console.error('Feed fetch error:', error);
      throw new Error(
        `Failed to fetch/parse feed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.TIMEOUT);

    try {
      // Use Node's fetch with proper configuration for server-side fetching
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/xml, application/json, text/csv, text/plain, */*',
          'User-Agent': 'ContentMax/1.0 (Feed Importer)',
          // Add headers that might be required by some servers
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        // Ensure we follow redirects
        redirect: 'follow',
        // Add next revalidate to bypass any caching issues
        next: { revalidate: 0 },
      } as any);
      return response;
    } catch (error) {
      console.error('Fetch error details:', error);
      // If fetch fails, it might be a CORS or network issue
      // Could implement a proxy here if needed
      throw new Error(`Network error: ${error instanceof Error ? error.message : 'fetch failed'}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async detectFeedFormat(url: URL): Promise<'xml' | 'json' | 'csv' | 'tsv'> {
    const pathname = url.pathname.toLowerCase();

    if (pathname.endsWith('.xml') || pathname.includes('xml')) return 'xml';
    if (pathname.endsWith('.json')) return 'json';
    if (pathname.endsWith('.csv')) return 'csv';
    if (pathname.endsWith('.tsv') || pathname.endsWith('.txt')) return 'tsv';

    // Default to XML for Google Shopping feeds
    if (url.hostname.includes('google') || pathname.includes('feed')) return 'xml';

    return 'xml'; // Default
  }

  private async parseXmlFeed(
    content: string
  ): Promise<{ products: any[]; metadata: Partial<FeedMetadata> }> {
    // For browser/Node.js compatibility, we'll use a simple XML parser
    // In production, use a proper XML parser like fast-xml-parser
    const products: any[] = [];
    const metadata: Partial<FeedMetadata> = {};

    // Extract feed title
    const titleMatch = content.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) metadata.title = titleMatch[1];

    // Extract updated date
    const updatedMatch = content.match(/<updated>([^<]+)<\/updated>/);
    if (updatedMatch) metadata.updated = new Date(updatedMatch[1]);

    // Parse products - Google Shopping Feed format
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(content)) !== null) {
      const entry = match[1];
      const product: any = {};

      // Extract common fields
      const extractField = (fieldName: string, xmlTag: string = fieldName) => {
        const regex = new RegExp(
          `<(?:g:)?${xmlTag}><!\\[CDATA\\[([^\\]]+)\\]\\]><\\/(?:g:)?${xmlTag}>|<(?:g:)?${xmlTag}>([^<]+)<\\/(?:g:)?${xmlTag}>`
        );
        const fieldMatch = entry.match(regex);
        if (fieldMatch) {
          product[fieldName] = fieldMatch[1] || fieldMatch[2];
        }
      };

      extractField('id');
      extractField('title');
      extractField('description');
      extractField('link');
      extractField('image_link');
      extractField('price');
      extractField('availability');
      extractField('brand');
      extractField('gtin');
      extractField('mpn');
      extractField('condition');
      extractField('product_type');
      extractField('google_product_category');

      // Handle additional images
      const additionalImages = entry.match(
        /<(?:g:)?additional_image_link>([^<]+)<\/(?:g:)?additional_image_link>/g
      );
      if (additionalImages) {
        product.additional_images = additionalImages.map((img: string) =>
          img.replace(/<\/?(?:g:)?additional_image_link>/g, '')
        );
      }

      if (product.id && product.title) {
        products.push(product);
      }
    }

    // Alternative format - RSS 2.0 style with Google namespace
    if (products.length === 0) {
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      while ((match = itemRegex.exec(content)) !== null) {
        const item = match[1];
        const product: any = {};

        const extractField = (fieldName: string, xmlTag: string = fieldName) => {
          // Try with g: namespace first, then without
          const patterns = [
            `<g:${xmlTag}><!\\[CDATA\\[([^\\]]+)\\]\\]><\\/g:${xmlTag}>`,
            `<g:${xmlTag}>([^<]+)<\\/g:${xmlTag}>`,
            `<${xmlTag}><!\\[CDATA\\[([^\\]]+)\\]\\]><\\/${xmlTag}>`,
            `<${xmlTag}>([^<]+)<\\/${xmlTag}>`,
          ];

          for (const pattern of patterns) {
            const regex = new RegExp(pattern);
            const fieldMatch = item.match(regex);
            if (fieldMatch) {
              product[fieldName] = fieldMatch[1] || fieldMatch[2];
              break;
            }
          }
        };

        // Extract all relevant fields
        extractField('id');
        extractField('title');
        extractField('description');
        extractField('link');
        extractField('image_link');
        extractField('price');
        extractField('sale_price');
        extractField('availability');
        extractField('brand');
        extractField('gtin');
        extractField('condition');
        extractField('product_type');
        extractField('google_product_category');
        extractField('item_group_id');
        extractField('size');
        extractField('mpn');

        if (product.id && product.title) {
          products.push(product);
        }
      }
    }

    metadata.totalProducts = products.length;
    return { products, metadata };
  }

  private async parseJsonFeed(
    content: string
  ): Promise<{ products: any[]; metadata: Partial<FeedMetadata> }> {
    try {
      const data = JSON.parse(content);
      let products: any[] = [];
      const metadata: Partial<FeedMetadata> = {};

      // Handle different JSON structures
      if (Array.isArray(data)) {
        products = data;
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products;
        metadata.title = data.title || data.name;
      } else if (data.items && Array.isArray(data.items)) {
        products = data.items;
        metadata.title = data.title || data.feed_title;
      } else if (data.feed && data.feed.entry) {
        products = data.feed.entry;
        metadata.title = data.feed.title;
        metadata.updated = data.feed.updated ? new Date(data.feed.updated) : undefined;
      } else if (data.entries) {
        products = data.entries;
      } else {
        // Try to find any array in the object
        for (const key of Object.keys(data)) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            products = data[key];
            break;
          }
        }
      }

      metadata.totalProducts = products.length;
      return { products, metadata };
    } catch (error) {
      throw new Error(
        `Invalid JSON feed: ${error instanceof Error ? error.message : 'Parse error'}`
      );
    }
  }

  private async parseCsvFeed(
    content: string,
    delimiter: string = ','
  ): Promise<{ products: any[]; metadata: Partial<FeedMetadata> }> {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) {
      throw new Error('Empty CSV feed');
    }

    // Parse header
    const headers = this.parseCsvLine(lines[0], delimiter).map((h) =>
      h.toLowerCase().trim().replace(/^"/, '').replace(/"$/, '')
    );

    const products: any[] = [];

    // Parse rows
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i], delimiter);
      if (values.length === headers.length) {
        const product: any = {};
        headers.forEach((header, index) => {
          const value = values[index]?.replace(/^"/, '').replace(/"$/, '');
          if (value) {
            // Map common CSV headers to our schema
            const mappedHeader = this.mapCsvHeader(header);
            product[mappedHeader] = value;
          }
        });

        if (product.id && product.title) {
          products.push(product);
        }
      }
    }

    return {
      products,
      metadata: {
        totalProducts: products.length,
        format: delimiter === '\t' ? 'tsv' : 'csv',
      },
    };
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  private mapCsvHeader(header: string): string {
    const mappings: Record<string, string> = {
      item_id: 'id',
      product_id: 'id',
      sku: 'id',
      name: 'title',
      product_name: 'title',
      product_title: 'title',
      category: 'product_type',
      product_category: 'product_type',
      google_category: 'google_product_category',
      image: 'image_link',
      image_url: 'image_link',
      product_image: 'image_link',
      url: 'link',
      product_url: 'link',
      product_link: 'link',
    };

    return mappings[header] || header;
  }

  private async autoDetectAndParse(
    content: string
  ): Promise<{ products: any[]; metadata: Partial<FeedMetadata> }> {
    const trimmed = content.trim();

    // Try XML
    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
      return await this.parseXmlFeed(content);
    }

    // Try JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return await this.parseJsonFeed(content);
    }

    // Try CSV/TSV
    const lines = content.split(/\r?\n/);
    if (lines.length > 1) {
      // Check if it looks like CSV or TSV
      const firstLine = lines[0];
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;

      if (tabCount > commaCount && tabCount > 2) {
        return await this.parseCsvFeed(content, '\t');
      } else if (commaCount > 2) {
        return await this.parseCsvFeed(content, ',');
      }
    }

    throw new Error('Unable to detect feed format');
  }

  private normalizeProducts(products: any[]): Product[] {
    return products.map((product) => {
      // Ensure required fields
      if (!product.id) {
        product.id =
          product.sku ||
          product.item_id ||
          product.product_id ||
          Math.random().toString(36).substr(2, 9);
      }

      if (!product.title) {
        product.title = product.name || product.product_name || 'Untitled Product';
      }

      // Normalize price
      if (product.price) {
        if (typeof product.price === 'string') {
          // Remove currency symbols and extract number
          const priceMatch = product.price.match(/[\d.]+/);
          if (priceMatch) {
            product.price = {
              value: parseFloat(priceMatch[0]),
              currency: product.currency || 'USD',
            };
          }
        } else if (typeof product.price === 'number') {
          product.price = {
            value: product.price,
            currency: product.currency || 'USD',
          };
        }
      }

      // Ensure URL fields are valid
      if (product.link && !product.link.startsWith('http')) {
        product.link = `https://${product.link}`;
      }

      if (product.image_link && !product.image_link.startsWith('http')) {
        product.image_link = `https://${product.image_link}`;
      }

      try {
        return ProductSchema.parse(product);
      } catch (error) {
        // Return with basic required fields if validation fails
        return {
          id: product.id,
          title: product.title,
          description: product.description,
          link: product.link,
          image_link: product.image_link,
          product_type: product.product_type,
          google_product_category: product.google_product_category,
          brand: product.brand,
          price: product.price,
          availability: product.availability,
          condition: product.condition,
        } as Product;
      }
    });
  }
}
