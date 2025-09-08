const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function executeMigration() {
  try {
    console.log('Executing migration...\n');
    
    // Read the SQL file
    const sql = fs.readFileSync('./supabase/migrations/004_google_integrations.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      const trimmedStmt = statement.trim();
      if (!trimmedStmt) continue;
      
      try {
        console.log(`Executing: ${trimmedStmt.substring(0, 50)}...`);
        
        // Use the Supabase admin client to execute raw SQL
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: trimmedStmt + ';' 
        }).single();
        
        if (error) {
          // Try alternative approach - direct query
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ query: trimmedStmt + ';' })
          });
          
          if (!response.ok) {
            console.error(`  ❌ Failed: ${response.statusText}`);
            errorCount++;
          } else {
            console.log(`  ✅ Success`);
            successCount++;
          }
        } else {
          console.log(`  ✅ Success`);
          successCount++;
        }
      } catch (err) {
        console.error(`  ❌ Error: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log(`\nMigration Summary:`);
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);
    
    // Test if tables were created
    console.log('\nVerifying tables...');
    
    const { data: googleIntegrations, error: tableError1 } = await supabase
      .from('google_integrations')
      .select('*')
      .limit(1);
      
    const { data: auditLogs, error: tableError2 } = await supabase
      .from('audit_logs')
      .select('*')
      .limit(1);
    
    if (!tableError1) {
      console.log('✅ Table "google_integrations" exists!');
    } else {
      console.log('❌ Table "google_integrations" not found:', tableError1.message);
    }
    
    if (!tableError2) {
      console.log('✅ Table "audit_logs" exists!');
    } else {
      console.log('❌ Table "audit_logs" not found:', tableError2.message);
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

executeMigration();