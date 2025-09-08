const https = require('https');

// Your OAuth credentials
const CLIENT_ID = '1023065173174-t7g69et4i88i3m2h1eo1v7489034reid.apps.googleusercontent.com';
const CLIENT_SECRET = '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';

console.log('Testing Google OAuth Credentials...\n');
console.log('Client ID:', CLIENT_ID);
console.log('Client Secret:', CLIENT_SECRET.substring(0, 10) + '...');

// Test token endpoint with invalid grant (this should give us a different error if credentials are valid)
const postData = new URLSearchParams({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  grant_type: 'authorization_code',
  code: 'invalid_test_code',
  redirect_uri: 'http://localhost:3000/api/integrations/google/callback'
}).toString();

const options = {
  hostname: 'oauth2.googleapis.com',
  path: '/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse Status:', res.statusCode);
    console.log('Response:', data);
    
    const response = JSON.parse(data);
    
    if (response.error === 'invalid_grant') {
      console.log('\n✅ GOOD NEWS: Your OAuth credentials are VALID!');
      console.log('The "invalid_grant" error is expected since we used a fake auth code.');
      console.log('Your client ID and secret are recognized by Google.');
    } else if (response.error === 'invalid_client') {
      console.log('\n❌ BAD NEWS: Your OAuth credentials are INVALID!');
      console.log('Google does not recognize this client ID/secret combination.');
      console.log('\nPossible causes:');
      console.log('1. The OAuth client was deleted in Google Cloud Console');
      console.log('2. The client secret was regenerated and you have an old one');
      console.log('3. The client belongs to a different Google Cloud project');
      console.log('\nSolution: Create a new OAuth 2.0 client in Google Cloud Console');
    } else {
      console.log('\nUnexpected response:', response);
    }
  });
});

req.on('error', (e) => {
  console.error('Error testing credentials:', e);
});

req.write(postData);
req.end();