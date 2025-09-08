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

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }
  
  console.log('🚀 Running database migration...\n');
  console.log('This migration will:');
  console.log('  1. Change taxonomy_nodes.id from UUID to TEXT');
  console.log('  2. Change taxonomy_nodes.parent_id from UUID to TEXT');
  console.log('  3. Add missing columns (user_id, project_id, product_count)');
  console.log('  4. Create product_categories junction table');
  console.log('  5. Set up proper foreign key relationships\n');
  
  // Read the migration file
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '015_fix_taxonomy_id_types.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('Migration file not found:', migrationPath);
    process.exit(1);
  }
  
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  
  console.log('📝 Migration SQL loaded from:', migrationPath);
  console.log('\n' + '=' .repeat(60));
  console.log('\n⚠️  IMPORTANT: This migration should be run in the Supabase Dashboard');
  console.log('\nSteps to run the migration:');
  console.log('  1. Go to: https://supabase.com/dashboard/project/zjtrssubwocvooygfxbj/sql/new');
  console.log('  2. Copy and paste the migration SQL below');
  console.log('  3. Click "Run" to execute the migration');
  console.log('  4. Check the results for any errors\n');
  console.log('=' .repeat(60));
  console.log('\n📋 MIGRATION SQL TO COPY:\n');
  console.log('=' .repeat(60));
  console.log(migrationSQL);
  console.log('=' .repeat(60));
  console.log('\n✅ After running the migration, the import should work correctly!');
  
  // Also save to a file for easy access
  const outputPath = path.join(process.cwd(), 'run-this-migration.sql');
  fs.writeFileSync(outputPath, migrationSQL);
  console.log('\n📁 Migration also saved to:', outputPath);
}

// Run the migration helper
runMigration();