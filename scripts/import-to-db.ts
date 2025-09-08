#!/usr/bin/env tsx

// Quick script to import feed directly to database for testing
import 'dotenv/config';

async function importFeedToDatabase() {
  const feedUrl = process.argv[2] || 'https://www.kontorab.se/GoogleProductFeed/index?marketId=SWE&language=sv-SE';
  
  console.log('🚀 Importing feed to database...');
  console.log(`📍 URL: ${feedUrl}\n`);
  
  try {
    // Call the import API endpoint
    const response = await fetch('http://localhost:3000/api/taxonomy/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth header if needed
      },
      body: JSON.stringify({
        type: 'url',
        url: feedUrl,
        options: {
          mergeSimilar: true,
          persistToDatabase: true,
        },
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Import failed:', data.error);
      console.error('Details:', data);
      process.exit(1);
    }
    
    console.log('✅ Import successful!');
    console.log('\n📊 Results:');
    console.log(`  - Total products: ${data.taxonomy?.stats?.totalProducts || 0}`);
    console.log(`  - Categories created: ${data.taxonomy?.nodes || 0}`);
    console.log(`  - Max depth: ${data.taxonomy?.stats?.maxDepth || 0}`);
    
    if (data.taxonomy?.topCategories) {
      console.log('\n🌳 Top Categories:');
      data.taxonomy.topCategories.slice(0, 5).forEach((cat: any) => {
        console.log(`  - ${cat.title}: ${cat.product_count} products`);
      });
    }
    
    console.log('\n💾 Data has been stored in the database');
    console.log('🎯 Visit http://localhost:3000/dashboard/taxonomy to see the visualization');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the import
importFeedToDatabase();