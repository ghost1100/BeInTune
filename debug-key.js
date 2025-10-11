const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const decoded = Buffer.from(raw, "base64").toString("utf8");
const creds = JSON.parse(decoded);

console.log("Private key preview:");
console.log(creds.private_key.substring(0, 100));
console.log("Private key length:", creds.private_key.length);
console.log(
  "Private key ends with:",
  creds.private_key.substring(creds.private_key.length - 50),
);

// Check if private key has proper format
const hasBegin = creds.private_key.includes("-----BEGIN PRIVATE KEY-----");
const hasEnd = creds.private_key.includes("-----END PRIVATE KEY-----");
console.log("Has BEGIN marker:", hasBegin);
console.log("Has END marker:", hasEnd);
console.log("Newlines in key:", creds.private_key.includes("\\n"));
