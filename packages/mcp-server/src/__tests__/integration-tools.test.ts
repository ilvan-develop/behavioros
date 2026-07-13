import { BehaviorOSEngine } from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkFraud,
  deployCanary,
  getDeployments,
  getMetrics,
  getObservabilityMetrics,
  getOrders,
  getTrustScore,
  getValidations,
  reconcilePayments,
  rollbackDeployment,
  runCompliance,
  setIntegrationEngine,
  syncBrocolisOrders,
  validatePayment,
} from '../tools/integration-tools.js';

const testDNA: DNAPackage = {
  id: 'test-dna',
  name: 'Test DNA',
  version: '1.0.0',
  personas: [{ role: 'engineer', authority: 'senior', name: 'Test Engineer' }],
  governance: [
    {
      id: 'test-rule',
      name: 'Test Rule',
      level: 'medium',
      action: 'warn',
      conditions: ['type:feature'],
    },
  ],
  quality: [{ id: 'test-coverage', name: 'Test Coverage', type: 'test_coverage', threshold: 80 }],
  patterns: [
    {
      id: 'test-pattern',
      name: 'Test Pattern',
      type: 'collaboration',
      triggers: ['agent:engineer'],
      actions: ['code-review'],
    },
  ],
};

function createTestEngine(): BehaviorOSEngine {
  return new BehaviorOSEngine({
    dna: testDNA,
    governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
    quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
    learning: { enabled: true },
    audit: { enabled: true },
  });
}

describe('Integration Tools', () => {
  let engine: BehaviorOSEngine;

  beforeEach(() => {
    engine = createTestEngine();
    setIntegrationEngine(engine);
    getOrders().clear();
    getValidations().length = 0;
    getDeployments().clear();
    const metrics = getMetrics();
    metrics.brocolis = { ordersProcessed: 0, averageLatencyMs: 0, errorRate: 0, uptime: 100 };
    metrics.finpay = {
      paymentsProcessed: 0,
      averageProcessingMs: 0,
      failureRate: 0,
      reconciliationRate: 100,
    };
    metrics.behavioros = {
      activeMissions: 0,
      governanceViolations: 0,
      qualityScore: 100,
      auditPassRate: 100,
    };
  });

  describe('sync_brocolis_orders', () => {
    it('should sync orders from Brocolis', async () => {
      const result = await syncBrocolisOrders({
        orderIds: ['ord-001', 'ord-002', 'ord-003'],
        dryRun: false,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.synced).toBe(3);
      expect(parsed.dryRun).toBe(0);
      expect(parsed.results).toHaveLength(3);
      expect(parsed.results[0].status).toBe('synced');
    });

    it('should support dry run mode', async () => {
      const result = await syncBrocolisOrders({
        orderIds: ['ord-001'],
        dryRun: true,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.synced).toBe(0);
      expect(parsed.dryRun).toBe(1);
      expect(getOrders().size).toBe(0);
    });
  });

  describe('validate_payment', () => {
    it('should validate a payment successfully', async () => {
      const result = await validatePayment({
        paymentId: 'pay-001',
        amount: 150.0,
        currency: 'BRL',
        source: 'brocolis',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.validationId).toBeDefined();
      expect(parsed.paymentId).toBe('pay-001');
      expect(typeof parsed.valid).toBe('boolean');
      expect(parsed.trustScore).toBeGreaterThanOrEqual(0);
      expect(parsed.trustScore).toBeLessThanOrEqual(1);
    });

    it('should detect high value payments', async () => {
      const result = await validatePayment({
        paymentId: 'pay-002',
        amount: 60000,
        currency: 'BRL',
        source: 'brocolis',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.fraudSignals).toContain('high_value_transaction');
    });
  });

  describe('get_trust_score', () => {
    it('should return trust score for validated payment', async () => {
      await validatePayment({
        paymentId: 'pay-trust-001',
        amount: 100,
        currency: 'BRL',
        source: 'brocolis',
      });

      const result = await getTrustScore({ paymentId: 'pay-trust-001' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.paymentId).toBe('pay-trust-001');
      expect(typeof parsed.trustScore).toBe('number');
      expect(parsed.factors).toBeDefined();
      expect(parsed.recommendation).toBeDefined();
    });

    it('should handle unvalidated payment', async () => {
      const result = await getTrustScore({ paymentId: 'non-existent' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.trustScore).toBeNull();
      expect(parsed.message).toContain('No validation found');
    });
  });

  describe('check_fraud', () => {
    it('should return low risk for normal payment', async () => {
      const result = await checkFraud({
        paymentId: 'pay-fraud-001',
        amount: 50,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.riskLevel).toBe('low');
      expect(parsed.signals).toHaveLength(0);
      expect(parsed.recommendation).toContain('PASS');
    });

    it('should detect high value fraud signals', async () => {
      const result = await checkFraud({
        paymentId: 'pay-fraud-002',
        amount: 150000,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.riskLevel).toBe('critical');
      expect(parsed.signals.length).toBeGreaterThan(0);
      expect(parsed.recommendation).toContain('BLOCK');
    });

    it('should check metadata for fraud patterns', async () => {
      const result = await checkFraud({
        paymentId: 'pay-fraud-003',
        amount: 5000,
        metadata: { repeated_failures: 5, country_mismatch: true },
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.signalCount).toBeGreaterThanOrEqual(2);
      const signalNames = parsed.signals.map((s: { signal: string }) => s.signal);
      expect(signalNames).toContain('repeated_failures');
      expect(signalNames).toContain('geo_mismatch');
    });
  });

  describe('run_compliance', () => {
    it('should run full compliance check', async () => {
      const result = await runCompliance({ scope: 'full' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.scope).toBe('full');
      expect(parsed.summary.total).toBeGreaterThan(0);
      expect(typeof parsed.overallPassed).toBe('boolean');
      expect(parsed.checks).toBeDefined();
    });

    it('should run payment-only compliance', async () => {
      const result = await runCompliance({ scope: 'payment' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.scope).toBe('payment');
      expect(parsed.summary.total).toBeGreaterThan(0);
    });

    it('should run specific rules', async () => {
      const result = await runCompliance({
        scope: 'data',
        rules: ['LGPD_consent'],
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.checks).toHaveLength(1);
      expect(parsed.checks[0].rule).toBe('data:LGPD_consent');
    });
  });

  describe('reconcile_payments', () => {
    it('should reconcile payments in period', async () => {
      await syncBrocolisOrders({ orderIds: ['ord-001', 'ord-002'], dryRun: false });

      const now = new Date().toISOString();
      const result = await reconcilePayments({
        startDate: new Date(Date.now() - 60000).toISOString(),
        endDate: new Date(Date.now() + 60000).toISOString(),
        dryRun: false,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.summary.totalOrders).toBe(2);
      expect(parsed.summary.totalAmount).toBeGreaterThan(0);
      expect(parsed.period.start).toBeDefined();
    });

    it('should support dry run', async () => {
      await syncBrocolisOrders({ orderIds: ['ord-001'], dryRun: false });

      const result = await reconcilePayments({
        startDate: new Date(Date.now() - 60000).toISOString(),
        endDate: new Date(Date.now() + 60000).toISOString(),
        dryRun: true,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.dryRun).toBe(true);
    });
  });

  describe('get_observability_metrics', () => {
    it('should return all platform metrics', async () => {
      const result = await getObservabilityMetrics();
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.timestamp).toBeDefined();
      expect(parsed.brocolis).toBeDefined();
      expect(parsed.finpay).toBeDefined();
      expect(parsed.behavioros).toBeDefined();
    });

    it('should filter by platform', async () => {
      const result = await getObservabilityMetrics({ platforms: ['brocolis'] });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.brocolis).toBeDefined();
      expect(parsed.finpay).toBeUndefined();
      expect(parsed.behavioros).toBeUndefined();
    });
  });

  describe('deploy_canary', () => {
    it('should deploy canary with quality gates', async () => {
      const result = await deployCanary({
        version: '1.2.3',
        environment: 'production',
        canaryTraffic: 5,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.deploymentId).toBeDefined();
      expect(parsed.version).toBe('1.2.3');
      expect(parsed.environment).toBe('production');
      expect(parsed.status).toBe('canary');
      expect(parsed.qualityGatesPassed).toBe(true);
      expect(parsed.canaryTraffic).toBe(5);
      expect(parsed.qualityChecks).toBeDefined();
      expect(parsed.qualityChecks.length).toBeGreaterThan(0);
    });

    it('should deploy to staging', async () => {
      const result = await deployCanary({
        version: '2.0.0',
        environment: 'staging',
        canaryTraffic: 10,
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.environment).toBe('staging');
      expect(parsed.deployedAt).toBeDefined();
    });
  });

  describe('rollback_deployment', () => {
    it('should rollback a deployment', async () => {
      const deployResult = await deployCanary({
        version: '1.0.0',
        environment: 'production',
        canaryTraffic: 5,
      });
      const deployment = JSON.parse(deployResult.content[0].text);

      const result = await rollbackDeployment({
        deploymentId: deployment.deploymentId,
        reason: 'Quality gate failure detected',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.deploymentId).toBe(deployment.deploymentId);
      expect(parsed.previousStatus).toBe('canary');
      expect(parsed.newStatus).toBe('rolled_back');
      expect(parsed.reason).toBe('Quality gate failure detected');
      expect(parsed.rolledBackAt).toBeDefined();
    });

    it('should throw for non-existent deployment', async () => {
      await expect(
        rollbackDeployment({
          deploymentId: 'non-existent',
          reason: 'test',
        }),
      ).rejects.toThrow('Deployment not found');
    });

    it('should throw for already rolled back deployment', async () => {
      const deployResult = await deployCanary({
        version: '1.0.0',
        environment: 'production',
        canaryTraffic: 5,
      });
      const deployment = JSON.parse(deployResult.content[0].text);

      await rollbackDeployment({
        deploymentId: deployment.deploymentId,
        reason: 'First rollback',
      });

      await expect(
        rollbackDeployment({
          deploymentId: deployment.deploymentId,
          reason: 'Second rollback',
        }),
      ).rejects.toThrow('already rolled back');
    });
  });
});
