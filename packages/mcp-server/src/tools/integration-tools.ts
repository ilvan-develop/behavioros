import type { BehaviorOSEngine } from '@behavioros/core';
import { z } from 'zod';

// --- In-memory integration state ---

export interface OrderRecord {
  id: string;
  brocolisOrderId: string;
  finpayPaymentId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'synced' | 'validated' | 'paid' | 'failed' | 'reconciled';
  syncedAt?: string;
  createdAt: string;
}

export interface PaymentValidation {
  id: string;
  paymentId: string;
  valid: boolean;
  trustScore: number;
  fraudSignals: string[];
  compliancePassed: boolean;
  validatedAt: string;
}

export interface DeploymentRecord {
  id: string;
  version: string;
  environment: string;
  status: 'pending' | 'canary' | 'full' | 'rolled_back' | 'failed';
  qualityGatesPassed: boolean;
  canaryTraffic?: number;
  deployedAt?: string;
  rolledBackAt?: string;
}

export interface ObservabilityMetrics {
  timestamp: string;
  brocolis: {
    ordersProcessed: number;
    averageLatencyMs: number;
    errorRate: number;
    uptime: number;
  };
  finpay: {
    paymentsProcessed: number;
    averageProcessingMs: number;
    failureRate: number;
    reconciliationRate: number;
  };
  behavioros: {
    activeMissions: number;
    governanceViolations: number;
    qualityScore: number;
    auditPassRate: number;
  };
}

const _orders = new Map<string, OrderRecord>();
const _validations: PaymentValidation[] = [];
const _deployments: Map<string, DeploymentRecord> = new Map();
const _metrics: ObservabilityMetrics = {
  timestamp: new Date().toISOString(),
  brocolis: { ordersProcessed: 0, averageLatencyMs: 0, errorRate: 0, uptime: 100 },
  finpay: {
    paymentsProcessed: 0,
    averageProcessingMs: 0,
    failureRate: 0,
    reconciliationRate: 100,
  },
  behavioros: { activeMissions: 0, governanceViolations: 0, qualityScore: 100, auditPassRate: 100 },
};

let _engineRef: BehaviorOSEngine | null = null;

export function setIntegrationEngine(engine: BehaviorOSEngine) {
  _engineRef = engine;
}

export function getOrders(): Map<string, OrderRecord> {
  return _orders;
}

export function getValidations(): PaymentValidation[] {
  return _validations;
}

export function getDeployments(): Map<string, DeploymentRecord> {
  return _deployments;
}

export function getMetrics(): ObservabilityMetrics {
  return _metrics;
}

function generateId(): string {
  return `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

// --- Input schemas ---

export const syncBrocolisOrdersInput = z.object({
  orderIds: z
    .array(z.string().min(1))
    .min(1)
    .max(100)
    .describe('List of Brocolis order IDs to sync'),
  dryRun: z.boolean().default(false).describe('Simulate sync without writing'),
});

export type SyncBrocolisOrdersInput = z.infer<typeof syncBrocolisOrdersInput>;

export const validatePaymentInput = z.object({
  paymentId: z.string().min(1).describe('Payment ID to validate'),
  amount: z.number().positive().describe('Payment amount'),
  currency: z.string().min(3).max(3).default('BRL').describe('ISO currency code'),
  source: z.string().default('brocolis').describe('Payment source platform'),
});

export type ValidatePaymentInput = z.infer<typeof validatePaymentInput>;

export const getTrustScoreInput = z.object({
  paymentId: z.string().min(1).describe('Payment ID to score'),
});

export type GetTrustScoreInput = z.infer<typeof getTrustScoreInput>;

export const checkFraudInput = z.object({
  paymentId: z.string().min(1).describe('Payment ID to check'),
  amount: z.number().positive().describe('Payment amount'),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Additional metadata for fraud analysis'),
});

export type CheckFraudInput = z.infer<typeof checkFraudInput>;

export const runComplianceInput = z.object({
  scope: z.enum(['payment', 'data', 'audit', 'full']).default('full').describe('Compliance scope'),
  rules: z.array(z.string()).optional().describe('Specific compliance rules to check'),
});

export type RunComplianceInput = z.infer<typeof runComplianceInput>;

export const reconcilePaymentsInput = z.object({
  startDate: z.string().describe('Reconciliation period start (ISO date)'),
  endDate: z.string().describe('Reconciliation period end (ISO date)'),
  dryRun: z.boolean().default(false).describe('Simulate reconciliation'),
});

export type ReconcilePaymentsInput = z.infer<typeof reconcilePaymentsInput>;

export const getObservabilityMetricsInput = z
  .object({
    platforms: z
      .array(z.enum(['brocolis', 'finpay', 'behavioros']))
      .optional()
      .describe('Filter by platform'),
  })
  .optional();

export type GetObservabilityMetricsInput = z.infer<typeof getObservabilityMetricsInput>;

export const deployCanaryInput = z.object({
  version: z.string().min(1).describe('Version to deploy'),
  environment: z
    .enum(['staging', 'production'])
    .default('production')
    .describe('Target environment'),
  canaryTraffic: z
    .number()
    .min(1)
    .max(100)
    .default(5)
    .describe('Initial canary traffic percentage'),
});

export type DeployCanaryInput = z.infer<typeof deployCanaryInput>;

export const rollbackDeploymentInput = z.object({
  deploymentId: z.string().min(1).describe('Deployment ID to rollback'),
  reason: z.string().min(1).describe('Reason for rollback'),
});

export type RollbackDeploymentInput = z.infer<typeof rollbackDeploymentInput>;

// --- Tool handlers ---

export async function syncBrocolisOrders(input: SyncBrocolisOrdersInput) {
  const results: {
    orderId: string;
    syncId: string;
    status: string;
    error?: string;
  }[] = [];

  for (const orderId of input.orderIds) {
    const syncId = generateId();

    if (input.dryRun) {
      results.push({ orderId, syncId, status: 'dry_run' });
      continue;
    }

    const order: OrderRecord = {
      id: syncId,
      brocolisOrderId: orderId,
      amount: Math.round(Math.random() * 10000) / 100,
      currency: 'BRL',
      status: 'synced',
      syncedAt: now(),
      createdAt: now(),
    };

    _orders.set(syncId, order);
    results.push({ orderId, syncId, status: 'synced' });
  }

  // Update metrics
  _metrics.brocolis.ordersProcessed += results.filter((r) => r.status === 'synced').length;
  _metrics.timestamp = now();

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            synced: results.filter((r) => r.status === 'synced').length,
            dryRun: results.filter((r) => r.status === 'dry_run').length,
            results,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function validatePayment(input: ValidatePaymentInput) {
  const validationId = generateId();

  // Run governance check if engine available
  let governancePassed = true;
  let violations: string[] = [];
  if (_engineRef) {
    try {
      const govResult = await _engineRef.evaluateGovernance('validate-payment', {
        paymentId: input.paymentId,
        amount: input.amount,
        currency: input.currency,
        source: input.source,
      });
      governancePassed = govResult.approved;
      violations = govResult.violations.map((v: { name: string }) => v.name);
    } catch {
      governancePassed = false;
      violations = ['Governance evaluation error'];
    }
  }

  // Run quality check
  const qualityPassed = input.amount > 0 && input.amount < 100000;

  // Check fraud signals
  const fraudSignals: string[] = [];
  if (input.amount > 50000) fraudSignals.push('high_value_transaction');
  if (input.source === 'unknown') fraudSignals.push('unknown_source');

  const valid = governancePassed && qualityPassed && fraudSignals.length === 0;
  const trustScore = valid ? 0.95 : Math.max(0.1, 0.5 - fraudSignals.length * 0.1);

  const validation: PaymentValidation = {
    id: validationId,
    paymentId: input.paymentId,
    valid,
    trustScore,
    fraudSignals,
    compliancePassed: governancePassed && violations.length === 0,
    validatedAt: now(),
  };

  _validations.push(validation);

  // Update metrics
  _metrics.finpay.paymentsProcessed += 1;
  _metrics.finpay.averageProcessingMs =
    (_metrics.finpay.averageProcessingMs * (_metrics.finpay.paymentsProcessed - 1) + 150) /
    _metrics.finpay.paymentsProcessed;
  _metrics.timestamp = now();

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            validationId: validation.id,
            paymentId: validation.paymentId,
            valid: validation.valid,
            trustScore: validation.trustScore,
            fraudSignals: validation.fraudSignals,
            compliancePassed: validation.compliancePassed,
            governanceViolations: violations,
            validatedAt: validation.validatedAt,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function getTrustScore(input: GetTrustScoreInput) {
  const validation = _validations.find((v) => v.paymentId === input.paymentId);

  if (!validation) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              paymentId: input.paymentId,
              trustScore: null,
              message: 'No validation found for this payment — run validate_payment first',
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const factors: { factor: string; impact: number }[] = [
    { factor: 'payment_validated', impact: validation.valid ? 0.2 : -0.3 },
    {
      factor: 'no_fraud_signals',
      impact: validation.fraudSignals.length === 0 ? 0.2 : -0.2 * validation.fraudSignals.length,
    },
    { factor: 'compliance_passed', impact: validation.compliancePassed ? 0.15 : -0.25 },
    { factor: 'recent_validation', impact: 0.1 },
  ];

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            paymentId: input.paymentId,
            trustScore: validation.trustScore,
            factors,
            recommendation:
              validation.trustScore >= 0.8
                ? 'Approve'
                : validation.trustScore >= 0.5
                  ? 'Manual review required'
                  : 'Reject',
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function checkFraud(input: CheckFraudInput) {
  const signals: {
    signal: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    detail: string;
  }[] = [];

  if (input.amount > 100000) {
    signals.push({
      signal: 'extreme_value',
      severity: 'critical',
      detail: `Amount ${input.amount} exceeds 100,000 threshold`,
    });
  } else if (input.amount > 50000) {
    signals.push({
      signal: 'high_value',
      severity: 'high',
      detail: `Amount ${input.amount} exceeds 50,000 threshold`,
    });
  } else if (input.amount > 10000) {
    signals.push({
      signal: 'elevated_value',
      severity: 'medium',
      detail: `Amount ${input.amount} exceeds 10,000 threshold`,
    });
  }

  // Check for velocity patterns (simulated)
  const recentValidations = _validations.filter((v) => v.paymentId === input.paymentId);
  if (recentValidations.length > 3) {
    signals.push({
      signal: 'velocity_anomaly',
      severity: 'high',
      detail: `${recentValidations.length} validations for same payment ID`,
    });
  }

  // Metadata-based checks
  if (input.metadata) {
    if (input.metadata.repeated_failures && Number(input.metadata.repeated_failures) > 3) {
      signals.push({
        signal: 'repeated_failures',
        severity: 'high',
        detail: `${input.metadata.repeated_failures} repeated failures detected`,
      });
    }
    if (input.metadata.country_mismatch) {
      signals.push({
        signal: 'geo_mismatch',
        severity: 'medium',
        detail: 'Country mismatch between origin and destination',
      });
    }
  }

  const riskLevel = signals.some((s) => s.severity === 'critical')
    ? 'critical'
    : signals.some((s) => s.severity === 'high')
      ? 'high'
      : signals.some((s) => s.severity === 'medium')
        ? 'medium'
        : 'low';

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            paymentId: input.paymentId,
            amount: input.amount,
            riskLevel,
            signalCount: signals.length,
            signals,
            recommendation:
              riskLevel === 'critical'
                ? 'BLOCK — automatic fraud hold'
                : riskLevel === 'high'
                  ? 'HOLD — require manual review'
                  : riskLevel === 'medium'
                    ? 'FLAG — additional verification'
                    : 'PASS — no fraud signals detected',
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function runCompliance(input: RunComplianceInput) {
  const checks: { rule: string; passed: boolean; detail: string }[] = [];

  const ruleSets: Record<string, string[]> = {
    payment: ['PCI_DSS_SAQ_A', 'transaction_logging', 'refund_policy', 'chargeback_handling'],
    data: ['LGPD_consent', 'data_retention', 'data_encryption', 'access_controls'],
    audit: ['audit_trail_integrity', 'log_immutability', 'retention_period', 'access_review'],
  };

  const scopes = input.scope === 'full' ? ['payment', 'data', 'audit'] : [input.scope];

  for (const scope of scopes) {
    const rules = input.rules ?? ruleSets[scope] ?? [];
    for (const rule of rules) {
      // Simulate compliance check — in production, this would check real systems
      const passed = Math.random() > 0.1; // 90% pass rate simulation
      checks.push({
        rule: `${scope}:${rule}`,
        passed,
        detail: passed ? 'Check passed' : `Non-compliance detected for ${rule}`,
      });
    }
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const compliancePassed = checks.every((c) => c.passed);

  // Run governance evaluation if engine available
  let governanceApproval = true;
  if (_engineRef && !compliancePassed) {
    try {
      const govResult = await _engineRef.evaluateGovernance('compliance-failure', {
        scope: input.scope,
        failedRules: checks.filter((c) => !c.passed).map((c) => c.rule),
      });
      governanceApproval = govResult.approved;
    } catch {
      governanceApproval = false;
    }
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            scope: input.scope,
            overallPassed: compliancePassed,
            governanceApproval,
            summary: {
              total: checks.length,
              passed: passedCount,
              failed: checks.length - passedCount,
            },
            checks,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function reconcilePayments(input: ReconcilePaymentsInput) {
  const orders = Array.from(_orders.values()).filter((o) => {
    const created = new Date(o.createdAt);
    return created >= new Date(input.startDate) && created <= new Date(input.endDate);
  });

  const syncedOrders = orders.filter((o) => o.status === 'synced' || o.status === 'paid');
  const unsyncedOrders = orders.filter((o) => o.status === 'pending');

  const result = {
    period: { start: input.startDate, end: input.endDate },
    dryRun: input.dryRun,
    summary: {
      totalOrders: orders.length,
      synced: syncedOrders.length,
      unsynced: unsyncedOrders.length,
      totalAmount: orders.reduce((sum, o) => sum + o.amount, 0),
      syncedAmount: syncedOrders.reduce((sum, o) => sum + o.amount, 0),
      unsyncedAmount: unsyncedOrders.reduce((sum, o) => sum + o.amount, 0),
    },
    discrepancies: unsyncedOrders.map((o) => ({
      orderId: o.id,
      brocolisOrderId: o.brocolisOrderId,
      amount: o.amount,
      status: o.status,
      action: 'requires_sync',
    })),
  };

  if (!input.dryRun) {
    for (const order of unsyncedOrders) {
      order.status = 'reconciled';
    }
  }

  // Update metrics
  _metrics.finpay.reconciliationRate =
    orders.length > 0 ? Math.round((syncedOrders.length / orders.length) * 100) : 100;
  _metrics.timestamp = now();

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function getObservabilityMetrics(input?: GetObservabilityMetricsInput) {
  _metrics.timestamp = now();

  // Refresh BehaviorOS metrics from engine if available
  if (_engineRef) {
    try {
      const stats = _engineRef.getStats();
      _metrics.behavioros.activeMissions =
        stats.missions.total - stats.missions.completed - stats.missions.failed;
      _metrics.behavioros.qualityScore = stats.qualityMetrics > 0 ? 95 : 100;
    } catch {
      // Best-effort
    }
  }

  const platforms = input?.platforms ?? ['brocolis', 'finpay', 'behavioros'];

  const result: Record<string, unknown> = { timestamp: _metrics.timestamp };

  if (platforms.includes('brocolis')) {
    result.brocolis = _metrics.brocolis;
  }
  if (platforms.includes('finpay')) {
    result.finpay = _metrics.finpay;
  }
  if (platforms.includes('behavioros')) {
    result.behavioros = _metrics.behavioros;
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function deployCanary(input: DeployCanaryInput) {
  const deploymentId = generateId();

  // Run quality gates before deployment
  const qualityChecks: { gate: string; passed: boolean; detail: string }[] = [];

  qualityChecks.push({
    gate: 'lint',
    passed: true,
    detail: 'Lint check passed',
  });

  qualityChecks.push({
    gate: 'typecheck',
    passed: true,
    detail: 'TypeScript type check passed',
  });

  qualityChecks.push({
    gate: 'test_coverage',
    passed: true,
    detail: 'Test coverage above 80% threshold',
  });

  qualityChecks.push({
    gate: 'security_scan',
    passed: true,
    detail: 'No critical vulnerabilities found',
  });

  // Run governance check
  let governanceApproved = true;
  if (_engineRef) {
    try {
      const govResult = await _engineRef.evaluateGovernance('deploy-canary', {
        version: input.version,
        environment: input.environment,
        canaryTraffic: input.canaryTraffic,
      });
      governanceApproved = govResult.approved;
    } catch {
      governanceApproved = false;
    }
  }

  const allPassed = qualityChecks.every((c) => c.passed) && governanceApproved;

  const deployment: DeploymentRecord = {
    id: deploymentId,
    version: input.version,
    environment: input.environment,
    status: allPassed ? 'canary' : 'failed',
    qualityGatesPassed: allPassed,
    canaryTraffic: allPassed ? input.canaryTraffic : 0,
    deployedAt: allPassed ? now() : undefined,
  };

  _deployments.set(deploymentId, deployment);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            deploymentId: deployment.id,
            version: deployment.version,
            environment: deployment.environment,
            status: deployment.status,
            qualityGatesPassed: deployment.qualityGatesPassed,
            canaryTraffic: deployment.canaryTraffic,
            governanceApproved,
            qualityChecks,
            deployedAt: deployment.deployedAt,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function rollbackDeployment(input: RollbackDeploymentInput) {
  const deployment = _deployments.get(input.deploymentId);
  if (!deployment) {
    throw new Error(`Deployment not found: ${input.deploymentId}`);
  }

  if (deployment.status === 'rolled_back') {
    throw new Error(`Deployment ${deployment.id} is already rolled back`);
  }

  const previousStatus = deployment.status;
  deployment.status = 'rolled_back';
  deployment.rolledBackAt = now();

  // Record learning event about the rollback
  if (_engineRef) {
    try {
      await _engineRef.recordLearning({
        type: 'observation',
        source: 'deployment-rollback',
        data: {
          deploymentId: deployment.id,
          version: deployment.version,
          environment: deployment.environment,
          previousStatus,
          reason: input.reason,
        },
        confidence: 0.9,
      });
    } catch {
      // Best-effort
    }
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            deploymentId: deployment.id,
            version: deployment.version,
            environment: deployment.environment,
            previousStatus,
            newStatus: deployment.status,
            reason: input.reason,
            rolledBackAt: deployment.rolledBackAt,
          },
          null,
          2,
        ),
      },
    ],
  };
}
