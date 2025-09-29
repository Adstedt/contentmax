import { XMLParser } from 'fast-xml-parser';

export interface ProductData {
  id: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  additionalImageLinks?: string[];
  price: {
    value: number;
    currency: string;
  };
  salePrice?: {
    value: number;
    currency: string;
  };
  availability: 'in stock' | 'out of stock' | 'preorder' | 'backorder';
  brand: string;
  gtin?: string;
  mpn?: string;
  productType?: string[];
  googleProductCategory?: string;
  customAttributes?: Record<string, any>;
  condition?: string;
  channel?: string;
  contentLanguage?: string;
  targetCountry?: string;
}

export interface ParsedFeed {
  products: ProductData[];
  totalCount: number;
  categories: Map<string, CategoryInfo>;
  brands: Map<string, number>;
}

export interface CategoryInfo {
  name: string;
  productCount: number;
  productIds: Set<string>;
  path?: string[];
}

export class ProductFeedParser {
  private products: Map<string, ProductData> = new Map();
  private categoryMap: Map<string, CategoryInfo> = new Map();
  private brandMap: Map<string, number> = new Map();

  async parseFeed(feedData: any, format: 'xml' | 'json' | 'api'): Promise<ParsedFeed> {
    if (format === 'xml') {
      return this.parseXMLFeed(feedData);
    } else if (format === 'json') {
      return this.parseJSONFeed(feedData);
    } else {
      return this.parseAPIResponse(feedData);
    }
  }

  private parseXMLFeed(xmlData: string): ParsedFeed {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      parseTagValue: true,
      trimValues: true,
    });

    const parsed = parser.parse(xmlData);
    const items = this.extractItemsFromXML(parsed);
    
    return this.processProducts(items);
  }

  private extractItemsFromXML(parsed: any): any[] {
    // Handle different XML structures
    if (parsed.rss?.channel?.item) {
      return Array.isArray(parsed.rss.channel.item) 
        ? parsed.rss.channel.item 
        : [parsed.rss.channel.item];
    } else if (parsed.feed?.entry) {
      return Array.isArray(parsed.feed.entry)
        ? parsed.feed.entry
        : [parsed.feed.entry];
    } else if (parsed.products?.product) {
      return Array.isArray(parsed.products.product)
        ? parsed.products.product
        : [parsed.products.product];
    }
    
    return [];
  }

  private parseJSONFeed(jsonData: any): ParsedFeed {
    const products = Array.isArray(jsonData) ? jsonData : (jsonData.products || []);
    return this.processProducts(products);
  }

  private parseAPIResponse(apiData: any): ParsedFeed {
    const products = apiData.products || [];
    return this.processProducts(products);
  }

  private processProducts(products: any[]): ParsedFeed {
    const processed: ProductData[] = [];
    
    this.categoryMap.clear();
    this.brandMap.clear();
    this.products.clear();

    for (const product of products) {
      const productData = this.normalizeProduct(product);
      if (productData) {
        processed.push(productData);
        this.products.set(productData.id, productData);
        
        // Map to categories
        this.mapProductToCategories(productData);
        
        // Track brands
        if (productData.brand) {
          this.brandMap.set(
            productData.brand,
            (this.brandMap.get(productData.brand) || 0) + 1
          );
        }
      }
    }

    return {
      products: processed,
      totalCount: processed.length,
      categories: this.categoryMap,
      brands: this.brandMap,
    };
  }

  private normalizeProduct(product: any): ProductData | null {
    try {
      // Handle different field naming conventions
      const id = product.id || product['g:id'] || product.sku || product.offerId;
      const title = product.title || product['g:title'] || product.name;
      
      if (!id || !title) {
        console.warn('Product missing required fields:', { id, title });
        return null;
      }

      return {
        id: String(id),
        title: String(title),
        description: product.description || product['g:description'] || '',
        link: product.link || product['g:link'] || product.url || '',
        imageLink: product.imageLink || product['g:image_link'] || product.image || '',
        additionalImageLinks: this.parseAdditionalImages(product),
        price: this.parsePrice(product.price || product['g:price']),
        salePrice: product.salePrice || product['g:sale_price'] 
          ? this.parsePrice(product.salePrice || product['g:sale_price'])
          : undefined,
        availability: this.parseAvailability(
          product.availability || product['g:availability']
        ),
        brand: product.brand || product['g:brand'] || '',
        gtin: product.gtin || product['g:gtin'],
        mpn: product.mpn || product['g:mpn'],
        productType: this.parseProductType(product),
        googleProductCategory: product.googleProductCategory || product['g:google_product_category'],
        customAttributes: this.extractCustomAttributes(product),
        condition: product.condition || product['g:condition'],
        channel: product.channel,
        contentLanguage: product.contentLanguage,
        targetCountry: product.targetCountry,
      };
    } catch (error) {
      console.error('Error normalizing product:', error, product);
      return null;
    }
  }

  private parseAdditionalImages(product: any): string[] | undefined {
    const images = product.additionalImageLinks || 
                  product['g:additional_image_link'] || 
                  product.additionalImages;
    
    if (!images) return undefined;
    
    if (Array.isArray(images)) {
      return images.map(String);
    } else if (typeof images === 'string') {
      return images.split(',').map(s => s.trim());
    }
    
    return undefined;
  }

  private parsePrice(priceValue: any): { value: number; currency: string } {
    if (!priceValue) {
      return { value: 0, currency: 'USD' };
    }

    if (typeof priceValue === 'object') {
      return {
        value: parseFloat(priceValue.value || priceValue.amount || 0),
        currency: priceValue.currency || 'USD',
      };
    }

    // Parse string prices like "19.99 USD"
    const match = String(priceValue).match(/([0-9.]+)\s*([A-Z]{3})?/);
    if (match) {
      return {
        value: parseFloat(match[1]),
        currency: match[2] || 'USD',
      };
    }

    return { value: 0, currency: 'USD' };
  }

  private parseAvailability(
    availability: any
  ): 'in stock' | 'out of stock' | 'preorder' | 'backorder' {
    const avail = String(availability).toLowerCase();
    
    if (avail.includes('in stock') || avail === 'in_stock') {
      return 'in stock';
    } else if (avail.includes('out of stock') || avail === 'out_of_stock') {
      return 'out of stock';
    } else if (avail.includes('preorder') || avail === 'preorder') {
      return 'preorder';
    } else if (avail.includes('backorder') || avail === 'backorder') {
      return 'backorder';
    }
    
    return 'out of stock';
  }

  private parseProductType(product: any): string[] | undefined {
    const productType = product.productType || 
                       product['g:product_type'] || 
                       product.category;
    
    if (!productType) return undefined;
    
    if (Array.isArray(productType)) {
      return productType.map(String);
    } else if (typeof productType === 'string') {
      // Handle hierarchical categories like "Home > Kitchen > Appliances"
      if (productType.includes('>')) {
        return productType.split('>').map(s => s.trim());
      }
      return [productType];
    }
    
    return undefined;
  }

  private extractCustomAttributes(product: any): Record<string, any> {
    const customAttrs: Record<string, any> = {};
    
    // Extract any g: prefixed attributes not already handled
    for (const key in product) {
      if (key.startsWith('g:') && !this.isStandardAttribute(key)) {
        customAttrs[key.replace('g:', '')] = product[key];
      }
    }
    
    if (product.customAttributes) {
      Object.assign(customAttrs, product.customAttributes);
    }
    
    return Object.keys(customAttrs).length > 0 ? customAttrs : {};
  }

  private isStandardAttribute(key: string): boolean {
    const standardAttrs = [
      'g:id', 'g:title', 'g:description', 'g:link', 'g:image_link',
      'g:additional_image_link', 'g:price', 'g:sale_price', 'g:availability',
      'g:brand', 'g:gtin', 'g:mpn', 'g:product_type', 'g:google_product_category',
      'g:condition',
    ];
    return standardAttrs.includes(key);
  }

  private mapProductToCategories(product: ProductData): void {
    // Extract category from URL pattern
    const urlCategory = this.extractCategoryFromUrl(product.link);
    
    // Use product type hierarchy
    const productTypes = product.productType || [];
    
    // Use Google product category
    const googleCategory = product.googleProductCategory;
    
    // Combine all category signals
    const allCategories = new Set<string>();
    
    if (urlCategory) allCategories.add(urlCategory);
    productTypes.forEach(cat => allCategories.add(cat));
    if (googleCategory) allCategories.add(googleCategory);
    
    allCategories.forEach((category) => {
      if (!this.categoryMap.has(category)) {
        this.categoryMap.set(category, {
          name: category,
          productCount: 0,
          productIds: new Set(),
          path: category.includes('>') 
            ? category.split('>').map(s => s.trim())
            : category.split('/').filter(Boolean),
        });
      }
      
      const categoryInfo = this.categoryMap.get(category)!;
      categoryInfo.productCount++;
      categoryInfo.productIds.add(product.id);
    });
  }

  private extractCategoryFromUrl(url: string): string | null {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      // Common patterns: /category/subcategory/product
      // Skip the last part (usually the product slug)
      if (pathParts.length > 1) {
        const categoryParts = pathParts.slice(0, -1);
        // Filter out common non-category segments
        const filtered = categoryParts.filter(
          part => !['product', 'products', 'p', 'item', 'detail'].includes(part.toLowerCase())
        );
        
        if (filtered.length > 0) {
          return filtered.join(' > ');
        }
      }
    } catch (error) {
      // Invalid URL
    }
    
    return null;
  }

  getCategoryHierarchy(): Map<string, CategoryInfo> {
    return this.categoryMap;
  }

  getBrandDistribution(): Map<string, number> {
    return this.brandMap;
  }

  getProductById(id: string): ProductData | undefined {
    return this.products.get(id);
  }
}