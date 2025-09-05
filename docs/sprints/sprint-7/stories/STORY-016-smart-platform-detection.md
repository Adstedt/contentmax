# STORY-016: Smart Platform Detection & Onboarding Flow

## Story Overview

**Story ID:** STORY-016  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P1 - High  
**Estimated Effort:** 2 hours  
**Story Points:** 2  
**New Story:** Added in v2 prioritization

## User Story

As a **new user**,  
I want **the system to automatically detect my e-commerce platform and recommend the best data import method**,  
So that **I get the richest possible data with the least friction**.

## Context

Different e-commerce platforms have different data availability. Google Merchant provides the richest data, while sitemap parsing is a universal fallback. Smart detection guides users to the optimal path.

## Acceptance Criteria

### Functional Requirements
1. ✅ Detect e-commerce platform from URL
2. ✅ Check for Google Merchant availability
3. ✅ Present appropriate onboarding options
4. ✅ Show data quality indicators
5. ✅ Guide users to best integration method

### Technical Requirements
6. ✅ Platform detection logic
7. ✅ Google Merchant verification
8. ✅ Progressive disclosure UI
9. ✅ Data quality preview
10. ✅ Fallback flow handling

### UX Requirements
11. ✅ Clear value proposition for each method
12. ✅ Visual indicators of data completeness
13. ✅ Estimated time for each option
14. ✅ Help text and tooltips

## Technical Implementation Notes

### Platform Detection Service
```typescript
// lib/detection/platform-detector.ts
export interface PlatformInfo {
  platform: 'shopify' | 'woocommerce' | 'bigcommerce' | 'magento' | 'custom' | 'unknown';
  confidence: number;
  indicators: string[];
  recommendations: DataSourceRecommendation[];
}

export interface DataSourceRecommendation {
  source: 'google_merchant' | 'shopify_api' | 'sitemap' | 'manual';
  available: boolean;
  dataQuality: 'excellent' | 'good' | 'basic' | 'minimal';
  setupTime: string;
  requirements: string[];
  benefits: string[];
}

export class PlatformDetector {
  async detectPlatform(url: string): Promise<PlatformInfo> {
    const domain = new URL(url).hostname;
    
    // Run detection checks in parallel
    const [
      platformIndicators,
      googleMerchantAvailable,
      sitemapAvailable
    ] = await Promise.all([
      this.checkPlatformIndicators(url),
      this.checkGoogleMerchant(domain),
      this.checkSitemap(url)
    ]);
    
    // Determine platform
    const platform = this.identifyPlatform(platformIndicators);
    
    // Build recommendations
    const recommendations = this.buildRecommendations(
      platform,
      googleMerchantAvailable,
      sitemapAvailable
    );
    
    return {
      platform,
      confidence: platformIndicators.confidence,
      indicators: platformIndicators.found,
      recommendations
    };
  }
  
  private async checkPlatformIndicators(url: string) {
    const indicators = {
      shopify: [
        '/products.json',
        'cdn.shopify.com',
        'myshopify.com',
        'Shopify.theme'
      ],
      woocommerce: [
        '/wp-json/wc/',
        'woocommerce',
        'wp-content/plugins/woocommerce'
      ],
      bigcommerce: [
        'bigcommerce.com',
        '/api/v2/',
        'bigcommerce/cornerstone'
      ],
      magento: [
        '/rest/V1/',
        'magento',
        'mage/cookies'
      ]
    };
    
    const found = [];
    let platform = 'unknown';
    
    try {
      // Check HTML for indicators
      const response = await fetch(url);
      const html = await response.text();
      
      for (const [plat, patterns] of Object.entries(indicators)) {
        for (const pattern of patterns) {
          if (html.includes(pattern)) {
            found.push(pattern);
            platform = plat;
            break;
          }
        }
      }
      
      // Check response headers
      const headers = response.headers;
      if (headers.get('x-shopify-stage')) {
        platform = 'shopify';
        found.push('x-shopify-stage header');
      }
      
    } catch (error) {
      console.error('Platform detection failed:', error);
    }
    
    return {
      platform,
      confidence: found.length > 0 ? found.length / 3 : 0,
      found
    };
  }
  
  private async checkGoogleMerchant(domain: string): Promise<boolean> {
    // Check if domain has Google Merchant Center account
    // This would require checking Google's merchant list API
    // or having user confirm they have an account
    
    try {
      // Simplified check - in production this would check actual API
      const merchantDomains = await this.getKnownMerchantDomains();
      return merchantDomains.includes(domain);
    } catch {
      return false;
    }
  }
  
  private buildRecommendations(
    platform: string,
    hasGoogleMerchant: boolean,
    hasSitemap: boolean
  ): DataSourceRecommendation[] {
    const recommendations: DataSourceRecommendation[] = [];
    
    // Always recommend Google Merchant if available
    if (hasGoogleMerchant) {
      recommendations.push({
        source: 'google_merchant',
        available: true,
        dataQuality: 'excellent',
        setupTime: '5 minutes',
        requirements: ['Google account', 'Merchant Center access'],
        benefits: [
          'Complete product catalog with images',
          'Structured category data',
          'Pricing and availability',
          'Product attributes and variants'
        ]
      });
    }
    
    // Platform-specific recommendations
    if (platform === 'shopify') {
      recommendations.push({
        source: 'shopify_api',
        available: false, // Not implemented yet
        dataQuality: 'excellent',
        setupTime: '2 minutes',
        requirements: ['Shopify admin access'],
        benefits: [
          'Real-time data sync',
          'Full product details',
          'Collection hierarchy',
          'Inventory tracking'
        ]
      });
    }
    
    // Universal fallback
    recommendations.push({
      source: 'sitemap',
      available: hasSitemap,
      dataQuality: 'basic',
      setupTime: '1 minute',
      requirements: ['Public sitemap.xml'],
      benefits: [
        'Quick setup',
        'Basic site structure',
        'URL patterns',
        'No authentication needed'
      ]
    });
    
    // Sort by data quality
    return recommendations.sort((a, b) => {
      const qualityOrder = { excellent: 0, good: 1, basic: 2, minimal: 3 };
      return qualityOrder[a.dataQuality] - qualityOrder[b.dataQuality];
    });
  }
}
```

### Onboarding Flow Component
```typescript
// components/onboarding/SmartOnboarding.tsx
import { useState, useEffect } from 'react';
import { PlatformDetector } from '@/lib/detection/platform-detector';

export function SmartOnboarding({ storeUrl }: { storeUrl: string }) {
  const [detection, setDetection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState(null);
  
  useEffect(() => {
    detectPlatform();
  }, [storeUrl]);
  
  const detectPlatform = async () => {
    setLoading(true);
    const detector = new PlatformDetector();
    const result = await detector.detectPlatform(storeUrl);
    setDetection(result);
    setLoading(false);
  };
  
  if (loading) {
    return <DetectionLoader />;
  }
  
  return (
    <div className="onboarding-container">
      {/* Platform Detection Result */}
      <div className="detection-result">
        <h3>Platform Detected: {detection.platform}</h3>
        <div className="confidence-meter">
          <div 
            className="confidence-bar" 
            style={{ width: `${detection.confidence * 100}%` }}
          />
        </div>
      </div>
      
      {/* Data Source Options */}
      <div className="data-sources">
        <h2>Choose Your Data Import Method</h2>
        <p className="subtitle">
          We've ranked these options by data quality for your platform
        </p>
        
        {detection.recommendations.map((rec, index) => (
          <DataSourceCard
            key={rec.source}
            recommendation={rec}
            isRecommended={index === 0}
            onSelect={() => handleMethodSelection(rec)}
          />
        ))}
      </div>
      
      {/* Help Section */}
      <div className="help-section">
        <h4>Not sure which to choose?</h4>
        <ul>
          <li>
            <strong>Google Merchant</strong> provides the most complete data
            if you advertise on Google Shopping
          </li>
          <li>
            <strong>Sitemap</strong> works for any website but provides
            basic structure only
          </li>
        </ul>
      </div>
    </div>
  );
}

function DataSourceCard({ 
  recommendation, 
  isRecommended, 
  onSelect 
}: { 
  recommendation: DataSourceRecommendation;
  isRecommended: boolean;
  onSelect: () => void;
}) {
  const qualityColors = {
    excellent: 'green',
    good: 'blue',
    basic: 'yellow',
    minimal: 'gray'
  };
  
  return (
    <div className={`source-card ${!recommendation.available ? 'disabled' : ''}`}>
      {isRecommended && (
        <div className="recommended-badge">Recommended</div>
      )}
      
      <div className="source-header">
        <h3>{getSourceTitle(recommendation.source)}</h3>
        <div className={`quality-indicator ${qualityColors[recommendation.dataQuality]}`}>
          {recommendation.dataQuality} data
        </div>
      </div>
      
      <div className="source-details">
        <div className="setup-time">
          <ClockIcon /> {recommendation.setupTime} setup
        </div>
        
        <div className="benefits">
          <h4>What you'll get:</h4>
          <ul>
            {recommendation.benefits.map(benefit => (
              <li key={benefit}>
                <CheckIcon /> {benefit}
              </li>
            ))}
          </ul>
        </div>
        
        {recommendation.requirements.length > 0 && (
          <div className="requirements">
            <h4>Requirements:</h4>
            <ul>
              {recommendation.requirements.map(req => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <button
        onClick={onSelect}
        disabled={!recommendation.available}
        className="select-button"
      >
        {recommendation.available ? 'Select This Method' : 'Coming Soon'}
      </button>
    </div>
  );
}
```

### Data Quality Preview
```typescript
// components/onboarding/DataQualityPreview.tsx
export function DataQualityPreview({ source, storeUrl }) {
  const [preview, setPreview] = useState(null);
  
  useEffect(() => {
    loadPreview();
  }, [source, storeUrl]);
  
  const loadPreview = async () => {
    const response = await fetch('/api/import/preview', {
      method: 'POST',
      body: JSON.stringify({ source, storeUrl })
    });
    
    const data = await response.json();
    setPreview(data);
  };
  
  if (!preview) return <LoadingSpinner />;
  
  return (
    <div className="data-preview">
      <h3>Data Preview</h3>
      
      <div className="preview-stats">
        <div className="stat">
          <span className="label">Categories Found</span>
          <span className="value">{preview.categoriesCount}</span>
        </div>
        <div className="stat">
          <span className="label">Products Found</span>
          <span className="value">{preview.productsCount || 'N/A'}</span>
        </div>
        <div className="stat">
          <span className="label">Data Completeness</span>
          <div className="completeness-bar">
            <div 
              className="fill" 
              style={{ width: `${preview.completeness}%` }}
            />
          </div>
        </div>
      </div>
      
      <div className="sample-data">
        <h4>Sample Categories</h4>
        <ul>
          {preview.sampleCategories?.slice(0, 5).map(cat => (
            <li key={cat}>{cat}</li>
          ))}
        </ul>
      </div>
      
      <div className="available-fields">
        <h4>Available Data Fields</h4>
        <div className="field-grid">
          {Object.entries(preview.availableFields || {}).map(([field, available]) => (
            <div key={field} className={`field ${available ? 'available' : 'unavailable'}`}>
              {available ? <CheckIcon /> : <XIcon />} {field}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Dependencies

- Platform detection logic
- Google Merchant check capability
- Sitemap availability check
- Onboarding UI components

## Testing Requirements

### Unit Tests
```typescript
describe('PlatformDetector', () => {
  it('correctly identifies Shopify stores');
  it('correctly identifies WooCommerce stores');
  it('detects Google Merchant availability');
  it('ranks recommendations by data quality');
  it('handles unknown platforms gracefully');
});
```

### Integration Tests
- Test with real store URLs
- Verify recommendation accuracy
- Test onboarding flow end-to-end
- Validate data preview accuracy

## Definition of Done

- [ ] Platform detection working
- [ ] Google Merchant check implemented
- [ ] Recommendations ranked correctly
- [ ] Onboarding UI complete
- [ ] Data quality indicators shown
- [ ] Help text and guidance added
- [ ] Unit tests passing
- [ ] Tested with multiple platforms
- [ ] UX review completed

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `lib/detection/platform-detector.ts` (new)
- `components/onboarding/SmartOnboarding.tsx` (new)
- `components/onboarding/DataQualityPreview.tsx` (new)
- `app/api/import/preview/route.ts` (new)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned