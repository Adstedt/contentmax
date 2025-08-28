import { Page } from 'playwright';
import { BrandData } from '@/types/scraper.types';

export class BrandExtractor {
  async extract(page: Page): Promise<BrandData> {
    const brandData: BrandData = {};

    try {
      // Extract brand story
      brandData.brandStory = await this.extractBrandStory(page);

      // Extract unique selling propositions
      brandData.brandUSP = await this.extractUSPs(page);

      // Check if authorized dealer
      brandData.authorizedDealer = await this.checkAuthorizedDealer(page);

      // Extract certifications
      brandData.certifications = await this.extractCertifications(page);

      // Extract why choose section
      brandData.whyChooseSection = await this.extractWhyChoose(page);

    } catch (error) {
      console.error('Error extracting brand data:', error);
    }

    return brandData;
  }

  private async extractBrandStory(page: Page): Promise<string | undefined> {
    const storySelectors = [
      '[class*="brand-story"]',
      '[class*="about-brand"]',
      '[class*="brand-history"]',
      '[class*="brand-description"]',
      '.brand-content',
      '[id*="about"]',
      'section:has-text("About")',
      'section:has-text("Our Story")',
      '[data-testid*="brand-story"]'
    ];

    for (const selector of storySelectors) {
      try {
        const text = await page.textContent(selector);
        if (text && text.trim().length > 100) {
          return this.cleanText(text);
        }
      } catch {
        continue;
      }
    }

    // Fallback: look for paragraphs with brand-related keywords
    try {
      const paragraphs = await page.$$eval('p', elements => 
        elements.map(el => el.textContent?.trim() || '').filter(text => text.length > 100)
      );

      for (const para of paragraphs) {
        if (this.containsBrandStoryKeywords(para)) {
          return para;
        }
      }
    } catch {
      // Ignore errors
    }

    return undefined;
  }

  private async extractUSPs(page: Page): Promise<string[] | undefined> {
    const usps: string[] = [];
    
    const uspSelectors = [
      '[class*="benefit"]',
      '[class*="advantage"]',
      '[class*="feature"]',
      '[class*="usp"]',
      '[class*="selling-point"]',
      '.why-choose li',
      '.brand-benefits li',
      '[data-testid*="benefit"]',
      'ul:has-text("Why") li',
      'ul:has-text("Benefits") li'
    ];

    for (const selector of uspSelectors) {
      try {
        const elements = await page.$$(selector);
        
        for (const element of elements) {
          const text = await element.textContent();
          if (text && text.trim().length > 10 && text.trim().length < 200) {
            const cleanedText = this.cleanText(text);
            if (!usps.includes(cleanedText)) {
              usps.push(cleanedText);
            }
          }
        }
        
        if (usps.length >= 3) break; // Stop if we have enough USPs
      } catch {
        continue;
      }
    }

    // Look for icon-based benefits
    if (usps.length < 3) {
      try {
        const iconBenefits = await page.$$eval(
          '[class*="icon"] + p, [class*="icon"] + span, svg + p, svg + span',
          elements => elements.map(el => el.textContent?.trim() || '')
                             .filter(text => text.length > 10 && text.length < 100)
        );
        
        for (const benefit of iconBenefits) {
          if (!usps.includes(benefit)) {
            usps.push(benefit);
          }
        }
      } catch {
        // Ignore errors
      }
    }

    return usps.length > 0 ? usps : undefined;
  }

  private async checkAuthorizedDealer(page: Page): Promise<boolean> {
    const authSelectors = [
      '[class*="authorized"]',
      '[class*="official"]',
      '[class*="certified"]',
      'img[alt*="authorized"]',
      'img[alt*="official"]',
      '[data-testid*="authorized"]',
      ':has-text("Authorized Dealer")',
      ':has-text("Official Retailer")',
      ':has-text("Certified Partner")'
    ];

    for (const selector of authSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent().catch(() => '');
          const alt = await element.getAttribute('alt').catch(() => '');
          
          if (text || alt) {
            const combined = (text + ' ' + alt).toLowerCase();
            if (combined.includes('authorized') || 
                combined.includes('official') || 
                combined.includes('certified')) {
              return true;
            }
          }
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  private async extractCertifications(page: Page): Promise<string[] | undefined> {
    const certifications: string[] = [];
    
    const certSelectors = [
      '[class*="certification"]',
      '[class*="accreditation"]',
      '[class*="badge"]',
      '[class*="trust-seal"]',
      'img[alt*="certified"]',
      'img[alt*="ISO"]',
      'img[alt*="accredited"]',
      '[data-testid*="certification"]',
      '.trust-badges img',
      '.certifications li'
    ];

    for (const selector of certSelectors) {
      try {
        const elements = await page.$$(selector);
        
        for (const element of elements) {
          // Try to get text content
          const text = await element.textContent().catch(() => '');
          
          // Try to get alt text for images
          const alt = await element.getAttribute('alt').catch(() => '');
          
          // Try to get title attribute
          const title = await element.getAttribute('title').catch(() => '');
          
          const combined = [text, alt, title].filter(Boolean).join(' ').trim();
          
          if (combined && this.isCertification(combined)) {
            const cert = this.extractCertificationName(combined);
            if (cert && !certifications.includes(cert)) {
              certifications.push(cert);
            }
          }
        }
      } catch {
        continue;
      }
    }

    return certifications.length > 0 ? certifications : undefined;
  }

  private async extractWhyChoose(page: Page): Promise<string | undefined> {
    const whyChooseSelectors = [
      '[class*="why-choose"]',
      '[class*="why-buy"]',
      '[class*="why-us"]',
      'section:has-text("Why Choose")',
      'section:has-text("Why Buy From")',
      '[id*="why-choose"]',
      '[data-testid*="why-choose"]',
      '.brand-advantages',
      '.reasons-to-buy'
    ];

    for (const selector of whyChooseSelectors) {
      try {
        const text = await page.textContent(selector);
        if (text && text.trim().length > 50) {
          return this.cleanText(text);
        }
      } catch {
        continue;
      }
    }

    // Fallback: look for headings with "why" and get following content
    try {
      const headings = await page.$$('h2, h3, h4');
      
      for (const heading of headings) {
        const headingText = await heading.textContent();
        if (headingText && headingText.toLowerCase().includes('why')) {
          // Get the next sibling content
          const nextElement = await heading.evaluateHandle(el => el.nextElementSibling);
          if (nextElement) {
            const content = await nextElement.asElement()?.textContent();
            if (content && content.length > 50) {
              return this.cleanText(content);
            }
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return undefined;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/\t+/g, ' ')
      .trim();
  }

  private containsBrandStoryKeywords(text: string): boolean {
    const keywords = [
      'founded',
      'established',
      'since',
      'years of experience',
      'our story',
      'our mission',
      'our vision',
      'we believe',
      'committed to',
      'dedicated to',
      'passionate about',
      'heritage',
      'tradition',
      'innovation'
    ];

    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  private isCertification(text: string): boolean {
    const certKeywords = [
      'certified',
      'accredited',
      'iso',
      'ce mark',
      'ul listed',
      'fda approved',
      'energy star',
      'rohs',
      'reach',
      'certified dealer',
      'authorized',
      'award',
      'compliance'
    ];

    const lowerText = text.toLowerCase();
    return certKeywords.some(keyword => lowerText.includes(keyword));
  }

  private extractCertificationName(text: string): string {
    // Clean up common certification text patterns
    const cleaned = text
      .replace(/certified/gi, '')
      .replace(/accredited/gi, '')
      .replace(/compliant/gi, '')
      .replace(/approved/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract ISO numbers
    const isoMatch = cleaned.match(/ISO\s*\d+/i);
    if (isoMatch) return isoMatch[0].toUpperCase();

    // Return cleaned text if it's not too long
    if (cleaned.length < 50) {
      return cleaned;
    }

    // Extract first meaningful part
    const parts = cleaned.split(/[,;.]/);
    return parts[0].trim();
  }
}