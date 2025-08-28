import { 
  ScrapedContent, 
  ContentGaps 
} from '@/types/scraper.types';

export class ContentGapAnalyzer {
  analyzeGaps(content: ScrapedContent): ContentGaps {
    const gaps: ContentGaps = {
      missingMetaTitle: this.checkMissingMetaTitle(content),
      missingMetaDescription: this.checkMissingMetaDescription(content),
      missingHeroContent: this.checkMissingHeroContent(content),
      thinDescription: this.checkThinDescription(content),
      noUSP: this.checkNoUSP(content),
      noFAQ: this.checkNoFAQ(content),
      noBuyingGuide: this.checkNoBuyingGuide(content),
      noSchemaMarkup: this.checkNoSchemaMarkup(content),
      templateOnly: this.checkTemplateOnly(content)
    };

    return gaps;
  }

  private checkMissingMetaTitle(content: ScrapedContent): boolean {
    return !content.seo.title || 
           content.seo.title.length < 10 ||
           this.isGenericTitle(content.seo.title);
  }

  private checkMissingMetaDescription(content: ScrapedContent): boolean {
    return !content.seo.metaDescription || 
           content.seo.metaDescription.length < 50 ||
           this.isGenericDescription(content.seo.metaDescription);
  }

  private checkMissingHeroContent(content: ScrapedContent): boolean {
    return !content.content.heroText || 
           content.content.heroText.length < 20;
  }

  private checkThinDescription(content: ScrapedContent): boolean {
    // Check if main description is thin
    const mainDescLength = content.content.mainDescription?.length || 0;
    const wordCount = content.content.wordCount;
    
    return wordCount < 100 || mainDescLength < 200;
  }

  private checkNoUSP(content: ScrapedContent): boolean {
    // Check for unique selling propositions
    const hasUSPInBrand = content.brandData?.brandUSP && 
                          content.brandData.brandUSP.length > 0;
    
    const hasUSPKeywords = this.containsUSPKeywords(
      content.content.mainDescription || ''
    );
    
    const hasWhyChoose = content.brandData?.whyChooseSection && 
                         content.brandData.whyChooseSection.length > 50;
    
    return !hasUSPInBrand && !hasUSPKeywords && !hasWhyChoose;
  }

  private checkNoFAQ(content: ScrapedContent): boolean {
    return !content.content.faqSections || 
           content.content.faqSections.length === 0;
  }

  private checkNoBuyingGuide(content: ScrapedContent): boolean {
    return !content.content.buyingGuide || 
           content.content.buyingGuide.length < 100;
  }

  private checkNoSchemaMarkup(content: ScrapedContent): boolean {
    return !content.seo.schemaMarkup || 
           content.seo.schemaMarkup.length === 0;
  }

  private checkTemplateOnly(content: ScrapedContent): boolean {
    const mainText = content.content.mainDescription || '';
    const title = content.seo.title || '';
    
    // Check for template patterns
    const hasTemplatePatterns = this.detectTemplatePatterns(mainText);
    
    // Check if content is too similar to title (indicates generic content)
    const titleSimilarity = this.calculateSimilarity(title, mainText.substring(0, 100));
    
    // Check if content depth is thin
    const isThin = content.quality.contentDepth === 'thin' || 
                   content.quality.contentDepth === 'none';
    
    return hasTemplatePatterns || titleSimilarity > 0.8 || 
           (isThin && content.quality.isTemplatized);
  }

  private isGenericTitle(title: string): boolean {
    const genericPatterns = [
      /^home$/i,
      /^products?$/i,
      /^category$/i,
      /^shop$/i,
      /^untitled/i,
      /^\w+\s*-\s*\w+$/, // Just brand - site
    ];
    
    return genericPatterns.some(pattern => pattern.test(title));
  }

  private isGenericDescription(description: string): boolean {
    const genericPatterns = [
      /^welcome to/i,
      /^shop for/i,
      /^browse our/i,
      /^find the best/i,
      /products? at (great|low|competitive) prices/i,
      /^we offer/i
    ];
    
    return genericPatterns.some(pattern => pattern.test(description));
  }

  private containsUSPKeywords(text: string): boolean {
    const uspKeywords = [
      'why choose',
      'why buy',
      'benefits',
      'advantages',
      'exclusive',
      'unique',
      'only we',
      'unlike competitors',
      'best choice',
      'trusted by',
      'award-winning',
      'industry-leading',
      'guaranteed',
      'certified'
    ];
    
    const lowerText = text.toLowerCase();
    return uspKeywords.some(keyword => lowerText.includes(keyword));
  }

  private detectTemplatePatterns(text: string): boolean {
    const templatePatterns = [
      /\[CATEGORY_NAME\]/i,
      /\[BRAND_NAME\]/i,
      /\[PRODUCT_NAME\]/i,
      /\{\{.*\}\}/, // Handlebars-style templates
      /<%.*%>/, // ERB-style templates
      /^Browse our selection of/i,
      /^Shop for .+ at great prices$/i,
      /products? at competitive prices/i,
      /^Find your perfect/i,
      /^Discover our range of/i
    ];
    
    return templatePatterns.some(pattern => pattern.test(text));
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    // Simple similarity calculation using common words
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  calculateGapScore(gaps: ContentGaps): number {
    // Calculate a score from 0-100 where higher means more gaps
    const weights = {
      missingMetaTitle: 15,
      missingMetaDescription: 15,
      missingHeroContent: 10,
      thinDescription: 20,
      noUSP: 15,
      noFAQ: 5,
      noBuyingGuide: 5,
      noSchemaMarkup: 5,
      templateOnly: 10
    };
    
    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      if (gaps[key as keyof ContentGaps]) {
        score += weight;
      }
    }
    
    return Math.min(100, score);
  }

  getGapPriority(gaps: ContentGaps): 'low' | 'medium' | 'high' | 'critical' {
    const score = this.calculateGapScore(gaps);
    
    if (score >= 70) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  getRecommendations(gaps: ContentGaps): string[] {
    const recommendations: string[] = [];
    
    if (gaps.missingMetaTitle) {
      recommendations.push('Add a unique, descriptive meta title (50-60 characters)');
    }
    
    if (gaps.missingMetaDescription) {
      recommendations.push('Create a compelling meta description (150-160 characters)');
    }
    
    if (gaps.missingHeroContent) {
      recommendations.push('Add hero/banner content to immediately engage visitors');
    }
    
    if (gaps.thinDescription) {
      recommendations.push('Expand main description to at least 300-500 words of unique content');
    }
    
    if (gaps.noUSP) {
      recommendations.push('Add unique selling propositions and "why choose us" content');
    }
    
    if (gaps.noFAQ) {
      recommendations.push('Create an FAQ section addressing common customer questions');
    }
    
    if (gaps.noBuyingGuide) {
      recommendations.push('Add a buying guide or how-to-choose section');
    }
    
    if (gaps.noSchemaMarkup) {
      recommendations.push('Implement structured data markup for better SEO');
    }
    
    if (gaps.templateOnly) {
      recommendations.push('Replace template content with unique, valuable descriptions');
    }
    
    return recommendations;
  }
}