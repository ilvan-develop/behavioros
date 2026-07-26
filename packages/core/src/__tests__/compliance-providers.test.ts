import { describe, expect, it } from 'vitest';
import { ComplianceRegistry } from '../engines/governance/compliance/compliance-registry';
import { GDPRProvider } from '../engines/governance/compliance/gdpr';
import { HIPAAProvider } from '../engines/governance/compliance/hipaa';
import { ISO27001Provider } from '../engines/governance/compliance/iso27001';
import { LGPDProvider } from '../engines/governance/compliance/lgpd';
import { PCIProvider } from '../engines/governance/compliance/pci';
import { SOC2Provider } from '../engines/governance/compliance/soc2';

describe('Compliance Providers', () => {
  describe('SOC2Provider', () => {
    it('should return correct name', () => {
      expect(new SOC2Provider().name).toBe('SOC 2');
    });

    it('should return valid check report', async () => {
      const report = await new SOC2Provider().check('test-system');
      expect(report.provider).toBe('SOC 2');
      expect(report.target).toBe('test-system');
      expect(report.checks.length).toBeGreaterThanOrEqual(5);
      expect(report.checks.length).toBeLessThanOrEqual(8);
      expect(report.overallScore).toBeGreaterThan(0);
      expect(report.overallScore).toBeLessThanOrEqual(1);
      expect(typeof report.passed).toBe('boolean');
      expect(report.generatedAt).toBeDefined();
    });

    it('should return requirements list', () => {
      const reqs = new SOC2Provider().getRequirements();
      expect(Array.isArray(reqs)).toBe(true);
      expect(reqs.length).toBeGreaterThan(0);
    });
  });

  describe('ISO27001Provider', () => {
    it('should return correct name', () => {
      expect(new ISO27001Provider().name).toBe('ISO 27001');
    });

    it('should return valid check report with 8 checks', async () => {
      const report = await new ISO27001Provider().check('infra');
      expect(report.checks.length).toBe(8);
      expect(report.overallScore).toBeGreaterThan(0);
      expect(report.passed).toBe(true);
    });

    it('should return requirements list', () => {
      const reqs = new ISO27001Provider().getRequirements();
      expect(reqs.some((r) => r.includes('A.5'))).toBe(true);
    });
  });

  describe('GDPRProvider', () => {
    it('should return correct name', () => {
      expect(new GDPRProvider().name).toBe('GDPR');
    });

    it('should return valid check report', async () => {
      const report = await new GDPRProvider().check('user-db');
      expect(report.provider).toBe('GDPR');
      expect(report.target).toBe('user-db');
      expect(report.checks.length).toBeGreaterThanOrEqual(5);
      expect(report.overallScore).toBeGreaterThan(0);
    });

    it('should include Art. references in requirements', () => {
      const reqs = new GDPRProvider().getRequirements();
      expect(reqs.some((r) => r.includes('Art.'))).toBe(true);
    });
  });

  describe('LGPDProvider', () => {
    it('should return correct name', () => {
      expect(new LGPDProvider().name).toBe('LGPD');
    });

    it('should return valid check report', async () => {
      const report = await new LGPDProvider().check('br-system');
      expect(report.provider).toBe('LGPD');
      expect(report.target).toBe('br-system');
      expect(report.checks.length).toBeGreaterThanOrEqual(5);
      expect(report.overallScore).toBeGreaterThan(0);
    });

    it('should return requirements list', () => {
      const reqs = new LGPDProvider().getRequirements();
      expect(reqs.length).toBeGreaterThan(0);
    });
  });

  describe('HIPAAProvider', () => {
    it('should return correct name', () => {
      expect(new HIPAAProvider().name).toBe('HIPAA');
    });

    it('should return valid check report', async () => {
      const report = await new HIPAAProvider().check('phi-system');
      expect(report.provider).toBe('HIPAA');
      expect(report.checks.every((c) => c.evidence.includes('phi-system'))).toBe(true);
      expect(report.overallScore).toBeGreaterThan(0);
    });

    it('should include PHI-related requirements', () => {
      const reqs = new HIPAAProvider().getRequirements();
      expect(reqs.some((r) => r.includes('PHI'))).toBe(true);
    });
  });

  describe('PCIProvider', () => {
    it('should return correct name', () => {
      expect(new PCIProvider().name).toBe('PCI DSS');
    });

    it('should return valid check report with 8 checks', async () => {
      const report = await new PCIProvider().check('payment-system');
      expect(report.checks.length).toBe(8);
      expect(report.overallScore).toBeGreaterThan(0);
    });

    it('should return requirements list with Req references', () => {
      const reqs = new PCIProvider().getRequirements();
      expect(reqs.some((r) => r.includes('Req'))).toBe(true);
    });
  });

  describe('ComplianceRegistry', () => {
    it('should register and retrieve a provider', () => {
      const registry = new ComplianceRegistry();
      registry.register(new SOC2Provider());
      const retrieved = registry.get('SOC 2');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('SOC 2');
    });

    it('should return undefined for unknown provider', () => {
      const registry = new ComplianceRegistry();
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should list all registered providers', () => {
      const registry = new ComplianceRegistry();
      registry.register(new SOC2Provider());
      registry.register(new PCIProvider());
      expect(registry.list()).toHaveLength(2);
    });

    it('should run all providers via runAll', async () => {
      const registry = new ComplianceRegistry();
      registry.register(new SOC2Provider());
      registry.register(new GDPRProvider());
      const reports = await registry.runAll('test');
      expect(reports).toHaveLength(2);
      expect(reports.map((r) => r.provider)).toEqual(['SOC 2', 'GDPR']);
    });

    it('should run specific providers via runSpecific', async () => {
      const registry = new ComplianceRegistry();
      registry.register(new SOC2Provider());
      registry.register(new ISO27001Provider());
      registry.register(new PCIProvider());
      const reports = await registry.runSpecific(['SOC 2', 'PCI DSS'], 'target');
      expect(reports).toHaveLength(2);
      expect(reports.map((r) => r.provider)).toEqual(['SOC 2', 'PCI DSS']);
    });

    it('should skip unknown providers in runSpecific', async () => {
      const registry = new ComplianceRegistry();
      registry.register(new SOC2Provider());
      const reports = await registry.runSpecific(['SOC 2', 'Unknown'], 'x');
      expect(reports).toHaveLength(1);
    });
  });
});
