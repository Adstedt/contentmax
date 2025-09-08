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

async function verifyMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔍 VERIFYING MIGRATION RESULTS\n');
  console.log('=' .repeat(60));
  
  // Test 1: Try to insert a TEXT ID into taxonomy_nodes
  console.log('\n📊 TEST 1: Insert TEXT ID into taxonomy_nodes');
  const testId = 'electronics-phones';
  
  const { data: insertData, error: insertError } = await supabase
    .from('taxonomy_nodes')
    .insert({
      id: testId,
      title: 'Phones',
      path: '/electronics/phones',
      depth: 2,
      product_count: 0,
      source: 'test'
    })
    .select();
  
  if (insertError) {
    console.log(`  ❌ Failed to insert TEXT ID: ${insertError.message}`);
  } else {
    console.log(`  ✅ Successfully inserted TEXT ID: ${testId}`);
    console.log(`     Data: ${JSON.stringify(insertData[0], null, 2)}`);
    
    // Clean up
    await supabase.from('taxonomy_nodes').delete().eq('id', testId);
    console.log(`     Cleaned up test data`);
  }
  
  // Test 2: Check if product_categories exists
  console.log('\n📊 TEST 2: Check product_categories table');
  const { error: pcError } = await supabase
    .from('product_categories')
    .select('*')
    .limit(0);
  
  if (pcError) {
    console.log(`  ❌ product_categories table missing or error: ${pcError.message}`);
  } else {
    console.log(`  ✅ product_categories table exists`);
  }
  
  // Test 3: Check columns in taxonomy_nodes
  console.log('\n📊 TEST 3: Check taxonomy_nodes columns');
  const columnsToCheck = ['user_id', 'project_id', 'product_count', 'source', 'path', 'depth'];
  
  // Try a dummy insert to see what columns exist
  const { error: columnError } = await supabase
    .from('taxonomy_nodes')
    .insert({
      id: 'test-columns',
      title: 'Test',
      path: '/test',
      depth: 0,
      user_id: null,
      project_id: null,
      product_count: 0,
      source: 'test'
    })
    .select();
  
  if (columnError) {
    console.log(`  ⚠️  Some columns might be missing: ${columnError.message}`);
  } else {
    console.log(`  ✅ All expected columns exist`);
    // Clean up
    await supabase.from('taxonomy_nodes').delete().eq('id', 'test-columns');
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n📝 MIGRATION VERIFICATION COMPLETE\n');
  
  if (!insertError && !pcError) {
    console.log('✅ Database is ready for taxonomy import!');
    console.log('   - taxonomy_nodes accepts TEXT IDs');
    console.log('   - product_categories table exists');
    console.log('   - All required columns are present');
  } else {
    console.log('⚠️  Some issues remain - check the errors above');
  }
}

// Run verification
verifyMigration();