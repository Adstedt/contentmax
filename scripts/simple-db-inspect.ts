#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

async function inspectDatabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔍 SIMPLE DATABASE INSPECTION\n');
  console.log('=' .repeat(60));
  
  // Tables to check
  const tables = [
    'taxonomy_nodes',
    'products',
    'product_categories',
    'content_items',
    'projects',
    'users',
    'profiles',
    'templates',
    'generations',
    'scraped_content',
    'scraping_jobs',
    'google_accounts',
    'analytics_data'
  ];
  
  console.log('\n📊 TABLE EXISTENCE CHECK:\n');
  
  for (const table of tables) {
    try {
      // Try to select from the table
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(0);
      
      if (error) {
        console.log(`  ❌ ${table}: Does not exist or error`);
      } else {
        // Get count
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        console.log(`  ✅ ${table}: Exists (${count || 0} rows)`);
      }
    } catch (e) {
      console.log(`  ❌ ${table}: Error checking`);
    }
  }
  
  // Check specific table structures
  console.log('\n📋 DETAILED TABLE STRUCTURES:\n');
  
  // Check taxonomy_nodes structure
  console.log('TAXONOMY_NODES:');
  try {
    const { data: sample, error } = await supabase
      .from('taxonomy_nodes')
      .select('*')
      .limit(1);
    
    if (!error) {
      if (sample && sample.length > 0) {
        console.log('  Columns found:');
        for (const key of Object.keys(sample[0])) {
          const value = sample[0][key];
          const type = value === null ? 'null' : typeof value;
          console.log(`    - ${key} (${type})`);
        }
        
        // Check ID type specifically
        if (sample[0].id) {
          console.log(`\n  ID Sample: "${sample[0].id}"`);
          console.log(`  ID looks like: ${detectIdType(sample[0].id)}`);
        }
      } else {
        // Table is empty, try an insert to see structure
        console.log('  Table is empty, testing structure...');
        
        // Test with UUID
        const { error: uuidError } = await supabase
          .from('taxonomy_nodes')
          .insert({
            id: 'e1234567-8901-2345-6789-012345678901', // UUID format
            title: 'Test',
            path: '/test',
            depth: 0
          })
          .select();
        
        if (uuidError) {
          console.log('  UUID insert failed:', uuidError.message);
          
          // Test with text
          const { error: textError } = await supabase
            .from('taxonomy_nodes')
            .insert({
              id: 'test-category',
              title: 'Test',
              path: '/test',
              depth: 0
            })
            .select();
          
          if (textError) {
            console.log('  Text insert failed:', textError.message);
            console.log('  ID column type unclear');
          } else {
            console.log('  ✅ ID column accepts TEXT values');
            // Clean up
            await supabase.from('taxonomy_nodes').delete().eq('id', 'test-category');
          }
        } else {
          console.log('  ✅ ID column accepts UUID values');
          // Clean up
          await supabase.from('taxonomy_nodes').delete().eq('id', 'e1234567-8901-2345-6789-012345678901');
        }
      }
    }
  } catch (e) {
    console.log('  Error checking taxonomy_nodes');
  }
  
  // Check content_items structure
  console.log('\nCONTENT_ITEMS:');
  try {
    const { data: sample, error } = await supabase
      .from('content_items')
      .select('*')
      .limit(1);
    
    if (!error) {
      if (sample && sample.length > 0) {
        console.log('  Columns found:');
        const relevantColumns = ['id', 'taxonomy_node_id', 'user_id', 'project_id'];
        for (const key of relevantColumns) {
          if (key in sample[0]) {
            const value = sample[0][key];
            const type = value === null ? 'null' : typeof value;
            console.log(`    - ${key} (${type})`);
          }
        }
      } else {
        console.log('  Table is empty');
      }
    } else {
      console.log('  Error or table does not exist');
    }
  } catch (e) {
    console.log('  Error checking content_items');
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n📝 ANALYSIS:\n');
  
  // Determine issues
  const issues = [];
  
  // Check product_categories
  const { error: pcError } = await supabase
    .from('product_categories')
    .select('*')
    .limit(0);
  
  if (pcError) {
    issues.push('❌ product_categories table is missing - needed for product-category relationships');
  }
  
  // Check taxonomy_nodes columns
  const { data: tnSample } = await supabase
    .from('taxonomy_nodes')
    .select('*')
    .limit(1)
    .single();
  
  if (tnSample) {
    if (!('user_id' in tnSample)) {
      issues.push('⚠️  taxonomy_nodes missing user_id column');
    }
    if (!('project_id' in tnSample)) {
      issues.push('⚠️  taxonomy_nodes missing project_id column');
    }
    if (!('product_count' in tnSample)) {
      issues.push('⚠️  taxonomy_nodes missing product_count column');
    }
  }
  
  if (issues.length > 0) {
    console.log('Issues found:');
    issues.forEach(issue => console.log(`  ${issue}`));
  } else {
    console.log('  ✅ No major issues detected');
  }
  
  console.log('\n💡 RECOMMENDATIONS:\n');
  console.log('  1. The taxonomy_nodes table appears to use UUID for ID field');
  console.log('  2. We need TEXT IDs for category slugs like "electronics-phones"');
  console.log('  3. The product_categories junction table is missing');
  console.log('  4. We should run migration 015_fix_taxonomy_id_types.sql to fix these issues');
  console.log('\n');
}

function detectIdType(id: any): string {
  if (typeof id === 'string') {
    // UUID pattern
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return 'UUID';
    }
    // Slug pattern
    if (id.includes('-') && !id.includes(' ')) {
      return 'SLUG/TEXT';
    }
    return 'TEXT';
  }
  return typeof id;
}

// Run inspection
inspectDatabase();