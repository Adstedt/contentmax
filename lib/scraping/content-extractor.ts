import { Page } from 'playwright';
import {
  ScrapedContent,
  SEOData,
  ContentData,
  CategoryData,
  BrandData,
  TrustSignals,
  ContentQuality,
  ContentGaps,
  UrlCategory
} from '@/types/scraper.types';
import { ContentGapAnalyzer } from './gap-analyzer';
import { CategoryExtractor } from './category-extractor';
import { BrandExtractor } from './brand-extractor';
import { TemplateDetector } from './template-detector';

export class ContentExtractor {
  private gapAnalyzer: ContentGapAnalyzer;
  private categoryExtractor: CategoryExtractor;
  private brandExtractor: BrandExtractor;
  private templateDetector: TemplateDetector;

  constructor() {
    this.gapAnalyzer = new ContentGapAnalyzer();
    this.categoryExtractor = new CategoryExtractor();
    this.brandExtractor = new BrandExtractor();
    this.templateDetector = new TemplateDetector();
  }

  async extractContent(page: Page, urlCategory: UrlCategory): Promise<ScrapedContent> {
    const url = page.url();

    // Extract all content types in parallel for efficiency
    const [seo, content, trustSignals, quality] = await Promise.all([
      this.extractSEO(page),
      this.extractDescriptiveContent(page),
      this.extractTrustSignals(page),
      this.assessContentQuality(page)
    ]);

    // Category-specific extraction
    let categoryData: CategoryData | undefined;
    let brandData: BrandData | undefined;

    if (urlCategory === 'category') {
      categoryData = await this.categoryExtractor.extract(page);
    } else if (urlCategory === 'brand') {
      brandData = await this.brandExtractor.extract(page);
    }

    // Create the scraped content object
    const scrapedContent: ScrapedContent = {
      url,
      urlCategory,
      seo,
      content,
      categoryData,
      brandData,
      trustSignals,
      quality,
      gaps: {} as ContentGaps // Will be calculated next
    };

    // Analyze gaps after extraction
    scrapedContent.gaps = this.gapAnalyzer.analyzeGaps(scrapedContent);

    return scrapedContent;
  }

  private async extractSEO(page: Page): Promise<SEOData> {
    const seo: SEOData = {
      title: '',
      metaDescription: '',
      h1: '',
      h2s: []
    };

    try {
      // Extract meta title
      seo.title = await page.$eval('title', el => el.textContent?.trim() || '') 
        .catch(() => '');

      // Extract meta description
      seo.metaDescription = await page.$eval(
        'meta[name="description"]',
        el => el.getAttribute('content')?.trim() || ''
      ).catch(() => '');

      // Extract H1
      seo.h1 = await page.$eval('h1', el => el.textContent?.trim() || '')
        .catch(() => '');

      // Extract all H2s
      seo.h2s = await page.$$eval('h2', elements => 
        elements.map(el => el.textContent?.trim() || '').filter(Boolean)
      ).catch(() => []);

      // Extract canonical URL
      seo.canonicalUrl = await page.$eval(
        'link[rel="canonical"]',
        el => el.getAttribute('href') || undefined
      ).catch(() => undefined);

      // Extract Open Graph data
      seo.ogTitle = await page.$eval(
        'meta[property="og:title"]',
        el => el.getAttribute('content') || undefined
      ).catch(() => undefined);

      seo.ogDescription = await page.$eval(
        'meta[property="og:description"]',
        el => el.getAttribute('content') || undefined
      ).catch(() => undefined);

      seo.ogImage = await page.$eval(
        'meta[property="og:image"]',
        el => el.getAttribute('content') || undefined
      ).catch(() => undefined);

      // Extract schema markup
      const schemaScripts = await page.$$eval(
        'script[type="application/ld+json"]',
        scripts => scripts.map(script => {
          try {
            return JSON.parse(script.textContent || '{}');
          } catch {
            return null;
          }
        }).filter(Boolean)
      ).catch(() => []);

      if (schemaScripts.length > 0) {
        seo.schemaMarkup = schemaScripts;
      }
    } catch (error) {
      console.error('Error extracting SEO data:', error);
    }

    return seo;
  }

  private async extractDescriptiveContent(page: Page): Promise<ContentData> {
    const content: ContentData = {
      wordCount: 0,
      uniqueWordCount: 0
    };

    try {
      // Common content selectors
      const selectors = {
        hero: [
          '[class*="hero"] p',
          '[class*="banner"] p',
          'h1 + p',
          '.hero-content',
          '.banner-content'
        ],
        main: [
          '[class*="description"]:not([class*="meta"])',
          '[class*="content"]:not([class*="product"])',
          '.category-description',
          '.page-content',
          'main [class*="text"]'
        ],
        secondary: [
          '[class*="seo-content"]',
          '[class*="bottom-description"]',
          '.additional-content',
          '.seo-text'
        ],
        faq: [
          '[class*="faq"]',
          '[itemtype*="FAQPage"]',
          '.faq-section',
          '.questions-answers'
        ],
        guide: [
          '[class*="buying-guide"]',
          '[class*="how-to"]',
          '.guide-content',
          '.buying-tips'
        ]
      };

      // Extract hero text
      for (const selector of selectors.hero) {
        const text = await page.textContent(selector).catch(() => null);
        if (text && text.trim().length > 20) {
          content.heroText = text.trim();
          break;
        }
      }

      // Extract main description
      for (const selector of selectors.main) {
        const text = await page.textContent(selector).catch(() => null);
        if (text && text.trim().length > 50) {
          content.mainDescription = this.cleanText(text);
          break;
        }
      }

      // Extract secondary description
      for (const selector of selectors.secondary) {
        const text = await page.textContent(selector).catch(() => null);
        if (text && text.trim().length > 50) {
          content.secondaryDescription = this.cleanText(text);
          break;
        }
      }

      // Extract FAQ sections
      const faqData: Array<{question: string; answer: string}> = [];
      for (const selector of selectors.faq) {
        const faqElements = await page.$$(selector).catch(() => []);
        if (faqElements.length > 0) {
          // Try to extract Q&A pairs
          const qaTexts = await page.$$eval(selector + ' [itemProp="name"], ' + selector + ' h3, ' + selector + ' h4', 
            els => els.map(el => el.textContent?.trim() || '')
          ).catch(() => []);
          
          for (const text of qaTexts) {
            if (text.includes('?') || text.toLowerCase().includes('what') || text.toLowerCase().includes('how')) {
              faqData.push({ question: text, answer: '' });
            }
          }
          
          if (faqData.length > 0) {
            content.faqSections = faqData;
          }
          break;
        }
      }

      // Extract buying guide
      for (const selector of selectors.guide) {
        const text = await page.textContent(selector).catch(() => null);
        if (text && text.trim().length > 100) {
          content.buyingGuide = this.cleanText(text);
          break;
        }
      }

      // Calculate word counts
      const allText = [
        content.heroText,
        content.mainDescription,
        content.secondaryDescription,
        content.buyingGuide
      ].filter(Boolean).join(' ');

      content.wordCount = this.countWords(allText);
      content.uniqueWordCount = this.countUniqueWords(allText);

      // Basic readability score (simplified Flesch Reading Ease)
      content.readabilityScore = this.calculateReadability(allText);

    } catch (error) {
      console.error('Error extracting descriptive content:', error);
    }

    return content;
  }

  private async extractTrustSignals(page: Page): Promise<TrustSignals> {
    const signals: TrustSignals = {
      hasReviews: false
    };

    try {
      // Check for reviews
      const reviewSelectors = [
        '[class*="review"]',
        '[class*="rating"]',
        '[itemtype*="Review"]',
        '.star-rating',
        '.customer-reviews'
      ];

      for (const selector of reviewSelectors) {
        const hasReviews = await page.$(selector).then(el => !!el).catch(() => false);
        if (hasReviews) {
          signals.hasReviews = true;
          
          // Try to get review count
          const countText = await page.textContent(selector).catch(() => '');
          const countMatch = countText?.match(/(\d+)\s*(review|rating)/i);
          if (countMatch) {
            signals.reviewCount = parseInt(countMatch[1]);
          }

          // Try to get average rating
          const ratingText = await page.textContent('[class*="average"]').catch(() => '');
          const ratingMatch = ratingText?.match(/(\d+\.?\d*)/);
          if (ratingMatch) {
            signals.averageRating = parseFloat(ratingMatch[1]);
          }
          break;
        }
      }

      // Extract shipping info
      const shippingText = await page.textContent('[class*="shipping"]').catch(() => '');
      if (shippingText) {
        signals.shippingInfo = this.cleanText(shippingText);
      }

      // Extract return policy
      const returnText = await page.textContent('[class*="return"]').catch(() => '');
      if (returnText) {
        signals.returnPolicy = this.cleanText(returnText);
      }

    } catch (error) {
      console.error('Error extracting trust signals:', error);
    }

    return signals;
  }

  private async assessContentQuality(page: Page): Promise<ContentQuality> {
    const quality: ContentQuality = {
      hasUniqueContent: false,
      contentDepth: 'none',
      isTemplatized: false,
      hasStructuredData: false,
      contentToCodeRatio: 0
    };

    try {
      // Get page HTML and text
      const html = await page.content();
      const text = await page.textContent('body') || '';

      // Calculate content to code ratio
      const textLength = text.length;
      const htmlLength = html.length;
      quality.contentToCodeRatio = (textLength / htmlLength) * 100;

      // Check for structured data
      quality.hasStructuredData = html.includes('application/ld+json') || 
                                  html.includes('itemtype=');

      // Assess content depth based on word count
      const wordCount = this.countWords(text);
      if (wordCount === 0) {
        quality.contentDepth = 'none';
      } else if (wordCount < 100) {
        quality.contentDepth = 'thin';
      } else if (wordCount < 500) {
        quality.contentDepth = 'moderate';
      } else {
        quality.contentDepth = 'rich';
      }

      // Check if content is unique (not just navigation/footer)
      quality.hasUniqueContent = wordCount > 50 && quality.contentToCodeRatio > 10;

      // Check if content is templatized
      quality.isTemplatized = this.templateDetector.isTemplate(text);

    } catch (error) {
      console.error('Error assessing content quality:', error);
    }

    return quality;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }

  private countWords(text: string): number {
    if (!text) return 0;
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private countUniqueWords(text: string): number {
    if (!text) return 0;
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    return new Set(words).size;
  }

  private calculateReadability(text: string): number {
    if (!text) return 0;
    
    // Simple readability calculation
    const sentences = text.split(/[.!?]+/).length;
    const words = this.countWords(text);
    const syllables = text.match(/[aeiouAEIOU]/g)?.length || 0;
    
    if (sentences === 0 || words === 0) return 0;
    
    // Simplified Flesch Reading Ease
    const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    return Math.max(0, Math.min(100, score));
  }
}