const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
console.log('First 100 chars:', raw?.slice(0, 100));
console.log('Last 100 chars:', raw?.slice(-100));
console.log('Full content (truncated):', raw?.substring(0, 200) + '...' + raw?.substring(raw.length - 50));
