import { FeedTaxonomyBuilder } from '@/lib/taxonomy/feed-taxonomy-builder';
import { CategoryMerger } from '@/lib/taxonomy/category-merger';
import fs from 'fs';
import path from 'path';

async function testWithRealFeed() {
  console.log('🚀 Testing Feed Taxonomy Builder with Real Data\n');
  
  try {
    // Load the product feed (adjust path as needed)
    const feedPath = process.argv[2];
    if (!feedPath) {
      console.error('Please provide path to feed file as argument');
      console.log('Usage: npm run test-feed path/to/feed.json');
      process.exit(1);
    }
    
    const feedData = JSON.parse(fs.readFileSync(feedPath, 'utf-8'));
    
    // Extract products from feed (handle different feed formats)
    let products = [];
    if (Array.isArray(feedData)) {
      products = feedData;
    } else if (feedData.products) {
      products = feedData.products;
    } else if (feedData.items) {
      products = feedData.items;
    } else if (feedData.feed?.entry) {
      // Google Shopping feed format
      products = feedData.feed.entry;
    }
    
    console.log(`📦 Found ${products.length} products in feed\n`);
    
    // Sample first few products to show structure
    console.log('Sample product structure:');
    const sampleProduct = products[0];
    console.log(JSON.stringify({
      id: sampleProduct.id || sampleProduct.product_id,
      title: sampleProduct.title || sampleProduct.product_title,
      product_type: sampleProduct.product_type,
      google_product_category: sampleProduct.google_product_category,
    }, null, 2));
    console.log('\n');
    
    // Build taxonomy
    console.log('🏗️  Building taxonomy...');
    const builder = new FeedTaxonomyBuilder();
    await builder.buildFromProductFeed(products, { skipPersist: true });
    
    const nodes = builder.getNodes();
    const productAssignments = builder.getProductAssignments();
    
    console.log(`✅ Created ${nodes.size} taxonomy nodes\n`);
    
    // Show hierarchy statistics
    const depths = Array.from(nodes.values()).map(n => n.depth);
    const productCounts = Array.from(nodes.values()).map(n => n.product_count);
    
    console.log('📊 Taxonomy Statistics:');
    console.log(`  - Total categories: ${nodes.size}`);
    console.log(`  - Max depth: ${Math.max(...depths)}`);
    console.log(`  - Categories with products: ${productCounts.filter(c => c > 0).length}`);
    console.log(`  - Total product assignments: ${Array.from(productAssignments.values()).reduce((sum, set) => sum + set.size, 0)}`);
    console.log('\n');
    
    // Show top-level categories
    const rootNodes = Array.from(nodes.values())
      .filter(n => !n.parent_id)
      .sort((a, b) => b.product_count - a.product_count);
    
    console.log('🌳 Top-Level Categories:');
    rootNodes.slice(0, 10).forEach(node => {
      console.log(`  - ${node.title} (${node.product_count} products)`);
    });
    console.log('\n');
    
    // Show deepest paths
    const deepestNodes = Array.from(nodes.values())
      .filter(n => n.depth === Math.max(...depths))
      .slice(0, 5);
    
    console.log('🔍 Sample Deep Categories:');
    deepestNodes.forEach(node => {
      console.log(`  - ${node.path} (depth: ${node.depth})`);
    });
    console.log('\n');
    
    // Test category merging
    console.log('🔀 Testing Category Merger...');
    const merger = new CategoryMerger();
    const mergedNodes = merger.mergeSimilarCategories(nodes);
    const mergeStats = merger.getMergeStats();
    
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
    
    // Export results for inspection
    const outputPath = path.join(process.cwd(), 'taxonomy-test-results.json');
    const results = {
      stats: {
        totalProducts: products.length,
        totalNodes: nodes.size,
        mergedNodes: mergedNodes.size,
        maxDepth: Math.max(...depths),
      },
      rootCategories: rootNodes.slice(0, 20),
      samplePaths: Array.from(nodes.values())
        .slice(0, 50)
        .map(n => ({
          id: n.id,
          title: n.title,
          path: n.path,
          depth: n.depth,
          product_count: n.product_count
        }))
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the test
testWithRealFeed();