const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('🔄 Testing Supabase connection...');
    console.log(`📍 URL: ${supabaseUrl}`);
    
    // Test if tables exist
    const { data, error } = await supabase
      .from('organizations')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Connection failed:', error.message);
      
      if (error.message.includes('not find the table')) {
        console.log('\n⚠️  Tables do not exist. Please run the migration:');
        console.log('1. Go to your Supabase dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Run the contents of supabase/migrations/001_initial_schema.sql');
      }
      return;
    }

    console.log('✅ Successfully connected to Supabase!');
    console.log('📊 Organizations table exists');
    
    // List all tables
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tables && tables.length > 0) {
      console.log(`\n📋 Found ${tables.length} tables in database`);
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testConnection();