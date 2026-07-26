import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  sign,
  verify,
} from 'node:crypto';

/**
 * KeyPair — Configuration and options interface.
 */
export interface KeyPair {
  publicKey: string;
  privateKey: string;
  algorithm: string;
  createdAt: string;
}

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function base64(buf: Buffer): string {
  return buf.toString('base64');
}

function fromBase64(str: string): Buffer {
  return Buffer.from(str, 'base64');
}

/**
 * EncryptionEngine — Provides generateKey, generateKeyPair, encryptSymmetric, decryptSymmetric, ... operations.
 */
export class EncryptionEngine {
  generateKey(): string {
    return base64(randomBytes(KEY_LENGTH));
  }

  generateKeyPair(): KeyPair {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return {
      publicKey,
      privateKey,
      algorithm: 'RSA-OAEP',
      createdAt: new Date().toISOString(),
    };
  }

  encryptSymmetric(plaintext: string, key: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, fromBase64(key), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return base64(Buffer.concat([iv, tag, encrypted]));
  }

  decryptSymmetric(ciphertext: string, key: string): string {
    const buf = fromBase64(ciphertext);
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const data = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, fromBase64(key), iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf-8');
  }

  encryptAsymmetric(plaintext: string, publicKey: string): string {
    const encrypted = publicEncrypt(
      { key: publicKey, padding: 1 },
      Buffer.from(plaintext, 'utf-8'),
    );
    return base64(encrypted);
  }

  decryptAsymmetric(ciphertext: string, privateKey: string): string {
    const decrypted = privateDecrypt({ key: privateKey, padding: 1 }, fromBase64(ciphertext));
    return decrypted.toString('utf-8');
  }

  hash(data: string, algorithm: 'sha256' | 'hmac' = 'sha256'): string {
    if (algorithm === 'hmac') {
      return createHmac('sha256', 'behavioros-secret').update(data).digest('hex');
    }
    return createHash('sha256').update(data).digest('hex');
  }

  sign(data: string, privateKey: string): string {
    return base64(sign(null, Buffer.from(data, 'utf-8'), { key: privateKey, padding: 1 }));
  }

  verify(data: string, signature: string, publicKey: string): boolean {
    try {
      return verify(
        null,
        Buffer.from(data, 'utf-8'),
        { key: publicKey, padding: 1 },
        fromBase64(signature),
      );
    } catch {
      return false;
    }
  }

  rotateKey(oldKey: string, data: string[]): { newKey: string; reEncrypted: string[] } {
    const newKey = this.generateKey();
    const reEncrypted = data.map((item) => {
      const plaintext = this.decryptSymmetric(item, oldKey);
      return this.encryptSymmetric(plaintext, newKey);
    });
    return { newKey, reEncrypted };
  }
}
