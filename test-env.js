// Test that environment variables are loaded correctly
console.log('Testing environment variables:\n');

console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID || 'NOT SET');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 
  process.env.GOOGLE_CLIENT_SECRET.substring(0, 10) + '...' : 'NOT SET');
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI || 'NOT SET');

// Load .env.local file
require('dotenv').config({ path: '.env.local' });

console.log('\nAfter loading .env.local:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID || 'NOT SET');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 
  process.env.GOOGLE_CLIENT_SECRET.substring(0, 10) + '...' : 'NOT SET');
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI || 'NOT SET');