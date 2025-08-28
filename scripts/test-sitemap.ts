#!/usr/bin/env node

import { SitemapParser } from '../lib/ingestion/sitemap-parser';
import { SitemapFetcher } from '../lib/ingestion/sitemap-fetcher';
import { categorizeUrlWithConfidence } from '../lib/ingestion/url-categorizer';

// Test with sample XML
async function testLocalParsing() {
  console.log('Testing local XML parsing...\n');
  
  const parser = new SitemapParser();
  
  // Sample sitemap XML
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-26</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/product/awesome-widget</loc>
    <lastmod>2024-01-25</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/category/electronics</loc>
    <lastmod>2024-01-24</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://example.com/blog/how-to-use-widgets</loc>
    <lastmod>2024-01-23</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://example.com/brand/acme</loc>
    <lastmod>2024-01-22</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`;

  const result = await parser.parse(sampleXml, { categorizeUrls: true });
  
  console.log('Parse Result:');
  console.log('- Success:', result.success);
  console.log('- Total URLs:', result.totalUrls);
  console.log('- Category Counts:', result.categoryCounts);
  console.log('\nDetailed URL Analysis:');
  
  result.entries.forEach((entry, index) => {
    const analysis = categorizeUrlWithConfidence(entry.url);
    console.log(`\n${index + 1}. ${entry.url}`);
    console.log(`   Category: ${entry.category} (Confidence: ${(analysis.confidence * 100).toFixed(0)}%)`);
    console.log(`   Last Modified: ${entry.lastmod || 'N/A'}`);
    console.log(`   Priority: ${entry.priority || 'N/A'}`);
  });
}

// Test sitemap index
async function testSitemapIndex() {
  console.log('\n\nTesting Sitemap Index parsing...\n');
  
  const parser = new SitemapParser();
  
  const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-products.xml</loc>
    <lastmod>2024-01-26</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-categories.xml</loc>
    <lastmod>2024-01-25</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-blog.xml</loc>
    <lastmod>2024-01-24</lastmod>
  </sitemap>
</sitemapindex>`;

  const result = await parser.parse(sitemapIndexXml);
  
  console.log('Parse Result:');
  console.log('- Success:', result.success);
  console.log('- Is Sitemap Index: true');
  console.log('- Child Sitemaps Found:', result.entries.length);
  
  result.entries.forEach((entry, index) => {
    console.log(`\n${index + 1}. ${entry.url}`);
    console.log(`   Last Modified: ${entry.lastmod || 'N/A'}`);
  });
}

// Test URL categorization
async function testUrlCategorization() {
  console.log('\n\nTesting URL Categorization...\n');
  
  const testUrls = [
    'https://shop.example.com/product/nike-air-max',
    'https://shop.example.com/p/12345',
    'https://amazon.com/dp/B001234567',
    'https://shop.example.com/category/shoes',
    'https://shop.example.com/collections/summer-2024',
    'https://shop.example.com/brand/nike',
    'https://shop.example.com/blog/running-tips',
    'https://shop.example.com/2024/01/new-arrivals',
    'https://shop.example.com/login',
    'https://shop.example.com/cart',
    'https://shop.example.com/about-us',
  ];
  
  testUrls.forEach(url => {
    const result = categorizeUrlWithConfidence(url);
    const confidence = (result.confidence * 100).toFixed(0);
    console.log(`${url}`);
    console.log(`  → ${result.category.toUpperCase()} (${confidence}% confidence)`);
    if (result.matchedPatterns.length > 0) {
      console.log(`  → Matched: ${result.matchedPatterns[0]}`);
    }
    console.log('');
  });
}

// Test with real sitemap (if URL provided as argument)
async function testRealSitemap(url: string) {
  console.log(`\n\nFetching and parsing real sitemap: ${url}\n`);
  
  const fetcher = new SitemapFetcher();
  
  console.log('Discovering sitemaps...');
  const domain = new URL(url).hostname;
  const discovered = await fetcher.discoverSitemaps(domain);
  
  if (discovered.length > 0) {
    console.log(`Found ${discovered.length} sitemap(s):`);
    discovered.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  }
  
  console.log('\nFetching and parsing sitemap...');
  
  let progressCount = 0;
  const result = await fetcher.fetch(
    url,
    {
      categorizeUrls: true,
      fetchChildSitemaps: false, // Don't fetch child sitemaps for test
      maxUrls: 100, // Limit for testing
    },
    (progress) => {
      progressCount++;
      if (progressCount % 10 === 0 || progress.status === 'complete' || progress.status === 'error') {
        console.log(`Progress: ${progress.status} - ${progress.processedUrls}/${progress.totalUrls} URLs`);
      }
    }
  );
  
  console.log('\nResults:');
  console.log('- Success:', result.success);
  console.log('- Total URLs:', result.totalUrls);
  console.log('- Category Distribution:');
  Object.entries(result.categoryCounts).forEach(([category, count]) => {
    const percentage = result.totalUrls > 0 ? ((count / result.totalUrls) * 100).toFixed(1) : '0';
    console.log(`  - ${category}: ${count} (${percentage}%)`);
  });
  
  if (result.errors && result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  // Show sample of URLs
  console.log('\nSample URLs (first 10):');
  result.entries.slice(0, 10).forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.url} → ${entry.category}`);
  });
}

// Main execution
async function main() {
  try {
    // Run local tests
    await testLocalParsing();
    await testSitemapIndex();
    await testUrlCategorization();
    
    // If a URL is provided as argument, test with real sitemap
    const args = process.argv.slice(2);
    if (args[0]) {
      await testRealSitemap(args[0]);
    } else {
      console.log('\n\nTip: You can test with a real sitemap by running:');
      console.log('  npm run test:sitemap https://example.com/sitemap.xml');
    }
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}