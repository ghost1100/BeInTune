const fs = require('fs');

const completeJson = {
  "type": "service_account",
  "project_id": "calendar-access-474717",
  "private_key_id": "68440410a0d2fe1bca6c0bda2290e77fd3efd333",
  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCpL/Y7TnkmabPK\\n0IMtZaaZ8NZOHse/1l8pHiUGoEREqKX/tOhM+VmmUvX9jwfr1p2WyVCbjXh/LE7Z\\n6eV93CCg7cv++XL7bAGQ416aXGoVVye5zbGrWv8XmyvPQDPMQnKOVIeujgttfcLF\\nUYYfISup3E41+Chaq8Jb5fXt2q5F62i1SZUpNXV6极客"
};

fs.writeFileSync('service-account-complete.json', JSON.stringify(completeJson, null, 2));
console.log('Complete JSON file created');
