const json = {
  "type": "service_account",
  "project_id": "calendar-access-474717",
  "private_key_id": "68440410a0d2fe1bca6c0bda2290e77fd3efd333",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCpL/Y7TnkmabPK\n0IMtZaaZ8NZOHse/1l8pHiUGoEREqKX/tOhM+VmmUvX9jwfr1p2WyVCbjXh/LE7Z\n6eV93CCg7cv++XL7bAGQ416aXGoVVye5zbGr极客"
};

const jsonString = JSON.stringify(json);
const base64 = Buffer.from(jsonString).toString('base64');
console.log('Base64 encoded:', base64);
console.log('Length:', base64.length);
