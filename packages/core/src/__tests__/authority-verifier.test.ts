import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthorityVerifier } from '../security/authority-verifier';

describe('AuthorityVerifier', () => {
  let keyDir: string;
  let verifier: AuthorityVerifier;

  beforeEach(() => {
    keyDir = mkdtempSync(join(tmpdir(), 'bos-auth-test-'));
    verifier = new AuthorityVerifier({ keyDir, defaultTtlMs: 60_000 });
  });

  afterEach(() => {
    rmSync(keyDir, { recursive: true, force: true });
  });

  describe('key pair generation', () => {
    it('should generate key files on first use', () => {
      const { existsSync } = require('node:fs');
      expect(existsSync(join(keyDir, 'authority-key.pem'))).toBe(true);
      expect(existsSync(join(keyDir, 'authority-key.pub.pem'))).toBe(true);
    });

    it('should reuse existing key files', () => {
      const v2 = new AuthorityVerifier({ keyDir, defaultTtlMs: 60_000 });
      const pk1 = verifier.getPublicKey();
      const pk2 = v2.getPublicKey();
      expect(pk1).toBe(pk2);
    });

    it('should return a PEM-formatted public key', () => {
      const pk = verifier.getPublicKey();
      expect(pk).toContain('BEGIN PUBLIC KEY');
      expect(pk).toContain('END PUBLIC KEY');
    });
  });

  describe('token creation and verification', () => {
    it('should create a valid token', () => {
      const token = verifier.generateToken('agent-1', 'senior');
      expect(token.agentId).toBe('agent-1');
      expect(token.level).toBe('senior');
      expect(token.issuedAt).toBeGreaterThan(0);
      expect(token.expiresAt).toBeGreaterThan(token.issuedAt);
      expect(token.signature).toBeTruthy();
    });

    it('should verify a valid token', () => {
      const token = verifier.generateToken('agent-1', 'architect');
      const result = verifier.verify(token);
      expect(result.valid).toBe(true);
      expect(result.token).toEqual(token);
    });

    it('should verify tokens with all authority levels', () => {
      const levels = [
        'junior',
        'senior',
        'architect',
        'lead',
        'director',
        'vp',
        'c-level',
      ] as const;
      for (const level of levels) {
        const token = verifier.generateToken(`agent-${level}`, level);
        const result = verifier.verify(token);
        expect(result.valid).toBe(true);
        expect(result.token!.level).toBe(level);
      }
    });

    it('should respect custom TTL', () => {
      const token = verifier.generateToken('agent-1', 'senior', 5000);
      expect(token.expiresAt - token.issuedAt).toBe(5000);
    });
  });

  describe('expired token rejection', () => {
    it('should reject expired tokens', () => {
      const token = verifier.generateToken('agent-1', 'senior', 1000);
      // Simulate time passing by modifying expiresAt
      token.expiresAt = Date.now() - 1000;
      const result = verifier.verify(token);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Token expired');
    });

    it('should accept tokens within TTL', () => {
      const token = verifier.generateToken('agent-1', 'senior', 60_000);
      const result = verifier.verify(token);
      expect(result.valid).toBe(true);
    });
  });

  describe('tampered token rejection', () => {
    it('should reject tokens with tampered agentId', () => {
      const token = verifier.generateToken('agent-1', 'senior');
      token.agentId = 'agent-2';
      const result = verifier.verify(token);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid signature');
    });

    it('should reject tokens with tampered level', () => {
      const token = verifier.generateToken('agent-1', 'junior');
      token.level = 'c-level';
      const result = verifier.verify(token);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid signature');
    });

    it('should reject tokens with tampered signature', () => {
      const token = verifier.generateToken('agent-1', 'senior');
      token.signature = Buffer.from('tampered-signature').toString('base64');
      const result = verifier.verify(token);
      expect(result.valid).toBe(false);
    });

    it('should reject tokens with tampered expiry', () => {
      const token = verifier.generateToken('agent-1', 'senior');
      token.expiresAt = Date.now() + 999_999_999;
      const result = verifier.verify(token);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid signature');
    });

    it('should reject tokens created with a different key pair', () => {
      const otherDir = mkdtempSync(join(tmpdir(), 'bos-auth-other-'));
      try {
        const otherVerifier = new AuthorityVerifier({ keyDir: otherDir });
        const token = otherVerifier.generateToken('agent-1', 'senior');
        const result = verifier.verify(token);
        expect(result.valid).toBe(false);
      } finally {
        rmSync(otherDir, { recursive: true, force: true });
      }
    });
  });
});
