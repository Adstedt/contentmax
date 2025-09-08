const https = require('https');

// You'll need to get a valid session cookie from the browser
// Open DevTools > Application > Cookies and copy the session cookie value
console.log(`
To test GA properties:
1. Open http://localhost:3000/settings/integrations in your browser
2. Open DevTools (F12) > Application > Cookies
3. Look for cookies from localhost:3000
4. Copy the session cookie values
5. Then run: node test-ga-direct.js

Or simply visit: http://localhost:3000/api/integrations/google/ga-properties
in your logged-in browser to see the GA properties.
`);

// Manual test URL
console.log('\nDirect test URL (use in logged-in browser):');
console.log('http://localhost:3000/api/integrations/google/ga-properties');