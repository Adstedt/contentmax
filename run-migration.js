const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '004_google_integrations.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration: Google Integrations table...\n');
    
    // Execute the SQL
    const { error } = await supabase.from('_migrations').select('*').limit(1);
    
    if (error && error.code === '42P01') {
      console.log('Note: This is the first migration. Creating tables...\n');
    }
    
    // Run the migration using Supabase's raw SQL execution
    console.log('Creating google_integrations table...');
    
    // Since we can't run raw SQL directly via the JS client, we'll create the table using the Supabase Dashboard
    console.log('\n📋 Please run the following SQL in your Supabase SQL Editor:');
    console.log('================================================');
    console.log('Go to: https://supabase.com/dashboard/project/zjtrssubwocvooygfxbj/sql/new');
    console.log('================================================\n');
    console.log(sql);
    console.log('\n================================================');
    console.log('After running the SQL, the integration will be fully functional!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration();