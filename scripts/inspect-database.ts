#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from multiple sources
const envPath = path.resolve(process.cwd(), '.env.local');
const envPath2 = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envPath2)) {
  dotenv.config({ path: envPath2 });
} else {
  dotenv.config();
}

async function inspectDatabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔍 Inspecting Supabase Database Structure\n');
  console.log('=' .repeat(60));
  
  try {
    // Check taxonomy_nodes structure
    console.log('\n📊 TAXONOMY_NODES TABLE:');
    const { data: taxonomyColumns, error: taxonomyError } = await supabase
      .from('taxonomy_nodes')
      .select('*')
      .limit(0);
    
    if (taxonomyError) {
      console.log('  ❌ Table does not exist or error:', taxonomyError.message);
    } else {
      // Get column information using a query
      const { data: columns } = await supabase.rpc('get_table_columns', {
        table_name: 'taxonomy_nodes'
      }).single();
      
      if (columns) {
        console.log('  ✅ Table exists');
        console.log('  Columns:', columns);
      } else {
        // Alternative: Try to infer from a sample query
        const { data: sample } = await supabase
          .from('taxonomy_nodes')
          .select('*')
          .limit(1);
        
        if (sample && sample.length > 0) {
          console.log('  ✅ Table exists with columns:');
          console.log('  ', Object.keys(sample[0]).join(', '));
        } else {
          console.log('  ✅ Table exists (empty)');
        }
      }
      
      // Count records
      const { count } = await supabase
        .from('taxonomy_nodes')
        .select('*', { count: 'exact', head: true });
      console.log('  Record count:', count || 0);
    }
    
    // Check products table
    console.log('\n📦 PRODUCTS TABLE:');
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .limit(0);
    
    if (productsError) {
      console.log('  ❌ Table does not exist');
    } else {
      console.log('  ✅ Table exists');
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
      console.log('  Record count:', count || 0);
    }
    
    // Check product_categories table
    console.log('\n🔗 PRODUCT_CATEGORIES TABLE:');
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('product_categories')
      .select('*')
      .limit(0);
    
    if (categoriesError) {
      console.log('  ❌ Table does not exist');
    } else {
      console.log('  ✅ Table exists');
      const { count } = await supabase
        .from('product_categories')
        .select('*', { count: 'exact', head: true });
      console.log('  Record count:', count || 0);
    }
    
    // Check projects table
    console.log('\n📁 PROJECTS TABLE:');
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .limit(0);
    
    if (projectsError) {
      console.log('  ❌ Table does not exist');
    } else {
      console.log('  ✅ Table exists');
      const { count } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });
      console.log('  Record count:', count || 0);
    }
    
    // Try to get schema information
    console.log('\n📋 CHECKING COLUMN DETAILS:');
    
    // Use a raw SQL query to get column information
    const { data: schemaInfo, error: schemaError } = await supabase.rpc('get_schema_info');
    
    if (!schemaError && schemaInfo) {
      console.log('Schema information:', schemaInfo);
    } else {
      // Try alternative approach
      console.log('  Attempting to read taxonomy_nodes structure...');
      
      const { data: testInsert, error: insertError } = await supabase
        .from('taxonomy_nodes')
        .insert({
          id: 'test-' + Date.now(),
          title: 'Test Node',
          path: '/test',
          depth: 0
        })
        .select();
      
      if (insertError) {
        console.log('  Insert test error:', insertError.message);
        console.log('  Missing columns:', insertError.details);
      } else {
        console.log('  ✅ Basic insert works');
        // Clean up test data
        if (testInsert && testInsert[0]) {
          await supabase
            .from('taxonomy_nodes')
            .delete()
            .eq('id', testInsert[0].id);
        }
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Inspection complete!\n');
    
    // Provide recommendations
    console.log('📝 RECOMMENDATIONS:\n');
    
    if (productsError) {
      console.log('1. Create products table:');
      console.log('   Run migration: 013_add_user_columns.sql');
    }
    
    if (categoriesError) {
      console.log('2. Create product_categories table:');
      console.log('   Run migration: 013_add_user_columns.sql');
    }
    
    console.log('\n💡 To fix missing tables/columns:');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Run the migration script');
    console.log('   3. Try importing again');
    
  } catch (error) {
    console.error('Error inspecting database:', error);
  }
}

// Add RPC function for getting table columns (create this in Supabase if needed)
const GET_COLUMNS_FUNCTION = `
CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
RETURNS json AS $$
BEGIN
  RETURN (
    SELECT json_agg(column_name)
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = $1
  );
END;
$$ LANGUAGE plpgsql;
`;

// Add RPC function for schema info
const GET_SCHEMA_INFO = `
CREATE OR REPLACE FUNCTION get_schema_info()
RETURNS TABLE(
  table_name text,
  column_name text,
  data_type text,
  is_nullable text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  AND c.table_name IN ('taxonomy_nodes', 'products', 'product_categories')
  ORDER BY c.table_name, c.ordinal_position;
END;
$$ LANGUAGE plpgsql;
`;

console.log('💡 TIP: If some checks fail, you may need to create these helper functions:');
console.log('\n' + GET_COLUMNS_FUNCTION);
console.log('\n' + GET_SCHEMA_INFO);

// Run the inspection
inspectDatabase();