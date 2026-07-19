import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ============================================================
// Authority Verifier — Cryptographic authority verification
// Replaces self-declared authority with signed tokens
// ============================================================

export type AuthorityLevel =
  | 'junior'
  | 'senior'
  | 'architect'
  | 'lead'
  | 'director'
  | 'vp'
  | 'c-level';

export interface AuthorityToken {
  agentId: string;
  level: AuthorityLevel;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  token?: AuthorityToken;
}

export interface AuthorityVerifierConfig {
  keyDir: string;
  defaultTtlMs?: number;
}

export class AuthorityVerifier {
  private privateKey: string;
  private publicKey: string;
  private defaultTtlMs: number;

  constructor(config: AuthorityVerifierConfig) {
    this.defaultTtlMs = config.defaultTtlMs ?? 3600000; // 1 hour default

    const privateKeyPath = join(config.keyDir, 'authority-key.pem');
    const publicKeyPath = join(config.keyDir, 'authority-key.pub.pem');

    if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
      this.privateKey = readFileSync(privateKeyPath, 'utf-8');
      this.publicKey = readFileSync(publicKeyPath, 'utf-8');
    } else {
      const keyPair = generateKeyPairSync('ed25519');
      this.privateKey = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      this.publicKey = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

      // Ensure directory exists
      const dir = config.keyDir;
      if (!existsSync(dir)) {
        writeFileSync(join(dir, '.gitkeep'), '');
      }

      writeFileSync(privateKeyPath, this.privateKey);
      writeFileSync(publicKeyPath, this.publicKey);
    }
  }

  /**
   * Generate a signed authority token for an agent
   */
  generateToken(agentId: string, level: AuthorityLevel, ttlMs?: number): AuthorityToken {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + (ttlMs ?? this.defaultTtlMs);
    const payload = JSON.stringify({ agentId, level, issuedAt, expiresAt });
    const signature = sign(null, Buffer.from(payload), this.privateKey).toString('base64');

    return { agentId, level, issuedAt, expiresAt, signature };
  }

  /**
   * Verify an authority token's signature and expiry
   */
  verify(token: AuthorityToken): VerificationResult {
    // Check expiry
    if (Date.now() > token.expiresAt) {
      return { valid: false, reason: 'Token expired' };
    }

    // Reconstruct payload for verification
    const payload = JSON.stringify({
      agentId: token.agentId,
      level: token.level,
      issuedAt: token.issuedAt,
      expiresAt: token.expiresAt,
    });

    try {
      const valid = verify(
        null,
        Buffer.from(payload),
        this.publicKey,
        Buffer.from(token.signature, 'base64'),
      );

      return valid ? { valid: true, token } : { valid: false, reason: 'Invalid signature' };
    } catch {
      return { valid: false, reason: 'Verification failed' };
    }
  }

  /**
   * Get the public key for distribution (e.g., to MCP server)
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}
