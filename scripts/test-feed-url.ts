#!/usr/bin/env tsx

import { FeedFetcher } from '../lib/taxonomy/feed-fetcher';
import { FeedTaxonomyBuilder } from '../lib/taxonomy/feed-taxonomy-builder';
import { CategoryMerger } from '../lib/taxonomy/category-merger';
import fs from 'fs';
import path from 'path';

async function testFeedUrl() {
  const feedUrl = process.argv[2];
  
  if (!feedUrl) {
    console.error('❌ Please provide a feed URL as argument');
    console.log('\nUsage:');
    console.log('  npm run test:feed:url <feed-url>');
    console.log('\nExamples:');
    console.log('  npm run test:feed:url https://example.com/products.xml');
    console.log('  npm run test:feed:url https://merchant.com/feed.json');
    console.log('  npm run test:feed:url https://store.com/catalog.csv');
    process.exit(1);
  }
  
  console.log('🚀 Testing Feed Import from URL\n');
  console.log(`📍 URL: ${feedUrl}\n`);
  
  try {
    // Step 1: Fetch and parse the feed
    console.log('📥 Fetching feed...');
    const fetcher = new FeedFetcher();
    const startTime = Date.now();
    const { products, metadata } = await fetcher.fetchFromUrl(feedUrl);
    const fetchTime = Date.now() - startTime;
    
    console.log(`✅ Feed fetched in ${fetchTime}ms`);
    console.log(`📊 Feed Metadata:`);
    console.log(`  - Format: ${metadata.format}`);
    console.log(`  - Total Products: ${metadata.totalProducts}`);
    if (metadata.title) console.log(`  - Title: ${metadata.title}`);
    if (metadata.updated) console.log(`  - Updated: ${metadata.updated.toISOString()}`);
    console.log('\n');
    
    // Step 2: Analyze product data
    console.log('🔍 Product Analysis:');
    const productsWithType = products.filter(p => p.product_type).length;
    const productsWithGoogle = products.filter(p => p.google_product_category).length;
    const productsWithBoth = products.filter(p => p.product_type && p.google_product_category).length;
    const productsWithImages = products.filter(p => p.image_link).length;
    const productsWithPrices = products.filter(p => p.price).length;
    
    console.log(`  - Products with product_type: ${productsWithType} (${(productsWithType / products.length * 100).toFixed(1)}%)`);
    console.log(`  - Products with google_product_category: ${productsWithGoogle} (${(productsWithGoogle / products.length * 100).toFixed(1)}%)`);
    console.log(`  - Products with both: ${productsWithBoth}`);
    console.log(`  - Products with images: ${productsWithImages}`);
    console.log(`  - Products with prices: ${productsWithPrices}`);
    console.log('\n');
    
    // Show sample products
    console.log('📦 Sample Products (first 3):');
    products.slice(0, 3).forEach((product, index) => {
      console.log(`\n  Product ${index + 1}:`);
      console.log(`    ID: ${product.id}`);
      console.log(`    Title: ${product.title}`);
      if (product.product_type) console.log(`    Product Type: ${product.product_type}`);
      if (product.google_product_category) console.log(`    Google Category: ${product.google_product_category}`);
      if (product.price) {
        const price = typeof product.price === 'object' ? 
          `${product.price.value} ${product.price.currency || 'USD'}` : 
          product.price;
        console.log(`    Price: ${price}`);
      }
      if (product.brand) console.log(`    Brand: ${product.brand}`);
    });
    console.log('\n');
    
    // Step 3: Build taxonomy
    console.log('🏗️  Building Taxonomy...');
    const builder = new FeedTaxonomyBuilder();
    const buildStart = Date.now();
    await builder.buildFromProductFeed(products, { skipPersist: true });
    const buildTime = Date.now() - buildStart;
    
    const nodes = builder.getNodes();
    const productAssignments = builder.getProductAssignments();
    
    console.log(`✅ Taxonomy built in ${buildTime}ms`);
    console.log(`  - Created ${nodes.size} categories\n`);
    
    // Step 4: Analyze taxonomy
    const depths = Array.from(nodes.values()).map(n => n.depth);
    const productCounts = Array.from(nodes.values()).map(n => n.product_count);
    
    console.log('📊 Taxonomy Statistics:');
    console.log(`  - Total categories: ${nodes.size}`);
    console.log(`  - Max depth: ${Math.max(...depths)}`);
    console.log(`  - Avg depth: ${(depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1)}`);
    console.log(`  - Categories with products: ${productCounts.filter(c => c > 0).length}`);
    console.log(`  - Product assignments: ${Array.from(productAssignments.values()).reduce((sum, set) => sum + set.size, 0)}`);
    console.log('\n');
    
    // Show root categories
    const rootNodes = Array.from(nodes.values())
      .filter(n => !n.parent_id)
      .sort((a, b) => b.product_count - a.product_count);
    
    console.log('🌳 Top-Level Categories:');
    rootNodes.slice(0, 10).forEach(node => {
      console.log(`  - ${node.title}: ${node.product_count} products`);
      
      // Show top children
      const children = Array.from(nodes.values())
        .filter(n => n.parent_id === node.id)
        .sort((a, b) => b.product_count - a.product_count)
        .slice(0, 3);
      
      if (children.length > 0) {
        children.forEach(child => {
          console.log(`    → ${child.title}: ${child.product_count} products`);
        });
      }
    });
    console.log('\n');
    
    // Step 5: Test category merging
    console.log('🔀 Testing Category Merger...');
    const merger = new CategoryMerger();
    const mergeStart = Date.now();
    const mergedNodes = merger.mergeSimilarCategories(nodes);
    const mergeTime = Date.now() - mergeStart;
    const mergeStats = merger.getMergeStats();
    
    console.log(`✅ Merging completed in ${mergeTime}ms`);
    console.log(`  - Merged ${mergeStats.totalMerges} similar categories`);
    console.log(`  - Final category count: ${mergedNodes.size}`);
    
    if (mergeStats.totalMerges > 0) {
      console.log('\n📝 Sample Merges:');
      let count = 0;
      for (const [from, to] of mergeStats.mergeMap) {
        const fromNode = nodes.get(from);
        const toNode = nodes.get(to);
        if (fromNode && toNode && count < 5) {
          console.log(`  - "${fromNode.title}" → "${toNode.title}"`);
          count++;
        }
      }
    }
    console.log('\n');
    
    // Step 6: Export results
    const outputDir = path.join(process.cwd(), 'feed-test-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputFile = path.join(outputDir, `taxonomy-${timestamp}.json`);
    
    const results = {
      metadata: {
        ...metadata,
        testDate: new Date().toISOString(),
        processingTime: {
          fetch: `${fetchTime}ms`,
          build: `${buildTime}ms`,
          merge: `${mergeTime}ms`,
          total: `${fetchTime + buildTime + mergeTime}ms`
        }
      },
      stats: {
        products: {
          total: products.length,
          withProductType: productsWithType,
          withGoogleCategory: productsWithGoogle,
          withBoth: productsWithBoth,
          withImages: productsWithImages,
          withPrices: productsWithPrices
        },
        taxonomy: {
          totalNodes: nodes.size,
          mergedNodes: mergedNodes.size,
          maxDepth: Math.max(...depths),
          avgDepth: parseFloat((depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1)),
          rootCategories: rootNodes.length,
          categoriesWithProducts: productCounts.filter(c => c > 0).length
        }
      },
      rootCategories: rootNodes.slice(0, 20).map(node => ({
        id: node.id,
        title: node.title,
        path: node.path,
        product_count: node.product_count,
        children_count: Array.from(nodes.values()).filter(n => n.parent_id === node.id).length
      })),
      sampleProducts: products.slice(0, 10),
      merges: Array.from(mergeStats.mergeMap).slice(0, 20).map(([from, to]) => ({
        from: nodes.get(from)?.title,
        to: nodes.get(to)?.title
      }))
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${outputFile}`);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✨ Test Complete!');
    console.log('='.repeat(60));
    console.log(`Total processing time: ${fetchTime + buildTime + mergeTime}ms`);
    console.log(`Feed URL: ${feedUrl}`);
    console.log(`Products processed: ${products.length}`);
    console.log(`Categories created: ${nodes.size}`);
    console.log(`Categories after merging: ${mergedNodes.size}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (process.env.DEBUG) {
        console.error('Stack trace:', error.stack);
      }
    }
    process.exit(1);
  }
}

// Run the test
testFeedUrl().catch(console.error);