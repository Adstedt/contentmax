export class TemplateDetector {
  private templatePatterns: RegExp[] = [
    // Placeholder patterns
    /\[CATEGORY_NAME\]/gi,
    /\[BRAND_NAME\]/gi,
    /\[PRODUCT_NAME\]/gi,
    /\[PRODUCT_COUNT\]/gi,
    /\[LOCATION\]/gi,
    /\[YEAR\]/gi,
    
    // Template variable patterns
    /\{\{.*?\}\}/g, // Handlebars/Mustache style
    /\{%.*?%\}/g, // Liquid/Django style
    /<%.*?%>/g, // ERB/ASP style
    /\${.*?}/g, // JavaScript template literals
    /#\{.*?\}/g, // Ruby interpolation
    
    // Generic template phrases
    /^browse our selection of/i,
    /^shop for .+ at (great|low|competitive) prices$/i,
    /^find (your perfect|the best)/i,
    /^discover our (range|collection) of/i,
    /^we offer a (wide|large|huge) (selection|range|variety)/i,
    /^welcome to our .+ (store|shop|section)/i,
    /products? at competitive prices/i,
    /great deals on all/i,
    /best prices guaranteed/i,
    /^explore our .+ collection$/i
  ];

  private genericPhrases: string[] = [
    'click here',
    'learn more',
    'shop now',
    'buy now',
    'add to cart',
    'view details',
    'see more',
    'read more',
    'contact us',
    'call us today',
    'get started',
    'sign up today',
    'free shipping',
    'fast delivery',
    'order now',
    'limited time offer',
    'special offer',
    'sale',
    'discount',
    'save now'
  ];

  isTemplate(text: string): boolean {
    if (!text || text.length < 20) return false;

    // Check for template patterns
    const hasTemplatePatterns = this.hasTemplatePatterns(text);
    if (hasTemplatePatterns) return true;

    // Check for high density of generic phrases
    const genericDensity = this.calculateGenericDensity(text);
    if (genericDensity > 0.3) return true;

    // Check for repetitive structure
    const isRepetitive = this.checkRepetitiveStructure(text);
    if (isRepetitive) return true;

    // Check for lack of specific details
    const hasSpecificDetails = this.hasSpecificDetails(text);
    if (!hasSpecificDetails) return true;

    return false;
  }

  private hasTemplatePatterns(text: string): boolean {
    return this.templatePatterns.some(pattern => pattern.test(text));
  }

  private calculateGenericDensity(text: string): number {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length === 0) return 0;

    let genericCount = 0;
    for (const phrase of this.genericPhrases) {
      if (lowerText.includes(phrase)) {
        genericCount += phrase.split(' ').length;
      }
    }

    return genericCount / words.length;
  }

  private checkRepetitiveStructure(text: string): boolean {
    // Split text into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length < 3) return false;

    // Check for similar sentence starts
    const starts = sentences.map(s => {
      const words = s.trim().split(/\s+/);
      return words.slice(0, 3).join(' ').toLowerCase();
    });

    const uniqueStarts = new Set(starts);
    const repetitionRatio = 1 - (uniqueStarts.size / starts.length);
    
    return repetitionRatio > 0.5;
  }

  private hasSpecificDetails(text: string): boolean {
    const specificIndicators = [
      // Numbers and measurements
      /\d+\s*(mm|cm|m|kg|g|lb|oz|inch|inches|feet|ft)/i,
      /\d+\s*x\s*\d+/i, // Dimensions
      /\$\d+/,
      /\d+%/,
      
      // Specific years (not just "2024" which might be current year)
      /since\s+\d{4}/i,
      /established\s+\d{4}/i,
      /founded\s+\d{4}/i,
      
      // Model numbers and SKUs
      /model\s*[:#]?\s*[\w-]+/i,
      /sku\s*[:#]?\s*[\w-]+/i,
      /item\s*[:#]?\s*[\w-]+/i,
      
      // Specific technical terms
      /\d+\s*(gb|mb|tb|mhz|ghz|mp|megapixel)/i,
      
      // Brand names (assuming they're capitalized properly)
      /[A-Z][a-z]+[\s&]+[A-Z][a-z]+/, // Multi-word proper nouns
      
      // Specific materials
      /(stainless steel|aluminum|carbon fiber|leather|cotton|polyester|wood|plastic)/i,
      
      // Certifications with numbers
      /ISO\s*\d+/i,
      /IEEE\s*\d+/i
    ];

    return specificIndicators.some(pattern => pattern.test(text));
  }

  detectTemplateScore(text: string): number {
    let score = 0;
    const maxScore = 100;

    // Template patterns (40 points)
    if (this.hasTemplatePatterns(text)) {
      score += 40;
    }

    // Generic density (30 points)
    const genericDensity = this.calculateGenericDensity(text);
    score += Math.min(30, genericDensity * 100);

    // Repetitive structure (20 points)
    if (this.checkRepetitiveStructure(text)) {
      score += 20;
    }

    // Lack of specific details (10 points)
    if (!this.hasSpecificDetails(text)) {
      score += 10;
    }

    return Math.min(maxScore, score);
  }

  getTemplateType(text: string): string | null {
    if (!this.isTemplate(text)) return null;

    // Detect specific template types
    if (/category|categories/i.test(text)) return 'category-template';
    if (/brand|manufacturer/i.test(text)) return 'brand-template';
    if (/product|item/i.test(text)) return 'product-template';
    if (/blog|article|post/i.test(text)) return 'blog-template';
    
    // Check for e-commerce platform templates
    if (/woocommerce|shopify|magento|bigcommerce/i.test(text)) return 'platform-template';
    
    return 'generic-template';
  }

  suggestImprovements(text: string): string[] {
    const suggestions: string[] = [];

    if (this.hasTemplatePatterns(text)) {
      suggestions.push('Replace template placeholders with actual content');
    }

    const genericDensity = this.calculateGenericDensity(text);
    if (genericDensity > 0.2) {
      suggestions.push('Reduce generic phrases and add more specific, unique content');
    }

    if (this.checkRepetitiveStructure(text)) {
      suggestions.push('Vary sentence structure to avoid repetitive patterns');
    }

    if (!this.hasSpecificDetails(text)) {
      suggestions.push('Add specific details like measurements, model numbers, or technical specifications');
    }

    // Check content length
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount < 100) {
      suggestions.push('Expand content to at least 300-500 words for better SEO');
    }

    return suggestions;
  }
}