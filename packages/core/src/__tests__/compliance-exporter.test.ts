import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type AuditChainEntry,
  ComplianceExporter,
  type ComplianceExportReport,
} from '../compliance/compliance-exporter';

// ============================================================
// ComplianceExporter Tests
// ============================================================

describe('ComplianceExporter', () => {
  const TEST_DIR = join(tmpdir(), `bos-compliance-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const exporter = new ComplianceExporter();
      const config = exporter.getConfig();
      expect(config.frameworks).toEqual(['eu-ai-act', 'pci-dss', 'soc2']);
      expect(config.projectName).toBe('unknown');
    });

    it('should initialize with custom config', () => {
      const exporter = new ComplianceExporter({
        projectName: 'test-project',
        frameworks: ['soc2'],
      });
      const config = exporter.getConfig();
      expect(config.projectName).toBe('test-project');
      expect(config.frameworks).toEqual(['soc2']);
    });
  });

  // --- Generate ---

  describe('generate', () => {
    it('should generate a report with all frameworks', () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });

      const report = exporter.generate({
        euRiskInput: {
          purpose: 'AI customer service chatbot',
          usesBiometrics: false,
          accessesCriticalInfrastructure: false,
          determinesAccessToEssentialServices: false,
          usedInLawEnforcement: false,
          usedInMigration: false,
          usedInEducation: false,
          usedInEmployment: false,
          remoteBiometricPublicSpaces: false,
          profilesNaturalPersons: false,
        },
        pciInput: {
          handlesCardholderData: true,
          processesPayments: true,
          internetFacing: false,
          annualTransactions: 1000,
          encryptsInTransit: true,
          encryptsAtRest: true,
          hasAccessControl: true,
          hasMonitoring: true,
          hasVulnerabilityScanning: true,
          hasSecurityPolicies: true,
          hasFirewall: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasNetworkSegmentation: true,
        },
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
        auditTrailEntries: 100,
        hasGovernance: true,
        hasQualityGates: true,
        hasLearningSystem: true,
        testCoverage: 85,
        totalAgents: 5,
      });

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.projectName).toBe('test');
      expect(report.frameworks).toEqual(['eu-ai-act', 'pci-dss', 'soc2']);
      expect(report.euAiAct).toBeDefined();
      expect(report.pciDss).toBeDefined();
      expect(report.soc2).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.auditChain).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should generate SOC2-only report', () => {
      const exporter = new ComplianceExporter({
        projectName: 'soc2-only',
        frameworks: ['soc2'],
      });

      const report = exporter.generate({
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
        testCoverage: 90,
      });

      expect(report.frameworks).toEqual(['soc2']);
      expect(report.soc2).toBeDefined();
      expect(report.euAiAct).toBeUndefined();
      expect(report.pciDss).toBeUndefined();
    });

    it('should generate PCI-DSS-only report', () => {
      const exporter = new ComplianceExporter({
        projectName: 'pci-only',
        frameworks: ['pci-dss'],
      });

      const report = exporter.generate({
        pciInput: {
          handlesCardholderData: true,
          processesPayments: true,
          internetFacing: false,
          annualTransactions: 1000,
          encryptsInTransit: true,
          encryptsAtRest: true,
          hasAccessControl: true,
          hasMonitoring: true,
          hasVulnerabilityScanning: true,
          hasSecurityPolicies: true,
          hasFirewall: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasNetworkSegmentation: true,
        },
      });

      expect(report.frameworks).toEqual(['pci-dss']);
      expect(report.pciDss).toBeDefined();
      expect(report.euAiAct).toBeUndefined();
      expect(report.soc2).toBeUndefined();
    });

    it('should generate EU AI Act-only report', () => {
      const exporter = new ComplianceExporter({
        projectName: 'eu-only',
        frameworks: ['eu-ai-act'],
      });

      const report = exporter.generate({
        euRiskInput: {
          purpose: 'AI customer service chatbot',
          usesBiometrics: false,
          accessesCriticalInfrastructure: false,
          determinesAccessToEssentialServices: false,
          usedInLawEnforcement: false,
          usedInMigration: false,
          usedInEducation: false,
          usedInEmployment: false,
          remoteBiometricPublicSpaces: false,
          profilesNaturalPersons: false,
        },
      });

      expect(report.frameworks).toEqual(['eu-ai-act']);
      expect(report.euAiAct).toBeDefined();
      expect(report.pciDss).toBeUndefined();
      expect(report.soc2).toBeUndefined();
    });

    it('should include dnaVersion if provided', () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });

      const report = exporter.generate({
        dnaVersion: '1.0.0',
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
      });

      expect(report.dnaVersion).toBe('1.0.0');
    });

    it('should compute summary statistics', () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });

      const report = exporter.generate({
        euRiskInput: {
          purpose: 'AI customer service chatbot',
          usesBiometrics: false,
          accessesCriticalInfrastructure: false,
          determinesAccessToEssentialServices: false,
          usedInLawEnforcement: false,
          usedInMigration: false,
          usedInEducation: false,
          usedInEmployment: false,
          remoteBiometricPublicSpaces: false,
          profilesNaturalPersons: false,
        },
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
      });

      expect(report.summary.totalChecks).toBeGreaterThan(0);
      expect(report.summary.totalPassed).toBeGreaterThan(0);
      expect(report.summary.overallScore).toBeGreaterThan(0);
      expect(report.summary.overallScore).toBeLessThanOrEqual(100);
    });
  });

  // --- Export Formats ---

  describe('export', () => {
    let exporter: ComplianceExporter;
    let report: ComplianceExportReport;

    beforeEach(() => {
      exporter = new ComplianceExporter({ projectName: 'test' });
      report = exporter.generate({
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
        testCoverage: 85,
      });
    });

    it('should export to JSON', () => {
      const json = exporter.export(report, 'json');
      expect(json).toBeDefined();
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(report.id);
      expect(parsed.projectName).toBe('test');
    });

    it('should export to Markdown', () => {
      const md = exporter.export(report, 'markdown');
      expect(md).toBeDefined();
      expect(md).toContain('# Compliance Report — test');
      expect(md).toContain('## Executive Summary');
      expect(md).toContain('## SOC 2 Assessment');
      expect(md).toContain('## Audit Chain Verification');
    });

    it('should export to CSV', () => {
      const csv = exporter.export(report, 'csv');
      expect(csv).toBeDefined();
      expect(csv).toContain('Framework,Control ID,Control Name,Result,Score,Category,Remediation');
      expect(csv).toContain('soc2');
    });
  });

  // --- Save & Load ---

  describe('save and load', () => {
    it('should save and load JSON report', async () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });
      const report = exporter.generate({
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
      });

      const path = join(TEST_DIR, 'report.json');
      await exporter.save(report, path);
      expect(existsSync(path)).toBe(true);

      const loaded = await exporter.load(path);
      expect(loaded.id).toBe(report.id);
      expect(loaded.projectName).toBe(report.projectName);
    });

    it('should save Markdown report', async () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });
      const report = exporter.generate({
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
      });

      const path = join(TEST_DIR, 'report.md');
      await exporter.save(report, path, 'markdown');
      expect(existsSync(path)).toBe(true);

      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('# Compliance Report');
    });

    it('should save CSV report', async () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });
      const report = exporter.generate({
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
      });

      const path = join(TEST_DIR, 'report.csv');
      await exporter.save(report, path, 'csv');
      expect(existsSync(path)).toBe(true);

      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('Framework,Control ID');
    });

    it('should auto-detect format from extension', async () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });
      const report = exporter.generate({
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
      });

      const jsonPath = join(TEST_DIR, 'auto.json');
      await exporter.save(report, jsonPath);
      const content = readFileSync(jsonPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should throw on missing file', async () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });
      await expect(exporter.load(join(TEST_DIR, 'missing.json'))).rejects.toThrow(
        'Report file not found',
      );
    });
  });

  // --- Audit Chain ---

  describe('audit chain', () => {
    it('should verify intact audit chain', () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });

      const chain: AuditChainEntry[] = [
        { step: 'lint', hash: 'abc123', timestamp: new Date().toISOString(), passed: true },
        { step: 'typecheck', hash: 'def456', timestamp: new Date().toISOString(), passed: true },
        { step: 'security', hash: 'ghi789', timestamp: new Date().toISOString(), passed: true },
      ];

      const report = exporter.generate({
        auditChain: chain,
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
      });

      expect(report.auditChain.totalEntries).toBe(3);
      expect(report.auditChain.verifiedEntries).toBe(3);
      expect(report.auditChain.chainHash).toBeDefined();
    });

    it('should detect broken audit chain', () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });

      const chain: AuditChainEntry[] = [
        { step: 'lint', hash: 'abc123', timestamp: new Date().toISOString(), passed: true },
        { step: 'typecheck', hash: 'def456', timestamp: new Date().toISOString(), passed: false },
        { step: 'security', hash: 'ghi789', timestamp: new Date().toISOString(), passed: true },
      ];

      const report = exporter.generate({
        auditChain: chain,
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
      });

      expect(report.auditChain.brokenLinks).toBeGreaterThan(0);
    });

    it('should handle empty audit chain', () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });

      const report = exporter.generate({
        auditChain: [],
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
      });

      expect(report.auditChain.totalEntries).toBe(0);
      expect(report.auditChain.chainIntact).toBe(false);
    });
  });

  // --- Markdown Output Quality ---

  describe('markdown output', () => {
    it('should include all major sections', () => {
      const exporter = new ComplianceExporter({ projectName: 'test' });
      const report = exporter.generate({
        euRiskInput: {
          purpose: 'AI customer service chatbot',
          usesBiometrics: false,
          accessesCriticalInfrastructure: false,
          determinesAccessToEssentialServices: false,
          usedInLawEnforcement: false,
          usedInMigration: false,
          usedInEducation: false,
          usedInEmployment: false,
          remoteBiometricPublicSpaces: false,
          profilesNaturalPersons: false,
        },
        pciInput: {
          handlesCardholderData: true,
          processesPayments: true,
          internetFacing: false,
          annualTransactions: 1000,
          encryptsInTransit: true,
          encryptsAtRest: true,
          hasAccessControl: true,
          hasMonitoring: true,
          hasVulnerabilityScanning: true,
          hasSecurityPolicies: true,
          hasFirewall: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasNetworkSegmentation: true,
        },
        soc2Input: {
          hasAccessControls: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasMonitoring: true,
          hasChangeManagement: true,
          hasDataEncryption: true,
          hasBackupRecovery: true,
          hasIncidentResponse: true,
          hasRiskAssessment: true,
          hasVendorManagement: true,
          hasDataClassification: true,
          hasPrivacyPolicies: true,
          hasPenetrationTesting: true,
          hasAuditTrail: true,
        },
      });

      const md = exporter.export(report, 'markdown');
      expect(md).toContain('# Compliance Report');
      expect(md).toContain('## Executive Summary');
      expect(md).toContain('### Framework Scores');
      expect(md).toContain('## EU AI Act Assessment');
      expect(md).toContain('## PCI-DSS Assessment');
      expect(md).toContain('## SOC 2 Assessment');
      expect(md).toContain('## Audit Chain Verification');
      expect(md).toContain('## Recommendations');
    });
  });
});
