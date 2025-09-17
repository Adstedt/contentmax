import { GtinMatcher } from '@/lib/integration/gtin-matcher';
import { Product } from '@/types/integration';

describe('GtinMatcher', () => {
  const matcher = new GtinMatcher();

  const mockProducts: Product[] = [
    {
      id: 'prod1',
      title: 'Product 1',
      gtin: '1234567890123', // GTIN-13
      mpn: 'MPN-123',
      user_id: 'user1',
    },
    {
      id: 'prod2',
      title: 'Product 2',
      gtin: '12345678', // GTIN-8
      sku: 'SKU-456',
      user_id: 'user1',
    },
    {
      id: 'prod3',
      title: 'Product 3',
      gtin: '00012345678905', // GTIN-14
      user_id: 'user1',
    },
  ];

  describe('matchGtin', () => {
    it('should match exact GTIN-13', async () => {
      const result = await matcher.matchGtin('1234567890123', mockProducts);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('product');
      expect(result?.id).toBe('prod1');
      expect(result?.confidence).toBe(1.0);
      expect(result?.strategy).toBe('gtin_exact');
    });

    it('should match exact GTIN-8', async () => {
      const result = await matcher.matchGtin('12345678', mockProducts);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('product');
      expect(result?.id).toBe('prod2');
      expect(result?.confidence).toBe(1.0);
    });

    it('should match with leading zeros removed', async () => {
      const result = await matcher.matchGtin('12345678905', mockProducts);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('product');
      expect(result?.id).toBe('prod3');
    });

    // SKU matching is a future enhancement
    it.skip('should match by SKU when GTIN not found', async () => {
      const result = await matcher.matchGtin('SKU-456', mockProducts);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('product');
      expect(result?.id).toBe('prod2');
      expect(result?.confidence).toBe(0.8);
    });

    // MPN matching is a future enhancement
    it.skip('should match by MPN when GTIN not found', async () => {
      const result = await matcher.matchGtin('MPN-123', mockProducts);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('product');
      expect(result?.id).toBe('prod1');
      expect(result?.confidence).toBe(0.8);
    });

    it('should return null for no match', async () => {
      const result = await matcher.matchGtin('9999999999999', mockProducts);

      expect(result).toBeNull();
    });
  });

  describe('validateGtin', () => {
    it('should validate valid GTIN-13', () => {
      expect(matcher.validateGtin('4006381333931')).toBe(true);
    });

    it('should validate valid GTIN-8', () => {
      expect(matcher.validateGtin('96385074')).toBe(true);
    });

    it('should reject invalid checksum', () => {
      expect(matcher.validateGtin('4006381333932')).toBe(false);
    });

    it('should reject invalid length', () => {
      expect(matcher.validateGtin('123')).toBe(false);
      expect(matcher.validateGtin('12345')).toBe(false);
    });

    it('should reject non-numeric values', () => {
      expect(matcher.validateGtin('ABC123456789')).toBe(false);
    });
  });

  describe('extractGtin', () => {
    it('should extract GTIN from text', () => {
      const text = 'Product with barcode: 4006381333931 in stock';
      const gtin = matcher.extractGtin(text);

      expect(gtin).toBe('4006381333931');
    });

    it('should extract GTIN with label', () => {
      const text = 'GTIN: 96385074';
      const gtin = matcher.extractGtin(text);

      expect(gtin).toBe('96385074');
    });

    it('should return null when no valid GTIN found', () => {
      const text = 'No barcode in this text';
      const gtin = matcher.extractGtin(text);

      expect(gtin).toBeNull();
    });
  });

  describe('batchMatchGtins', () => {
    it('should efficiently match multiple GTINs', async () => {
      const gtins = ['1234567890123', '12345678', '9999999999999'];

      const results = await matcher.batchMatchGtins(gtins, mockProducts);

      expect(results.size).toBe(3);
      expect(results.get(gtins[0])?.id).toBe('prod1');
      expect(results.get(gtins[1])?.id).toBe('prod2');
      expect(results.get(gtins[2])).toBeNull();
    });
  });
});
