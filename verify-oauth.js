const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function verifyOAuthTokens() {
  console.log('Checking Google OAuth tokens in database...\n');
  
  const { data, error } = await supabase
    .from('google_integrations')
    .select('*');
    
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('⚠️  No Google integrations found in database');
    console.log('Please complete the OAuth flow first');
    return;
  }
  
  console.log(`✅ Found ${data.length} Google integration(s):\n`);
  
  data.forEach((integration, index) => {
    console.log(`Integration #${index + 1}:`);
    console.log(`  Email: ${integration.email}`);
    console.log(`  Google ID: ${integration.google_id}`);
    console.log(`  Has Access Token: ${!!integration.access_token}`);
    console.log(`  Has Refresh Token: ${!!integration.refresh_token}`);
    console.log(`  Expires At: ${integration.expires_at}`);
    console.log(`  Scopes: ${integration.scopes}`);
    console.log(`  Created: ${integration.created_at}`);
    console.log(`  Updated: ${integration.updated_at}`);
    console.log('');
  });
}

verifyOAuthTokens();