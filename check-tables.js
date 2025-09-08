const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function checkTables() {
  console.log('Checking existing tables in the database...\n');
  
  // List of tables to check
  const tablesToCheck = [
    'google_integrations',
    'audit_logs',
    'users',
    'profiles',
    'content',
    'templates',
    'taxonomy'
  ];
  
  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0);
      
      if (error) {
        if (error.message.includes('not find the table')) {
          console.log(`❌ Table "${table}" - NOT FOUND`);
        } else {
          console.log(`⚠️  Table "${table}" - EXISTS but error: ${error.message}`);
        }
      } else {
        console.log(`✅ Table "${table}" - EXISTS`);
      }
    } catch (err) {
      console.log(`❌ Table "${table}" - ERROR: ${err.message}`);
    }
  }
  
  // Try to check google_integrations specifically
  console.log('\nChecking google_integrations table specifically...');
  const { data: googleInt, error: googleError } = await supabase
    .from('google_integrations')
    .select('*');
    
  if (googleError) {
    console.log('Error:', googleError.message);
    console.log('\nThe google_integrations table needs to be created.');
    console.log('You need to run the SQL migration in Supabase Dashboard.');
  } else {
    console.log('✅ google_integrations table exists!');
    console.log('Records found:', googleInt?.length || 0);
  }
}

checkTables();