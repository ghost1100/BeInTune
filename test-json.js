const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
console.log('Raw length:', raw?.length || 0);

// Try base64 decode first
try {
  const decoded = Buffer.from(raw, 'base64').toString('utf8');
  console.log('Base64 decoded length:', decoded.length);
  const creds = JSON.parse(decoded);
  console.log('✅ Base64 decode successful');
  console.log('Client email:', creds.client_email);
} catch (e) {
  console.log('❌ Base64 decode failed:', e.message);
}

// Try direct JSON parse
try {
  const creds = JSON.parse(raw);
  console.log('✅ Direct JSON parse successful');
  console.log('Client email:', creds.client_email);
} catch (e) {
  console.log('❌ Direct JSON parse failed:', e.message);
}
