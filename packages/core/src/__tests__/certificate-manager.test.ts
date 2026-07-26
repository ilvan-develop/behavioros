import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CertificateManager } from '../engines/security/certificate-manager';

describe('CertificateManager', () => {
  let mgr: CertificateManager;

  beforeEach(() => {
    mgr = new CertificateManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generateSelfSigned creates a valid certificate', () => {
    const cert = mgr.generateSelfSigned('test.example.com');
    expect(cert.id).toBeDefined();
    expect(cert.commonName).toBe('test.example.com');
    expect(cert.issuer).toBe('BehaviorOS Self-Signed CA');
    expect(cert.status).toBe('valid');
    expect(cert.fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(cert.pem).toContain('-----BEGIN CERTIFICATE-----');
    expect(cert.pem).toContain('-----END CERTIFICATE-----');
  });

  it('generateSelfSigned accepts custom validity period', () => {
    const cert = mgr.generateSelfSigned('short.example.com', 1);
    const result = mgr.validate(cert.id);
    expect(result.valid).toBe(true);
    expect(result.daysUntilExpiry).toBe(1);
  });

  it('importCert creates a certificate from PEM', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nMOCKPEMDATA\n-----END CERTIFICATE-----';
    const cert = mgr.importCert(pem);
    expect(cert.id).toBeDefined();
    expect(cert.pem).toBe(pem);
    expect(cert.status).toBe('valid');
  });

  it('get returns undefined for unknown id', () => {
    expect(mgr.get('nonexistent')).toBeUndefined();
  });

  it('list returns all certificates', () => {
    const c1 = mgr.generateSelfSigned('a.example.com');
    const c2 = mgr.generateSelfSigned('b.example.com');
    const all = mgr.list();
    expect(all).toHaveLength(2);
    expect(all.map((c) => c.id)).toContain(c1.id);
    expect(all.map((c) => c.id)).toContain(c2.id);
  });

  it('revoke changes status to revoked', () => {
    const cert = mgr.generateSelfSigned('revoke-test.example.com');
    expect(cert.status).toBe('valid');
    mgr.revoke(cert.id);
    const updated = mgr.get(cert.id);
    expect(updated?.status).toBe('revoked');
  });

  it('revoke throws for unknown id', () => {
    expect(() => mgr.revoke('nonexistent')).toThrow('not found');
  });

  it('validate returns daysUntilExpiry for valid cert', () => {
    const cert = mgr.generateSelfSigned('validate-test.example.com', 90);
    const result = mgr.validate(cert.id);
    expect(result.valid).toBe(true);
    expect(result.daysUntilExpiry).toBe(90);
  });

  it('validate returns expired for past-dated cert', () => {
    const cert = mgr.generateSelfSigned('expired-test.example.com', -1);
    const result = mgr.validate(cert.id);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Certificate has expired');
  });

  it('validate returns revoked for revoked cert', () => {
    const cert = mgr.generateSelfSigned('revoke-validate.example.com');
    mgr.revoke(cert.id);
    const result = mgr.validate(cert.id);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Certificate has been revoked');
  });

  it('validate returns not found for unknown id', () => {
    const result = mgr.validate('unknown-id');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Certificate not found');
  });

  it('checkExpiring returns certs expiring within threshold', () => {
    const near = mgr.generateSelfSigned('near.example.com', 5);
    const far = mgr.generateSelfSigned('far.example.com', 365);
    const expiring = mgr.checkExpiring(30);
    expect(expiring.map((c) => c.id)).toContain(near.id);
    expect(expiring.map((c) => c.id)).not.toContain(far.id);
  });

  it('renew generates a new cert with same commonName', () => {
    const original = mgr.generateSelfSigned('renew-test.example.com', 30);
    const renewed = mgr.renew(original.id, 365);
    expect(renewed.id).not.toBe(original.id);
    expect(renewed.commonName).toBe(original.commonName);
    expect(renewed.status).toBe('valid');
  });

  it('renew throws for unknown id', () => {
    expect(() => mgr.renew('nonexistent')).toThrow('not found');
  });

  it('getTrustedCAs returns default CAs', () => {
    const cas = mgr.getTrustedCAs();
    expect(cas).toHaveLength(2);
    expect(cas[0].name).toContain('BehaviorOS Root CA');
    expect(cas[1].name).toContain('BehaviorOS Intermediate CA');
  });

  it('checkExpiring returns empty when no certs are expiring', () => {
    mgr.generateSelfSigned('far.example.com', 365);
    expect(mgr.checkExpiring(30)).toHaveLength(0);
  });

  it('fingerprint is SHA-256 hex format with colons', () => {
    const cert = mgr.generateSelfSigned('fingerprint-test.example.com');
    expect(cert.fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });
});
