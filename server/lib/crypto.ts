import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY = process.env.MESSAGE_ENCRYPTION_KEY || '';

function getKey() {
  if (!KEY || KEY.length < 32) return null;
  return Buffer.from(KEY.slice(0, 32));
}

export function encryptText(plain: string) {
  const key = getKey();
  if (!key) return { ciphertext: plain, iv: null, tag: null, encrypted: false };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: encrypted.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64'), encrypted: true };
}

export function decryptText(obj: any) {
  const key = getKey();
  if (!key) return obj; // if not encrypted, return as-is
  if (!obj || !obj.ciphertext || !obj.iv || !obj.tag) return obj;
  try {
    const iv = Buffer.from(obj.iv, 'base64');
    const tag = Buffer.from(obj.tag, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(obj.ciphertext, 'base64')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (e) {
    console.error('Failed to decrypt message', e);
    return null;
  }
}

export function digest(value: string) {
  try {
    const v = String(value || "").toLowerCase();
    return crypto.createHash('sha256').update(v).digest('hex');
  } catch (e) {
    return null as any;
  }
}
