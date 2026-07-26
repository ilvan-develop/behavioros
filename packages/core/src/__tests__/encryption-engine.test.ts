import { describe, expect, test } from 'vitest';
import { EncryptionEngine } from '../engines/security/encryption-engine';

describe('EncryptionEngine', () => {
  const engine = new EncryptionEngine();

  test('generateKey returns a base64-encoded 256-bit key', () => {
    const key = engine.generateKey();
    expect(key).toBeTruthy();
    expect(typeof key).toBe('string');
    const buf = Buffer.from(key, 'base64');
    expect(buf.length).toBe(32);
  });

  test('symmetric encrypt/decrypt round-trip', () => {
    const key = engine.generateKey();
    const plaintext = 'Hello, BehaviorOS!';
    const ciphertext = engine.encryptSymmetric(plaintext, key);
    expect(ciphertext).not.toBe(plaintext);
    const decrypted = engine.decryptSymmetric(ciphertext, key);
    expect(decrypted).toBe(plaintext);
  });

  test('different keys produce different ciphertext', () => {
    const key1 = engine.generateKey();
    const key2 = engine.generateKey();
    const plaintext = 'same data';
    const ct1 = engine.encryptSymmetric(plaintext, key1);
    const ct2 = engine.encryptSymmetric(plaintext, key2);
    expect(ct1).not.toBe(ct2);
  });

  test('decrypt with wrong key fails', () => {
    const key1 = engine.generateKey();
    const key2 = engine.generateKey();
    const ciphertext = engine.encryptSymmetric('secret', key1);
    expect(() => engine.decryptSymmetric(ciphertext, key2)).toThrow();
  });

  test('generateKeyPair returns valid KeyPair', () => {
    const kp = engine.generateKeyPair();
    expect(kp.publicKey).toBeTruthy();
    expect(kp.privateKey).toBeTruthy();
    expect(kp.algorithm).toBe('RSA-OAEP');
    expect(kp.createdAt).toBeTruthy();
    expect(kp.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(kp.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
  });

  test('asymmetric encrypt/decrypt round-trip', () => {
    const kp = engine.generateKeyPair();
    const plaintext = 'asymmetric secret';
    const ciphertext = engine.encryptAsymmetric(plaintext, kp.publicKey);
    expect(ciphertext).not.toBe(plaintext);
    const decrypted = engine.decryptAsymmetric(ciphertext, kp.privateKey);
    expect(decrypted).toBe(plaintext);
  });

  test('hash produces sha256 hex output', () => {
    const hash = engine.hash('test data');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('hash with hmac algorithm', () => {
    const hash = engine.hash('test data', 'hmac');
    expect(hash).toBeTruthy();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('hash is deterministic', () => {
    const a = engine.hash('hello');
    const b = engine.hash('hello');
    expect(a).toBe(b);
  });

  test('sign/verify round-trip', () => {
    const kp = engine.generateKeyPair();
    const data = 'message to sign';
    const sig = engine.sign(data, kp.privateKey);
    expect(sig).toBeTruthy();
    expect(engine.verify(data, sig, kp.publicKey)).toBe(true);
  });

  test('verify rejects tampered data', () => {
    const kp = engine.generateKeyPair();
    const sig = engine.sign('original', kp.privateKey);
    expect(engine.verify('tampered', sig, kp.publicKey)).toBe(false);
  });

  test('verify rejects wrong key', () => {
    const kp1 = engine.generateKeyPair();
    const kp2 = engine.generateKeyPair();
    const sig = engine.sign('data', kp1.privateKey);
    expect(engine.verify('data', sig, kp2.publicKey)).toBe(false);
  });

  test('rotateKey re-encrypts all data with new key', () => {
    const oldKey = engine.generateKey();
    const data = ['sensitive-1', 'sensitive-2', 'sensitive-3'];
    const encrypted = data.map((d) => engine.encryptSymmetric(d, oldKey));
    const result = engine.rotateKey(oldKey, encrypted);
    expect(result.newKey).not.toBe(oldKey);
    expect(result.reEncrypted).toHaveLength(3);
    result.reEncrypted.forEach((ct) => {
      expect(ct).not.toBe('');
    });
    const decrypted = result.reEncrypted.map((ct) => engine.decryptSymmetric(ct, result.newKey));
    expect(decrypted).toEqual(data);
  });

  test('rotateKey with invalid old key fails', () => {
    const key = engine.generateKey();
    const wrongKey = engine.generateKey();
    const encrypted = engine.encryptSymmetric('data', key);
    expect(() => engine.rotateKey(wrongKey, [encrypted])).toThrow();
  });
});
