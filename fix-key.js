const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const decoded = Buffer.from(raw, 'base64').toString('utf8');
const creds = JSON.parse(decoded);

// URL decode the private key
const fixedPrivateKey = decodeURIComponent(creds.private_key);
console.log('Fixed private key preview:');
console.log(fixedPrivateKey.substring(0, 100));
console.log('Fixed private key ends with:', fixedPrivateKey.substring(fixedPrivateKey.length - 50));

// Test if this fixes the authentication
try {
  const { google } = require('googleapis');
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: fixedPrivateKey,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
  
  await auth.authorize();
  console.log('✅ Authentication successful with fixed key');
} catch (e) {
  console.log('❌ Authentication failed:', e.message);
}
