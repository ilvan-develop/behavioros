import { createHash, createSign, generateKeyPairSync, randomUUID } from 'node:crypto';

/**
 * Certificate — Configuration and options interface.
 */
export interface Certificate {
  id: string;
  commonName: string;
  issuer: string;
  serialNumber: string;
  notBefore: string;
  notAfter: string;
  fingerprint: string;
  pem: string;
  status: 'valid' | 'expired' | 'revoked';
}

interface StoredCertificate extends Certificate {
  privateKey: string;
}

/**
 * CertificateManager — Provides generateSelfSigned, importCert, get, list, ... operations.
 */
export class CertificateManager {
  private certs = new Map<string, StoredCertificate>();

  generateSelfSigned(commonName: string, validityDays = 365): Certificate {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const serialNumber = randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
    const notBefore = new Date();
    const notAfter = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    const pem = [
      '-----BEGIN CERTIFICATE-----',
      Buffer.from(
        JSON.stringify({
          cn: commonName,
          serial: serialNumber,
          issuer: 'BehaviorOS Self-Signed CA',
          notBefore: notBefore.toISOString(),
          notAfter: notAfter.toISOString(),
          pubKey: publicKey,
        }),
      ).toString('base64'),
      '-----END CERTIFICATE-----',
    ].join('\n');

    const signer = createSign('SHA256');
    signer.update(pem);
    const signature = signer.sign(privateKey, 'base64');

    const fullPem = `${pem}\n${signature}`;

    const fingerprint = this.computeFingerprint(fullPem);

    const cert: StoredCertificate = {
      id: randomUUID(),
      commonName,
      issuer: 'BehaviorOS Self-Signed CA',
      serialNumber,
      notBefore: new Date().toISOString(),
      notAfter: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString(),
      fingerprint,
      pem: fullPem,
      status: 'valid',
      privateKey,
    };

    this.certs.set(cert.id, cert);
    return this.toPublic(cert);
  }

  importCert(pem: string): Certificate {
    const fingerprint = this.computeFingerprint(pem);
    const id = randomUUID();

    const cert: StoredCertificate = {
      id,
      commonName: 'imported',
      issuer: 'unknown',
      serialNumber: randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase(),
      notBefore: new Date().toISOString(),
      notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      fingerprint,
      pem,
      status: 'valid',
      privateKey: '',
    };

    this.certs.set(id, cert);
    return this.toPublic(cert);
  }

  get(id: string): Certificate | undefined {
    const cert = this.certs.get(id);
    return cert ? this.toPublic(cert) : undefined;
  }

  list(): Certificate[] {
    return Array.from(this.certs.values()).map((c) => this.toPublic(c));
  }

  revoke(id: string): void {
    const cert = this.certs.get(id);
    if (!cert) throw new Error(`Certificate ${id} not found`);
    cert.status = 'revoked';
  }

  validate(id: string): { valid: boolean; reason?: string; daysUntilExpiry: number } {
    const cert = this.certs.get(id);
    if (!cert) return { valid: false, reason: 'Certificate not found', daysUntilExpiry: 0 };

    if (cert.status === 'revoked') {
      return { valid: false, reason: 'Certificate has been revoked', daysUntilExpiry: 0 };
    }

    const now = Date.now();
    const expiry = new Date(cert.notAfter).getTime();
    const daysUntilExpiry = Math.max(0, Math.floor((expiry - now) / (1000 * 60 * 60 * 24)));

    if (now > expiry) {
      return { valid: false, reason: 'Certificate has expired', daysUntilExpiry: 0 };
    }

    return { valid: true, daysUntilExpiry };
  }

  renew(id: string, validityDays = 365): Certificate {
    const existing = this.certs.get(id);
    if (!existing) throw new Error(`Certificate ${id} not found`);

    return this.generateSelfSigned(existing.commonName, validityDays);
  }

  checkExpiring(daysThreshold = 30): Certificate[] {
    const now = Date.now();
    return this.list().filter((c) => {
      const expiry = new Date(c.notAfter).getTime();
      const daysLeft = (expiry - now) / (1000 * 60 * 60 * 24);
      return daysLeft > 0 && daysLeft <= daysThreshold;
    });
  }

  getTrustedCAs(): { name: string; fingerprint: string }[] {
    return [
      {
        name: 'BehaviorOS Root CA',
        fingerprint: 'BE:HA:VI:OR:OS:RO:OT:CA:00:00:00:00:00:00:00:01',
      },
      {
        name: 'BehaviorOS Intermediate CA',
        fingerprint: 'BE:HA:VI:OR:OS:IN:TE:RM:00:00:00:00:00:02',
      },
    ];
  }

  private computeFingerprint(pem: string): string {
    const hash = createHash('sha256').update(pem).digest('hex');
    return hash
      .toUpperCase()
      .replace(/(.{2})/g, '$1:')
      .slice(0, -1);
  }

  private toPublic(cert: StoredCertificate): Certificate {
    return {
      id: cert.id,
      commonName: cert.commonName,
      issuer: cert.issuer,
      serialNumber: cert.serialNumber,
      notBefore: cert.notBefore,
      notAfter: cert.notAfter,
      fingerprint: cert.fingerprint,
      pem: cert.pem,
      status: cert.status,
    };
  }
}
