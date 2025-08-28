import { Page } from 'playwright';
import { CategoryData } from '@/types/scraper.types';

export class CategoryExtractor {
  async extract(page: Page): Promise<CategoryData> {
    const categoryData: CategoryData = {
      productCount: 0,
      subcategories: [],
      breadcrumbs: [],
      filters: []
    };

    try {
      // Extract product count
      categoryData.productCount = await this.extractProductCount(page);

      // Extract subcategories
      categoryData.subcategories = await this.extractSubcategories(page);

      // Extract breadcrumbs
      categoryData.breadcrumbs = await this.extractBreadcrumbs(page);

      // Extract filters
      categoryData.filters = await this.extractFilters(page);

      // Extract featured products
      categoryData.featuredProducts = await this.extractFeaturedProducts(page);

    } catch (error) {
      console.error('Error extracting category data:', error);
    }

    return categoryData;
  }

  private async extractProductCount(page: Page): Promise<number> {
    const countSelectors = [
      '[class*="product-count"]',
      '[class*="result-count"]',
      '[class*="total-products"]',
      '.showing-results',
      '.woocommerce-result-count',
      '[data-testid*="product-count"]',
      '.collection-count',
      '.toolbar-amount'
    ];

    for (const selector of countSelectors) {
      try {
        const text = await page.textContent(selector);
        if (text) {
          // Extract numbers from text like "Showing 1-24 of 156 results"
          const matches = text.match(/(\d+)\s*(products?|items?|results?)/i) ||
                         text.match(/of\s+(\d+)/i) ||
                         text.match(/(\d+)\s+total/i);
          
          if (matches && matches[1]) {
            return parseInt(matches[1]);
          }
        }
      } catch {
        continue;
      }
    }

    // Fallback: count actual product elements
    const productSelectors = [
      '[class*="product-item"]',
      '[class*="product-card"]',
      '.product',
      'article.product',
      '[data-testid*="product"]'
    ];

    for (const selector of productSelectors) {
      try {
        const products = await page.$$(selector);
        if (products.length > 0) {
          return products.length;
        }
      } catch {
        continue;
      }
    }

    return 0;
  }

  private async extractSubcategories(page: Page): Promise<CategoryData['subcategories']> {
    const subcategories: CategoryData['subcategories'] = [];
    
    const subcatSelectors = [
      '[class*="subcategor"]',
      '[class*="child-categor"]',
      '[class*="sub-cat"]',
      '.category-children',
      '.subcategory-list',
      '[class*="refinement"] a',
      '.category-nav li a',
      '.category-tree a'
    ];

    for (const selector of subcatSelectors) {
      try {
        const elements = await page.$$(selector);
        
        for (const element of elements) {
          const name = await element.textContent();
          const url = await element.getAttribute('href');
          
          if (name && url) {
            // Get description if available
            const description = await element.getAttribute('title') || 
                              await element.getAttribute('data-description') || 
                              undefined;
            
            // Try to get product count
            const countText = await element.textContent();
            const countMatch = countText?.match(/\((\d+)\)/);
            const productCount = countMatch ? parseInt(countMatch[1]) : undefined;
            
            subcategories.push({
              name: name.replace(/\(\d+\)/, '').trim(),
              url: this.normalizeUrl(url, page.url()),
              description,
              productCount
            });
          }
        }
        
        if (subcategories.length > 0) break;
      } catch {
        continue;
      }
    }

    return subcategories;
  }

  private async extractBreadcrumbs(page: Page): Promise<string[]> {
    const breadcrumbSelectors = [
      '[class*="breadcrumb"] a',
      '[itemtype*="BreadcrumbList"] [itemprop="name"]',
      'nav[aria-label="breadcrumb"] a',
      '.breadcrumbs a',
      '.woocommerce-breadcrumb a',
      '[data-testid*="breadcrumb"] a'
    ];

    for (const selector of breadcrumbSelectors) {
      try {
        const breadcrumbs = await page.$$eval(selector, elements =>
          elements.map(el => el.textContent?.trim() || '').filter(Boolean)
        );
        
        if (breadcrumbs.length > 0) {
          return breadcrumbs;
        }
      } catch {
        continue;
      }
    }

    // Fallback: try to extract from URL path
    try {
      const url = new URL(page.url());
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        return pathParts.map(part => 
          part.replace(/-/g, ' ').replace(/_/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
        );
      }
    } catch {
      // Ignore URL parsing errors
    }

    return [];
  }

  private async extractFilters(page: Page): Promise<CategoryData['filters']> {
    const filters: CategoryData['filters'] = [];
    
    const filterSelectors = [
      '[class*="filter-group"]',
      '[class*="facet"]',
      '[class*="refinement"]',
      '.filter-options',
      '.layered-nav',
      '[data-testid*="filter"]',
      '.sidebar-filter',
      '.product-filter'
    ];

    for (const selector of filterSelectors) {
      try {
        const filterGroups = await page.$$(selector);
        
        for (const group of filterGroups) {
          // Get filter name
          const nameElement = await group.$('[class*="title"], [class*="header"], h3, h4');
          const name = await nameElement?.textContent();
          
          if (name) {
            // Get filter options
            const optionElements = await group.$$('input[type="checkbox"] + label, ' +
                                                  'input[type="radio"] + label, ' +
                                                  'option, ' +
                                                  'a[class*="option"], ' +
                                                  'li a');
            
            const options: string[] = [];
            for (const optionEl of optionElements) {
              const optionText = await optionEl.textContent();
              if (optionText) {
                options.push(optionText.replace(/\(\d+\)/, '').trim());
              }
            }
            
            if (options.length > 0) {
              filters.push({
                name: name.trim(),
                options: [...new Set(options)] // Remove duplicates
              });
            }
          }
        }
        
        if (filters.length > 0) break;
      } catch {
        continue;
      }
    }

    return filters;
  }

  private async extractFeaturedProducts(page: Page): Promise<CategoryData['featuredProducts']> {
    const products: Array<{ name: string; description: string }> = [];
    
    const featuredSelectors = [
      '[class*="featured-product"]',
      '[class*="highlight-product"]',
      '[class*="top-product"]',
      '.featured-products .product',
      '[data-testid*="featured"]',
      '.product-highlights'
    ];

    for (const selector of featuredSelectors) {
      try {
        const productElements = await page.$$(selector);
        
        for (const product of productElements.slice(0, 5)) { // Limit to 5 featured products
          const name = await product.$eval(
            '[class*="product-name"], [class*="product-title"], h3, h4',
            el => el.textContent?.trim() || ''
          ).catch(() => '');
          
          const description = await product.$eval(
            '[class*="product-desc"], [class*="product-summary"], p',
            el => el.textContent?.trim() || ''
          ).catch(() => '');
          
          if (name) {
            products.push({ name, description });
          }
        }
        
        if (products.length > 0) break;
      } catch {
        continue;
      }
    }

    return products.length > 0 ? products : undefined;
  }

  private normalizeUrl(url: string, baseUrl: string): string {
    try {
      if (url.startsWith('http')) {
        return url;
      }
      
      const base = new URL(baseUrl);
      if (url.startsWith('/')) {
        return `${base.protocol}//${base.host}${url}`;
      }
      
      // Relative URL
      const pathParts = base.pathname.split('/');
      pathParts.pop(); // Remove current page
      return `${base.protocol}//${base.host}${pathParts.join('/')}/${url}`;
    } catch {
      return url;
    }
  }
}