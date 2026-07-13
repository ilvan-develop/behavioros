import { randomUUID } from 'node:crypto';
import type { QualityGate, QualityMetric } from '@behavioros/schemas';

// ============================================================
// Quality Engine — Quality Gates, Metrics, Enforcement
// ============================================================

export interface QualityCheckResult {
  gate: string;
  passed: boolean;
  actual: number | boolean;
  expected: number | boolean;
  message: string;
}

export interface QualityReport {
  id: string;
  passed: boolean;
  score: number;
  checks: QualityCheckResult[];
  metrics: QualityMetric[];
  duration: number;
  timestamp: string;
}

export class QualityEngine {
  private gates: QualityGate[];
  private history: QualityReport[] = [];
  private minScore: number;

  constructor(gates: QualityGate[] = [], options?: { minScore?: number }) {
    this.gates = gates;
    this.minScore = options?.minScore ?? 80;
  }

  /**
   * Avalia métricas contra os quality gates configurados
   */
  evaluate(metrics: QualityMetric[]): QualityReport {
    const reportId = randomUUID();
    const start = Date.now();
    const checks: QualityCheckResult[] = [];

    for (const gate of this.gates) {
      const metric = metrics.find((m) => m.name === gate.name);
      if (!metric) {
        checks.push({
          gate: gate.name,
          passed: false,
          actual: 'missing',
          expected: gate.threshold ?? gate.pass,
          message: `Metric not found for gate: ${gate.name}`,
        });
        continue;
      }

      const check = this.evaluateGate(gate, metric);
      checks.push(check);
    }

    const passedChecks = checks.filter((c) => c.passed).length;
    const score = checks.length > 0 ? Math.round((passedChecks / checks.length) * 100) : 100;
    const passed = score >= this.minScore && checks.every((c) => c.passed);

    const report: QualityReport = {
      id: reportId,
      passed,
      score,
      checks,
      metrics,
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    };

    this.history.push(report);
    return report;
  }

  /**
   * Adiciona um quality gate
   */
  addGate(gate: QualityGate): void {
    const existing = this.gates.findIndex((g) => g.name === gate.name);
    if (existing >= 0) {
      this.gates[existing] = gate;
    } else {
      this.gates.push(gate);
    }
  }

  /**
   * Remove um quality gate
   */
  removeGate(name: string): boolean {
    const index = this.gates.findIndex((g) => g.name === name);
    if (index >= 0) {
      this.gates.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Obtém todos os gates
   */
  getGates(): QualityGate[] {
    return [...this.gates];
  }

  /**
   * Obtém histórico de relatórios
   */
  getHistory(): QualityReport[] {
    return [...this.history];
  }

  /**
   * Obtém o último relatório
   */
  getLastReport(): QualityReport | undefined {
    return this.history[this.history.length - 1];
  }

  private evaluateGate(gate: QualityGate, metric: QualityMetric): QualityCheckResult {
    if (gate.threshold !== undefined) {
      const actual = metric.value;
      const passed = actual >= gate.threshold;
      return {
        gate: gate.name,
        passed,
        actual,
        expected: gate.threshold,
        message: passed
          ? `${gate.name}: ${actual} >= ${gate.threshold}`
          : `${gate.name}: ${actual} < ${gate.threshold} (threshold not met)`,
      };
    }

    if (gate.pass !== undefined) {
      const actual = metric.pass ?? metric.value > 0;
      const passed = actual === gate.pass;
      return {
        gate: gate.name,
        passed,
        actual,
        expected: gate.pass,
        message: passed ? `${gate.name}: passed` : `${gate.name}: failed (expected ${gate.pass})`,
      };
    }

    return {
      gate: gate.name,
      passed: true,
      actual: metric.value,
      expected: 'any',
      message: `${gate.name}: no threshold configured, auto-pass`,
    };
  }

  /**
   * Resumo da qualidade
   */
  summary(report: QualityReport): string {
    const lines: string[] = [];
    lines.push(`Quality Report: ${report.id}`);
    lines.push(`Overall: ${report.passed ? '✅ PASSED' : '❌ FAILED'} (${report.score}/100)`);
    lines.push(
      `Checks: ${report.checks.filter((c) => c.passed).length}/${report.checks.length} passed`,
    );
    lines.push(`Duration: ${report.duration}ms`);
    for (const check of report.checks) {
      const icon = check.passed ? '✅' : '❌';
      lines.push(`  ${icon} ${check.message}`);
    }
    return lines.join('\n');
  }
}
