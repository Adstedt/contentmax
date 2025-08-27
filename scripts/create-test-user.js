const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.log(
    'Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createTestUser() {
  console.log('Creating test user...');

  const email = 'test@contentmax.com';
  const password = 'Test123456!';

  try {
    // Create user using admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
    });

    if (error) {
      if (error.message.includes('already exists')) {
        console.log('Test user already exists');
        console.log('');
        console.log('Test Credentials:');
        console.log('Email:', email);
        console.log('Password:', password);
        return;
      }
      throw error;
    }

    console.log('✅ Test user created successfully!');
    console.log('');
    console.log('Test Credentials:');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('');
    console.log('You can now login at: http://localhost:3000/auth/login');
  } catch (error) {
    console.error('Error creating test user:', error.message);
    process.exit(1);
  }
}

createTestUser();
