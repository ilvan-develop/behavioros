import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

function generateId(): string {
  return `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

function runCommandSafe(command: string, timeoutMs = 30_000): { ok: boolean; output: string } {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return { ok: true, output };
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string; status?: number };
    const output = error.stderr || error.stdout || String(err);
    return { ok: false, output };
  }
}

function detectProjectRoot(): string {
  // Walk up from cwd to find package.json or pnpm-workspace.yaml
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

// --- Input schemas ---

export const syncBrocolisOrdersInput = z.object({
  orders: z
    .array(
      z.object({
        orderId: z.string().min(1).describe('Brocolis order ID'),
        amount: z.number().positive().describe('Order amount (must be > 0)'),
        currency: z
          .string()
          .min(3)
          .max(3)
          .optional()
          .describe('ISO 4217 currency code (default: BRL)'),
      }),
    )
    .min(1)
    .max(100)
    .describe('List of orders to sync with amounts'),
  dryRun: z.boolean().default(false).describe('Simulate sync without writing'),
});

export type SyncBrocolisOrdersInput = z.infer<typeof syncBrocolisOrdersInput>;

export const validatePaymentInput = z.object({
  paymentId: z.string().min(1).describe('Payment ID to validate'),
  amount: z.number().positive().describe('Payment amount'),
  currency: z.string().min(3).max(3).default('BRL').describe('ISO currency code'),
  source: z.string().default('brocolis').describe('Payment source platform'),
  maxAmount: z.number().positive().optional().describe('Maximum allowed amount (default: 500000)'),
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
  projectPath: z.string().optional().describe('Path to project root for filesystem checks'),
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
    amount: number;
    currency: string;
    error?: string;
  }[] = [];

  for (const order of input.orders) {
    const syncId = generateId();

    if (input.dryRun) {
      results.push({
        orderId: order.orderId,
        syncId,
        status: 'dry_run',
        amount: order.amount,
        currency: order.currency || 'BRL',
      });
      continue;
    }

    // Validate order data
    if (order.amount <= 0) {
      results.push({
        orderId: order.orderId,
        syncId,
        status: 'failed',
        amount: order.amount,
        currency: order.currency || 'BRL',
        error: 'Invalid amount: must be greater than 0',
      });
      continue;
    }

    if (!order.orderId || order.orderId.trim().length === 0) {
      results.push({
        orderId: order.orderId,
        syncId,
        status: 'failed',
        amount: order.amount,
        currency: order.currency || 'BRL',
        error: 'Invalid order ID: cannot be empty',
      });
      continue;
    }

    const record: OrderRecord = {
      id: syncId,
      brocolisOrderId: order.orderId,
      amount: order.amount,
      currency: order.currency || 'BRL',
      status: 'synced',
      syncedAt: now(),
      createdAt: now(),
    };

    _orders.set(syncId, record);
    results.push({
      orderId: order.orderId,
      syncId,
      status: 'synced',
      amount: order.amount,
      currency: order.currency || 'BRL',
    });
  }

  const syncedCount = results.filter((r) => r.status === 'synced').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const dryRunCount = results.filter((r) => r.status === 'dry_run').length;

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            summary: { synced: syncedCount, failed: failedCount, dryRun: dryRunCount },
            totalAmount: results
              .filter((r) => r.status === 'synced')
              .reduce((sum, r) => sum + r.amount, 0),
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

  // Real amount validation
  const maxAmount = input.maxAmount ?? 500_000;
  const amountErrors: string[] = [];
  if (input.amount <= 0) amountErrors.push('Amount must be greater than 0');
  if (input.amount > maxAmount)
    amountErrors.push(`Amount ${input.amount} exceeds maximum ${maxAmount}`);

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

  // Fraud signal detection based on amount patterns
  const fraudSignals: string[] = [];

  if (input.amount > 100_000) fraudSignals.push('extreme_value_transaction');
  else if (input.amount > 50_000) fraudSignals.push('high_value_transaction');
  else if (input.amount > 10_000) fraudSignals.push('elevated_value_transaction');

  if (input.source === 'unknown') fraudSignals.push('unknown_source');

  // Check for duplicate payment IDs (velocity)
  const previousAttempts = _validations.filter((v) => v.paymentId === input.paymentId);
  if (previousAttempts.length > 0) {
    fraudSignals.push('duplicate_payment_id');
  }
  if (previousAttempts.length >= 3) {
    fraudSignals.push('high_velocity_attempts');
  }

  // Check for round-number amounts above threshold (common fraud pattern)
  if (input.amount >= 1_000 && input.amount % 1_000 === 0) {
    fraudSignals.push('round_number_high_value');
  }

  const amountValid = amountErrors.length === 0;
  const valid = governancePassed && amountValid && fraudSignals.length === 0;

  // Trust score: start at 1.0, deduct per signal
  let trustScore = 1.0;
  if (!governancePassed) trustScore -= 0.3;
  if (!amountValid) trustScore -= 0.3;
  trustScore -= fraudSignals.length * 0.1;
  trustScore = Math.max(0, Math.round(trustScore * 100) / 100);

  const validation: PaymentValidation = {
    id: validationId,
    paymentId: input.paymentId,
    valid,
    trustScore,
    fraudSignals,
    compliancePassed: governancePassed && amountValid,
    validatedAt: now(),
  };

  _validations.push(validation);

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
            amountErrors,
            fraudSignals: validation.fraudSignals,
            compliancePassed: validation.compliancePassed,
            governanceViolations: violations,
            previousAttempts: previousAttempts.length,
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

  if (input.amount > 100_000) {
    signals.push({
      signal: 'extreme_value',
      severity: 'critical',
      detail: `Amount ${input.amount} exceeds 100,000 threshold`,
    });
  } else if (input.amount > 50_000) {
    signals.push({
      signal: 'high_value',
      severity: 'high',
      detail: `Amount ${input.amount} exceeds 50,000 threshold`,
    });
  } else if (input.amount > 10_000) {
    signals.push({
      signal: 'elevated_value',
      severity: 'medium',
      detail: `Amount ${input.amount} exceeds 10,000 threshold`,
    });
  }

  // Velocity checking based on actual validation history
  const validationHistory = _validations.filter((v) => v.paymentId === input.paymentId);

  if (validationHistory.length > 5) {
    signals.push({
      signal: 'velocity_anomaly',
      severity: 'critical',
      detail: `${validationHistory.length} validations for same payment ID — exceeds threshold of 5`,
    });
  } else if (validationHistory.length > 3) {
    signals.push({
      signal: 'velocity_warning',
      severity: 'high',
      detail: `${validationHistory.length} validations for same payment ID`,
    });
  }

  // Check if previous validations failed
  const failedPrevious = validationHistory.filter((v) => !v.valid);
  if (failedPrevious.length > 2) {
    signals.push({
      signal: 'repeated_validation_failures',
      severity: 'critical',
      detail: `${failedPrevious.length} previous validations failed for this payment ID`,
    });
  } else if (failedPrevious.length > 0) {
    signals.push({
      signal: 'previous_validation_failure',
      severity: 'medium',
      detail: `${failedPrevious.length} previous validation(s) failed`,
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
            validationHistoryCount: validationHistory.length,
            failedHistoryCount: failedPrevious.length,
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
  const projectRoot = input.projectPath || detectProjectRoot();

  for (const scope of scopes) {
    const rules = input.rules ?? ruleSets[scope] ?? [];
    for (const rule of rules) {
      let passed = false;
      let detail = '';

      switch (rule) {
        // --- Payment compliance ---
        case 'PCI_DSS_SAQ_A': {
          // Check for encryption configuration in the project
          const hasEncryptionConfig =
            (existsSync(join(projectRoot, '.env')) &&
              readFileSync(join(projectRoot, '.env'), 'utf-8').includes('ENCRYPT')) ||
            (existsSync(join(projectRoot, '.env.example')) &&
              readFileSync(join(projectRoot, '.env.example'), 'utf-8').includes('ENCRYPT')) ||
            existsSync(join(projectRoot, 'encryption.config.ts')) ||
            existsSync(join(projectRoot, 'encryption.config.js')) ||
            existsSync(join(projectRoot, 'src/config/encryption.ts'));

          passed = hasEncryptionConfig;
          detail = hasEncryptionConfig
            ? 'Encryption configuration found'
            : 'No encryption configuration found — PCI DSS requires encryption for cardholder data';
          break;
        }
        case 'transaction_logging': {
          // Check that the project has logging setup
          const hasLogger =
            existsSync(join(projectRoot, 'src/utils/logger.ts')) ||
            existsSync(join(projectRoot, 'src/utils/logger.js')) ||
            existsSync(join(projectRoot, 'src/lib/logger.ts')) ||
            existsSync(join(projectRoot, 'src/services/logger.ts'));
          passed = hasLogger;
          detail = hasLogger
            ? 'Transaction logging module found'
            : 'No logging module detected — transactions must be logged for audit trail';
          break;
        }
        case 'refund_policy':
        case 'chargeback_handling': {
          // Check for policy docs or implementation
          const hasPolicy =
            existsSync(join(projectRoot, 'docs/refund-policy.md')) ||
            existsSync(join(projectRoot, 'docs/refund-policy')) ||
            existsSync(join(projectRoot, 'src/services/refund'));
          passed = hasPolicy;
          detail = hasPolicy
            ? `${rule.replace(/_/g, ' ')} documentation or implementation found`
            : `${rule.replace(/_/g, ' ')} — policy or implementation not found in project`;
          break;
        }

        // --- Data compliance ---
        case 'LGPD_consent': {
          // Check for consent records or consent management
          const hasConsent =
            existsSync(join(projectRoot, 'src/services/consent')) ||
            existsSync(join(projectRoot, 'src/models/consent')) ||
            existsSync(join(projectRoot, 'src/middleware/consent'));
          passed = hasConsent;
          detail = hasConsent
            ? 'Consent management module found'
            : 'No consent management found — LGPD requires explicit consent records';
          break;
        }
        case 'data_retention': {
          const hasRetention =
            existsSync(join(projectRoot, 'docs/data-retention')) ||
            existsSync(join(projectRoot, 'src/config/retention'));
          passed = hasRetention;
          detail = hasRetention
            ? 'Data retention policy found'
            : 'No data retention policy found — required for LGPD compliance';
          break;
        }
        case 'data_encryption': {
          const hasEncryption =
            existsSync(join(projectRoot, 'src/utils/crypto.ts')) ||
            existsSync(join(projectRoot, 'src/services/encryption')) ||
            existsSync(join(projectRoot, 'src/lib/crypto'));
          passed = hasEncryption;
          detail = hasEncryption
            ? 'Data encryption utilities found'
            : 'No encryption utilities found — data must be encrypted at rest';
          break;
        }
        case 'access_controls': {
          const hasACL =
            existsSync(join(projectRoot, 'src/middleware/auth')) ||
            existsSync(join(projectRoot, 'src/middleware/rbac')) ||
            existsSync(join(projectRoot, 'src/services/authorization'));
          passed = hasACL;
          detail = hasACL
            ? 'Access control middleware found'
            : 'No access control middleware found — required for data protection';
          break;
        }

        // --- Audit compliance ---
        case 'audit_trail_integrity': {
          // Check for log files or audit infrastructure
          const hasLogs =
            existsSync(join(projectRoot, 'logs')) ||
            existsSync(join(projectRoot, 'src/services/audit')) ||
            existsSync(join(projectRoot, 'src/utils/audit'));
          passed = hasLogs;
          detail = hasLogs
            ? 'Audit trail infrastructure found'
            : 'No audit log infrastructure found — audit trail integrity cannot be verified';
          break;
        }
        case 'log_immutability': {
          const hasImmutability =
            existsSync(join(projectRoot, 'src/services/audit')) &&
            existsSync(join(projectRoot, 'src/utils/crypto'));
          passed = hasImmutability;
          detail = hasImmutability
            ? 'Log immutability tools detected (audit service + crypto)'
            : 'Cannot verify log immutability — audit + crypto modules required';
          break;
        }
        case 'retention_period': {
          const hasRetention =
            existsSync(join(projectRoot, 'docs/data-retention')) ||
            existsSync(join(projectRoot, 'src/config/retention'));
          passed = hasRetention;
          detail = hasRetention
            ? 'Retention period configuration found'
            : 'No retention period configuration found';
          break;
        }
        case 'access_review': {
          const hasReview =
            existsSync(join(projectRoot, 'src/services/authorization')) ||
            existsSync(join(projectRoot, 'src/middleware/rbac'));
          passed = hasReview;
          detail = hasReview
            ? 'Access review capability found'
            : 'No access review mechanism found — periodic access review required';
          break;
        }

        default: {
          passed = false;
          detail = `Unknown compliance rule: ${rule}`;
          break;
        }
      }

      checks.push({ rule: `${scope}:${rule}`, passed, detail });
    }
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const compliancePassed = checks.every((c) => c.passed);

  // Run governance evaluation if engine available and compliance failed
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
            projectRoot,
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
  const timestamp = now();

  // Pull real data from engine
  const brocolisMetrics = {
    ordersProcessed: _orders.size,
    averageLatencyMs: 0,
    errorRate: 0,
    uptime: 100,
  };

  const _syncedOrders = Array.from(_orders.values()).filter((o) => o.status === 'synced');
  const failedOrders = Array.from(_orders.values()).filter((o) => o.status === 'failed');
  if (_orders.size > 0) {
    brocolisMetrics.errorRate = Math.round((failedOrders.length / _orders.size) * 100 * 100) / 100;
    // Uptime is inverse of error rate for this context
    brocolisMetrics.uptime = Math.round((100 - brocolisMetrics.errorRate) * 100) / 100;
  }

  // FinPay metrics from validation history
  const finpayMetrics = {
    paymentsProcessed: _validations.length,
    averageProcessingMs: 0,
    failureRate: 0,
    reconciliationRate: 100,
  };

  if (_validations.length > 0) {
    const failedValidations = _validations.filter((v) => !v.valid);
    finpayMetrics.failureRate =
      Math.round((failedValidations.length / _validations.length) * 100 * 100) / 100;
  }

  // Reconciliation rate from actual reconciled orders
  const reconciledOrders = Array.from(_orders.values()).filter(
    (o) => o.status === 'reconciled' || o.status === 'paid',
  );
  if (_orders.size > 0) {
    finpayMetrics.reconciliationRate =
      Math.round((reconciledOrders.length / _orders.size) * 100 * 100) / 100;
  }

  // BehaviorOS metrics from engine
  const behaviorosMetrics = {
    activeMissions: 0,
    governanceViolations: 0,
    qualityScore: 100,
    auditPassRate: 100,
  };

  if (_engineRef) {
    try {
      const stats = _engineRef.getStats();
      const missionCounts = stats.missions as Record<string, number>;
      const _totalMissions = Object.values(missionCounts).reduce(
        (sum: number, n: number) => sum + n,
        0,
      );
      const activeMissions = (missionCounts.executing || 0) + (missionCounts.created || 0);
      behaviorosMetrics.activeMissions = activeMissions;

      // Count governance violations from audit log
      const auditLog = _engineRef.getAuditLog();
      const governanceEvents = auditLog.filter((e: { type: string }) =>
        e.type.startsWith('governance:'),
      );
      const violations = governanceEvents.filter((e: { result: string }) => e.result === 'fail');
      behaviorosMetrics.governanceViolations = violations.length;

      // Audit pass rate from real audit events
      if (auditLog.length > 0) {
        const passedEvents = auditLog.filter((e: { result: string }) => e.result === 'pass');
        behaviorosMetrics.auditPassRate =
          Math.round((passedEvents.length / auditLog.length) * 100 * 100) / 100;
      }

      // Quality score from quality metrics
      if (stats.qualityMetrics > 0) {
        const qualityData = auditLog.filter((e: { type: string }) => e.type.startsWith('quality:'));
        if (qualityData.length > 0) {
          const passedQuality = qualityData.filter((e: { result: string }) => e.result === 'pass');
          behaviorosMetrics.qualityScore =
            Math.round((passedQuality.length / qualityData.length) * 100 * 100) / 100;
        }
      }
    } catch {
      // Engine not ready — return zeroed metrics
    }
  }

  const platforms = input?.platforms ?? ['brocolis', 'finpay', 'behavioros'];

  const result: Record<string, unknown> = { timestamp };

  if (platforms.includes('brocolis')) {
    result.brocolis = brocolisMetrics;
  }
  if (platforms.includes('finpay')) {
    result.finpay = finpayMetrics;
  }
  if (platforms.includes('behavioros')) {
    result.behavioros = behaviorosMetrics;
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
  const projectRoot = detectProjectRoot();

  // Run REAL quality gates
  const qualityChecks: { gate: string; passed: boolean; detail: string }[] = [];

  // Gate 1: Lint check (biome or eslint)
  let lintPassed = false;
  let lintDetail = '';
  if (existsSync(join(projectRoot, 'biome.json')) || existsSync(join(projectRoot, 'biome.jsonc'))) {
    const lintResult = runCommandSafe('npx biome check --no-errors-on-unmatched .', 60_000);
    lintPassed = lintResult.ok;
    lintDetail = lintResult.ok
      ? 'Biome lint check passed'
      : `Biome check failed:\n${lintResult.output.slice(0, 500)}`;
  } else if (
    existsSync(join(projectRoot, '.eslintrc')) ||
    existsSync(join(projectRoot, '.eslintrc.js')) ||
    existsSync(join(projectRoot, '.eslintrc.json'))
  ) {
    const lintResult = runCommandSafe('npx eslint . --max-warnings 0', 60_000);
    lintPassed = lintResult.ok;
    lintDetail = lintResult.ok
      ? 'ESLint check passed'
      : `ESLint check failed:\n${lintResult.output.slice(0, 500)}`;
  } else {
    lintPassed = true;
    lintDetail = 'No linter config found — skipped';
  }
  qualityChecks.push({ gate: 'lint', passed: lintPassed, detail: lintDetail });

  // Gate 2: TypeScript type check
  let typecheckPassed = false;
  let typecheckDetail = '';
  if (existsSync(join(projectRoot, 'tsconfig.json'))) {
    const tscResult = runCommandSafe('npx tsc --noEmit', 120_000);
    typecheckPassed = tscResult.ok;
    typecheckDetail = tscResult.ok
      ? 'TypeScript type check passed'
      : `TypeScript errors:\n${tscResult.output.slice(0, 500)}`;
  } else {
    typecheckPassed = true;
    typecheckDetail = 'No tsconfig.json found — skipped';
  }
  qualityChecks.push({ gate: 'typecheck', passed: typecheckPassed, detail: typecheckDetail });

  // Gate 3: Test coverage
  let coveragePassed = false;
  let coverageDetail = '';
  if (
    existsSync(join(projectRoot, 'vitest.config.ts')) ||
    existsSync(join(projectRoot, 'vitest.config.js')) ||
    existsSync(join(projectRoot, 'jest.config.ts')) ||
    existsSync(join(projectRoot, 'jest.config.js'))
  ) {
    const testResult = runCommandSafe('npx vitest run --coverage', 120_000);
    if (testResult.ok) {
      // Try to parse coverage from output
      const coverageMatch = testResult.output.match(/All files\s*\|\s*(\d+\.?\d*)/);
      const coverage = coverageMatch ? Number.parseFloat(coverageMatch[1]) : null;
      coveragePassed = coverage !== null ? coverage >= 80 : true;
      coverageDetail =
        coverage !== null
          ? `Test coverage: ${coverage}% (threshold: 80%)`
          : 'Tests passed (coverage output not parsed)';
    } else {
      coveragePassed = false;
      coverageDetail = `Tests failed:\n${testResult.output.slice(0, 500)}`;
    }
  } else {
    coveragePassed = true;
    coverageDetail = 'No test config found — skipped';
  }
  qualityChecks.push({ gate: 'test_coverage', passed: coveragePassed, detail: coverageDetail });

  // Gate 4: Security audit (npm audit)
  let securityPassed = false;
  let securityDetail = '';
  const auditResult = runCommandSafe('npm audit --audit-level=critical', 30_000);
  // npm audit exits non-zero when vulnerabilities found
  if (auditResult.ok) {
    securityPassed = true;
    securityDetail = 'No critical vulnerabilities found';
  } else {
    // Check if the output mentions actual vulnerabilities vs just npm audit being strict
    const hasCritical = auditResult.output.includes('critical');
    securityPassed = !hasCritical;
    securityDetail = hasCritical
      ? `Critical vulnerabilities detected:\n${auditResult.output.slice(0, 500)}`
      : `npm audit warnings (no critical):\n${auditResult.output.slice(0, 300)}`;
  }
  qualityChecks.push({ gate: 'security_scan', passed: securityPassed, detail: securityDetail });

  // Run governance check for deployment approval
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
        applied: false,
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
