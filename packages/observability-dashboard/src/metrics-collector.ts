// ============================================================
// Metrics Collector — Brocolis + FinPay + BehaviorOS
// ============================================================

import type {
  BehaviorOSGovernance,
  BehaviorOSLayers,
  BehaviorOSLearning,
  BehaviorOSMetrics,
  BehaviorOSPipeline,
  BehaviorOSQuality,
  BrocolisApi,
  BrocolisDeliveries,
  BrocolisMetrics,
  BrocolisOrders,
  BrocolisPrescriptions,
  BrocolisUsers,
  FinPayCompliance,
  FinPayFraud,
  FinPayMetrics,
  FinPayOcr,
  FinPayPayments,
  FinPayTrust,
  UnifiedMetrics,
} from './types';

export interface MetricsCollectorConfig {
  brocolisApiUrl?: string;
  finpayApiUrl?: string;
  behaviorosDataPath?: string;
  collectInterval?: number;
}

export class MetricsCollector {
  private readonly config: MetricsCollectorConfig;
  private collectionTimestamp: string;

  constructor(config: MetricsCollectorConfig = {}) {
    this.config = config;
    this.collectionTimestamp = new Date().toISOString();
  }

  async collectBrocolisMetrics(): Promise<BrocolisMetrics> {
    const now = this.timestamp();

    const orders: BrocolisOrders = {
      total: this.metric('brocolis_orders_total', 0, 1000),
      pending: this.metric('brocolis_orders_pending', 0, 100),
      completed: this.metric('brocolis_orders_completed', 0, 800),
      cancelled: this.metric('brocolis_orders_cancelled', 0, 50),
      revenue: this.metric('brocolis_revenue', 0, 50000),
    };

    const prescriptions: BrocolisPrescriptions = {
      uploaded: this.metric('brocolis_prescriptions_uploaded', 0, 500),
      verified: this.metric('brocolis_prescriptions_verified', 0, 450),
      rejected: this.metric('brocolis_prescriptions_rejected', 0, 20),
    };

    const deliveries: BrocolisDeliveries = {
      active: this.metric('brocolis_deliveries_active', 0, 30),
      completed: this.metric('brocolis_deliveries_completed', 0, 200),
      failed: this.metric('brocolis_deliveries_failed', 0, 5),
    };

    const users: BrocolisUsers = {
      active: this.metric('brocolis_users_active', 0, 500),
      new: this.metric('brocolis_users_new', 0, 50),
      churned: this.metric('brocolis_users_churned', 0, 10),
    };

    const api: BrocolisApi = {
      latency: this.metric('brocolis_api_latency_ms', 10, 500),
      errorRate: this.metric('brocolis_api_error_rate', 0, 5),
      throughput: this.metric('brocolis_api_throughput', 100, 2000),
    };

    return { orders, prescriptions, deliveries, users, api, timestamp: now };
  }

  async collectFinPayMetrics(): Promise<FinPayMetrics> {
    const now = this.timestamp();

    const payments: FinPayPayments = {
      total: this.metric('finpay_payments_total', 0, 2000),
      approved: this.metric('finpay_payments_approved', 0, 1800),
      rejected: this.metric('finpay_payments_rejected', 0, 100),
      pendingReview: this.metric('finpay_payments_pending_review', 0, 50),
    };

    const trust: FinPayTrust = {
      avgScore: this.metric('finpay_trust_avg', 0, 100),
      distribution: {
        low: this.metric('finpay_trust_low', 0, 50),
        medium: this.metric('finpay_trust_medium', 0, 200),
        high: this.metric('finpay_trust_high', 0, 500),
      },
    };

    const fraud: FinPayFraud = {
      detected: this.metric('finpay_fraud_detected', 0, 20),
      falsePositives: this.metric('finpay_fraud_false_positives', 0, 5),
      truePositives: this.metric('finpay_fraud_true_positives', 0, 15),
    };

    const compliance: FinPayCompliance = {
      passed: this.metric('finpay_compliance_passed', 0, 100),
      violations: this.metric('finpay_compliance_violations', 0, 10),
    };

    const ocr: FinPayOcr = {
      accuracy: this.metric('finpay_ocr_accuracy', 80, 99),
      processingTime: this.metric('finpay_ocr_processing_time_ms', 100, 5000),
    };

    return { payments, trust, fraud, compliance, ocr, timestamp: now };
  }

  async collectBehaviorOSMetrics(): Promise<BehaviorOSMetrics> {
    const now = this.timestamp();

    const pipeline: BehaviorOSPipeline = {
      active: this.metric('behavioros_pipeline_active', 0, 10),
      completed: this.metric('behavioros_pipeline_completed', 0, 100),
      failed: this.metric('behavioros_pipeline_failed', 0, 10),
    };

    const layers: BehaviorOSLayers = {
      passed: this.metric('behavioros_layers_passed', 0, 90),
      failed: this.metric('behavioros_layers_failed', 0, 9),
      pending: this.metric('behavioros_layers_pending', 0, 9),
    };

    const governance: BehaviorOSGovernance = {
      blocked: this.metric('behavioros_governance_blocked', 0, 20),
      escalated: this.metric('behavioros_governance_escalated', 0, 15),
      approved: this.metric('behavioros_governance_approved', 0, 200),
    };

    const quality: BehaviorOSQuality = {
      coverage: this.metric('behavioros_quality_coverage', 50, 100),
      lintPass: this.metric('behavioros_quality_lint', 0, 1) > 0.5,
      typecheckPass: this.metric('behavioros_quality_typecheck', 0, 1) > 0.5,
    };

    const learning: BehaviorOSLearning = {
      events: this.metric('behavioros_learning_events', 0, 500),
      patterns: this.metric('behavioros_learning_patterns', 0, 50),
      autoFixes: this.metric('behavioros_learning_autofixes', 0, 30),
    };

    return { pipeline, layers, governance, quality, learning, timestamp: now };
  }

  async getUnifiedMetrics(): Promise<UnifiedMetrics> {
    const [brocolis, finpay, behavioros] = await Promise.all([
      this.collectBrocolisMetrics(),
      this.collectFinPayMetrics(),
      this.collectBehaviorOSMetrics(),
    ]);

    return {
      brocolis,
      finpay,
      behavioros,
      timestamp: this.timestamp(),
    };
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  private metric(_name: string, min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
