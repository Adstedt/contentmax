// Test OAuth URL generation
const clientId = '1023065173174-t7g69et4i88i3m2h1eo1v7489034reid.apps.googleusercontent.com';
const redirectUri = 'http://localhost:3000/api/integrations/google/callback';

const scopes = [
  'openid',
  'email', 
  'profile',
  'https://www.googleapis.com/auth/content',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
];

const params = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: scopes.join(' '),
  access_type: 'offline',
  prompt: 'consent'
});

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
console.log('Generated OAuth URL:');
console.log(authUrl);
console.log('\nTest this URL in your browser to verify the client ID is valid.');