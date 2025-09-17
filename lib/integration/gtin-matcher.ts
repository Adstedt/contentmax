import { Product, MatchResult } from '@/types/integration';

export class GtinMatcher {
  /**
   * Match products by GTIN/EAN codes
   * Handles various GTIN formats (GTIN-8, GTIN-12, GTIN-13, GTIN-14)
   */
  async matchGtin(gtin: string, products: Product[]): Promise<MatchResult | null> {
    // Normalize GTIN (remove spaces, dashes, etc.)
    const normalizedGtin = this.normalizeGtin(gtin);
    if (!normalizedGtin) return null;

    // Build GTIN index for fast lookup
    const gtinIndex = this.buildGtinIndex(products);

    // Try exact match first
    if (gtinIndex.has(normalizedGtin)) {
      const product = gtinIndex.get(normalizedGtin)!;
      return {
        type: 'product',
        id: product.id,
        confidence: 1.0,
        strategy: 'gtin_exact',
        metadata: { gtin: normalizedGtin },
      };
    }

    // Try with different GTIN formats
    const gtinVariants = this.generateGtinVariants(normalizedGtin);
    for (const variant of gtinVariants) {
      if (gtinIndex.has(variant)) {
        const product = gtinIndex.get(variant)!;
        return {
          type: 'product',
          id: product.id,
          confidence: 0.95,
          strategy: 'gtin_exact',
          metadata: {
            gtin: variant,
            originalGtin: normalizedGtin,
          },
        };
      }
    }

    // Try SKU/MPN matching if GTIN doesn't match
    const skuMatch = this.matchBySku(normalizedGtin, products);
    if (skuMatch) {
      return {
        ...skuMatch,
        confidence: 0.8,
        metadata: {
          matchedBy: 'sku',
          identifier: normalizedGtin,
        },
      };
    }

    return null;
  }

  /**
   * Batch match multiple GTINs efficiently
   */
  async batchMatchGtins(
    gtins: string[],
    products: Product[]
  ): Promise<Map<string, MatchResult | null>> {
    const gtinIndex = this.buildGtinIndex(products);
    const skuIndex = this.buildSkuIndex(products);
    const results = new Map<string, MatchResult | null>();

    for (const gtin of gtins) {
      const normalized = this.normalizeGtin(gtin);
      if (!normalized) {
        results.set(gtin, null);
        continue;
      }

      // Try exact GTIN match
      if (gtinIndex.has(normalized)) {
        const product = gtinIndex.get(normalized)!;
        results.set(gtin, {
          type: 'product',
          id: product.id,
          confidence: 1.0,
          strategy: 'gtin_exact',
          metadata: { gtin: normalized },
        });
        continue;
      }

      // Try SKU match
      if (skuIndex.has(normalized)) {
        const product = skuIndex.get(normalized)!;
        results.set(gtin, {
          type: 'product',
          id: product.id,
          confidence: 0.8,
          strategy: 'gtin_exact',
          metadata: {
            matchedBy: 'sku',
            identifier: normalized,
          },
        });
        continue;
      }

      // No match found
      results.set(gtin, null);
    }

    return results;
  }

  /**
   * Validate GTIN checksum
   */
  validateGtin(gtin: string): boolean {
    const normalized = this.normalizeGtin(gtin);
    if (!normalized) return false;

    // GTIN must be 8, 12, 13, or 14 digits
    if (![8, 12, 13, 14].includes(normalized.length)) {
      return false;
    }

    // Calculate checksum
    let sum = 0;
    const digits = normalized.split('').map(Number);

    for (let i = 0; i < digits.length - 1; i++) {
      // Alternate between multiplying by 3 and 1
      const multiplier = (digits.length - i) % 2 === 0 ? 3 : 1;
      sum += digits[i] * multiplier;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === digits[digits.length - 1];
  }

  /**
   * Normalize GTIN by removing non-numeric characters
   */
  private normalizeGtin(gtin: string): string | null {
    if (!gtin) return null;

    // Remove all non-numeric characters
    const normalized = gtin.replace(/\D/g, '');

    // Must have at least 8 digits
    if (normalized.length < 8) return null;

    return normalized;
  }

  /**
   * Generate GTIN variants (add/remove leading zeros)
   */
  private generateGtinVariants(gtin: string): string[] {
    const variants: string[] = [];

    // Try without leading zeros
    const withoutLeadingZeros = gtin.replace(/^0+/, '');
    if (withoutLeadingZeros !== gtin) {
      variants.push(withoutLeadingZeros);
    }

    // Try with leading zeros to make standard lengths
    const standardLengths = [8, 12, 13, 14];
    for (const length of standardLengths) {
      if (gtin.length < length) {
        const padded = gtin.padStart(length, '0');
        variants.push(padded);
      }
    }

    // Try as EAN-13 if it's 12 digits (UPC-A to EAN-13)
    if (gtin.length === 12) {
      variants.push('0' + gtin);
    }

    return variants;
  }

  /**
   * Match by SKU or MPN
   */
  private matchBySku(
    identifier: string,
    products: Product[]
  ): { type: 'product'; id: string } | null {
    // Try exact SKU/MPN match
    const product = products.find(
      (p) => (p.sku && p.sku === identifier) || (p.mpn && p.mpn === identifier)
    );

    if (product) {
      return { type: 'product', id: product.id };
    }

    // Try case-insensitive match
    const lowerIdentifier = identifier.toLowerCase();
    const productCaseInsensitive = products.find(
      (p) =>
        (p.sku && p.sku.toLowerCase() === lowerIdentifier) ||
        (p.mpn && p.mpn.toLowerCase() === lowerIdentifier)
    );

    if (productCaseInsensitive) {
      return { type: 'product', id: productCaseInsensitive.id };
    }

    return null;
  }

  /**
   * Build GTIN index for fast lookups
   */
  private buildGtinIndex(products: Product[]): Map<string, Product> {
    const index = new Map<string, Product>();

    for (const product of products) {
      if (product.gtin) {
        const normalized = this.normalizeGtin(product.gtin);
        if (normalized) {
          index.set(normalized, product);

          // Also index variants
          const variants = this.generateGtinVariants(normalized);
          for (const variant of variants) {
            if (!index.has(variant)) {
              index.set(variant, product);
            }
          }
        }
      }
    }

    return index;
  }

  /**
   * Build SKU/MPN index for fast lookups
   */
  private buildSkuIndex(products: Product[]): Map<string, Product> {
    const index = new Map<string, Product>();

    for (const product of products) {
      if (product.sku) {
        index.set(product.sku, product);
        index.set(product.sku.toLowerCase(), product);
      }
      if (product.mpn) {
        index.set(product.mpn, product);
        index.set(product.mpn.toLowerCase(), product);
      }
    }

    return index;
  }

  /**
   * Extract GTIN from various text formats
   */
  extractGtin(text: string): string | null {
    // Common GTIN patterns
    const patterns = [
      /\b(\d{14})\b/, // GTIN-14
      /\b(\d{13})\b/, // GTIN-13/EAN
      /\b(\d{12})\b/, // GTIN-12/UPC
      /\b(\d{8})\b/, // GTIN-8
      /(?:gtin|ean|upc)[:\s]*(\d+)/i,
      /(?:barcode|code)[:\s]*(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const gtin = this.normalizeGtin(match[1]);
        if (gtin && this.validateGtin(gtin)) {
          return gtin;
        }
      }
    }

    return null;
  }
}
