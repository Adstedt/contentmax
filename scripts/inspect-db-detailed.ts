#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
const envPath2 = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envPath2)) {
  dotenv.config({ path: envPath2 });
} else {
  dotenv.config();
}

async function inspectDatabaseDetailed() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔍 DETAILED DATABASE INSPECTION\n');
  console.log('=' .repeat(80));
  
  try {
    // First, create helper function in database to get schema info
    // Skip this check as it's not a valid RPC call
    
    // Try to create the inspection function (might fail if sql method doesn't exist)
    try {
      await supabase.sql`
      CREATE OR REPLACE FUNCTION get_detailed_schema()
      RETURNS TABLE(
        table_name text,
        column_name text,
        data_type text,
        is_nullable text,
        column_default text,
        constraint_type text,
        constraint_name text,
        foreign_table text,
        foreign_column text
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          c.table_name::text,
          c.column_name::text,
          c.data_type::text,
          c.is_nullable::text,
          c.column_default::text,
          tc.constraint_type::text,
          tc.constraint_name::text,
          ccu.table_name::text as foreign_table,
          ccu.column_name::text as foreign_column
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu
          ON c.table_name = kcu.table_name 
          AND c.column_name = kcu.column_name
          AND c.table_schema = kcu.table_schema
        LEFT JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name
          AND kcu.table_schema = tc.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position;
      END;
      $$ LANGUAGE plpgsql;
    `;
    } catch (e) {
      // SQL method might not exist, continue anyway
    }
    
    // Get all tables
    const { data: tables } = await supabase.rpc('get_all_tables', {}).catch(() => ({ data: null }));
    
    // Alternative: Query information_schema directly
    const allTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    // Get list of all tables
    console.log('\n📊 ALL TABLES IN DATABASE:\n');
    const { data: tableList, error: tableError } = await supabase
      .rpc('get_public_tables', {})
      .catch(async () => {
        // Fallback: try to list known tables
        const knownTables = [
          'projects', 'users', 'profiles', 'taxonomy_nodes', 'products', 
          'product_categories', 'content_items', 'templates', 'generations',
          'scraped_content', 'scraping_jobs', 'google_accounts', 'analytics_data'
        ];
        
        const found = [];
        for (const table of knownTables) {
          const { error } = await supabase.from(table).select('*').limit(0);
          if (!error) found.push(table);
        }
        return { data: found };
      });
    
    if (tableList) {
      for (const table of Array.isArray(tableList) ? tableList : [tableList]) {
        const tableName = typeof table === 'string' ? table : table.table_name;
        console.log(`  • ${tableName}`);
      }
    }
    
    // Detailed inspection of key tables
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 DETAILED TABLE STRUCTURES:\n');
    
    // Tables to inspect in detail
    const tablesToInspect = [
      'taxonomy_nodes',
      'products', 
      'product_categories',
      'content_items',
      'projects'
    ];
    
    for (const tableName of tablesToInspect) {
      console.log(`\n📊 ${tableName.toUpperCase()} TABLE:`);
      console.log('-'.repeat(40));
      
      // Try to get table structure
      const { data: sample, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.log(`  ❌ Table does not exist or error: ${sampleError.message}`);
        continue;
      }
      
      console.log(`  ✅ Table exists`);
      
      // Get row count
      const { count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      console.log(`  📊 Row count: ${count || 0}`);
      
      // Show columns
      if (sample && sample.length > 0) {
        console.log(`  📋 Columns:`);
        const columns = Object.keys(sample[0]);
        for (const col of columns) {
          const value = sample[0][col];
          const type = value === null ? 'null' : typeof value;
          console.log(`     - ${col} (${type})`);
        }
      } else {
        // Try to infer structure from error messages
        console.log(`  📋 Table is empty, attempting to detect structure...`);
        
        // Try an insert to see what columns are required
        const { error: insertError } = await supabase
          .from(tableName)
          .insert({ test: 'test' })
          .select();
        
        if (insertError && insertError.message) {
          console.log(`  💡 Structure hint from error: ${insertError.message}`);
        }
      }
    }
    
    // Check foreign key relationships
    console.log('\n' + '='.repeat(80));
    console.log('\n🔗 FOREIGN KEY RELATIONSHIPS:\n');
    
    const fkQuery = `
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `;
    
    // Try to get foreign keys
    const { data: fks } = await supabase.rpc('get_foreign_keys', {}).catch(() => ({ data: null }));
    
    if (fks) {
      for (const fk of fks) {
        console.log(`  ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      }
    } else {
      // Manual check for specific relationships
      console.log('  Checking known relationships...');
      
      // Check taxonomy_nodes parent relationship
      const { error: parentError } = await supabase
        .from('taxonomy_nodes')
        .select('id, parent_id')
        .limit(1);
      
      if (!parentError) {
        console.log('  ✓ taxonomy_nodes.parent_id → taxonomy_nodes.id (self-reference)');
      }
      
      // Check content_items relationship
      const { error: contentError } = await supabase
        .from('content_items')
        .select('taxonomy_node_id')
        .limit(1);
      
      if (!contentError) {
        console.log('  ✓ content_items.taxonomy_node_id → taxonomy_nodes.id');
      }
    }
    
    // Check data types for critical columns
    console.log('\n' + '='.repeat(80));
    console.log('\n🔍 CRITICAL COLUMN DATA TYPES:\n');
    
    // Check taxonomy_nodes ID types
    const { data: taxonomySample } = await supabase
      .from('taxonomy_nodes')
      .select('id, parent_id')
      .limit(1);
    
    if (taxonomySample && taxonomySample.length > 0) {
      const idSample = taxonomySample[0].id;
      const parentSample = taxonomySample[0].parent_id;
      
      console.log('  taxonomy_nodes.id:');
      console.log(`    Sample value: ${idSample}`);
      console.log(`    Looks like: ${detectType(idSample)}`);
      
      console.log('  taxonomy_nodes.parent_id:');
      console.log(`    Sample value: ${parentSample}`);
      console.log(`    Looks like: ${detectType(parentSample)}`);
    }
    
    // Summary and recommendations
    console.log('\n' + '='.repeat(80));
    console.log('\n📝 ANALYSIS & RECOMMENDATIONS:\n');
    
    // Check for issues
    const issues = [];
    
    // Check if product_categories exists
    const { error: pcError } = await supabase
      .from('product_categories')
      .select('*')
      .limit(0);
    
    if (pcError) {
      issues.push('❌ product_categories table is missing');
    }
    
    // Check taxonomy_nodes structure
    const { data: tnSample } = await supabase
      .from('taxonomy_nodes')
      .select('*')
      .limit(1);
    
    if (tnSample && tnSample.length > 0) {
      const hasUserId = 'user_id' in tnSample[0];
      const hasProductCount = 'product_count' in tnSample[0];
      
      if (!hasUserId) issues.push('❌ taxonomy_nodes missing user_id column');
      if (!hasProductCount) issues.push('❌ taxonomy_nodes missing product_count column');
    }
    
    if (issues.length > 0) {
      console.log('Issues found:');
      issues.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log('  ✅ No major issues detected');
    }
    
    console.log('\n💡 Next steps:');
    console.log('  1. Review the table structures above');
    console.log('  2. Identify any missing tables or columns');
    console.log('  3. Run appropriate migrations to fix issues');
    
  } catch (error) {
    console.error('Error during inspection:', error);
  }
}

function detectType(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  
  // UUID pattern
  if (typeof value === 'string' && 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return 'UUID';
  }
  
  // Text patterns
  if (typeof value === 'string') {
    if (value.includes('-') && !value.includes(' ')) return 'SLUG/ID (TEXT)';
    return 'TEXT';
  }
  
  if (typeof value === 'number') return 'NUMBER';
  if (typeof value === 'boolean') return 'BOOLEAN';
  
  return typeof value;
}

// Helper functions that might need to be created in Supabase
const HELPER_FUNCTIONS = `
-- Function to get all public tables
CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE(table_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get foreign keys
CREATE OR REPLACE FUNCTION get_foreign_keys()
RETURNS TABLE(
  table_name text,
  column_name text,
  foreign_table_name text,
  foreign_column_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.table_name::text, 
    kcu.column_name::text, 
    ccu.table_name::text AS foreign_table_name,
    ccu.column_name::text AS foreign_column_name 
  FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
  ORDER BY tc.table_name;
END;
$$ LANGUAGE plpgsql;
`;

console.log('\n📌 Note: If some queries fail, you may need to create these helper functions:');
console.log(HELPER_FUNCTIONS);

// Run the inspection
inspectDatabaseDetailed();