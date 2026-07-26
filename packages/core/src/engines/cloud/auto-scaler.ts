/**
 * ScalingMetric — Type alias for scalingmetric.
 */
export type ScalingMetric =
  | 'queue-depth'
  | 'cpu-usage'
  | 'memory-usage'
  | 'token-usage'
  | 'request-rate'
  | 'custom';

/**
 * ScalingRule — Configuration and options interface.
 */
export interface ScalingRule {
  id: string;
  metric: ScalingMetric;
  targetValue: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  minReplicas: number;
  maxReplicas: number;
  cooldownMs: number;
  customMetric?: string;
  customProvider?: (currentValue: number, targetValue: number) => number;
}

/**
 * ScalingDecision — Configuration and options interface.
 */
export interface ScalingDecision {
  timestamp: string;
  ruleId: string;
  currentReplicas: number;
  desiredReplicas: number;
  reason: string;
  metrics: Record<string, number>;
}

/**
 * AutoScaler — Provides constructor, addRule, removeRule, evaluate, ... operations.
 */
export class AutoScaler {
  private rules: Map<string, ScalingRule> = new Map();
  private currentReplicas: number;
  private history: ScalingDecision[] = [];
  private lastScalingTime: Map<string, number> = new Map();

  constructor(initialReplicas = 1) {
    this.currentReplicas = initialReplicas;
  }

  addRule(rule: ScalingRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(id: string): void {
    this.rules.delete(id);
    this.lastScalingTime.delete(id);
  }

  async evaluate(metrics: Record<string, number>): Promise<ScalingDecision[]> {
    const decisions: ScalingDecision[] = [];
    const now = Date.now();

    for (const rule of this.rules.values()) {
      const metricValue = metrics[rule.metric] ?? metrics[rule.customMetric ?? ''];
      if (metricValue === undefined) continue;

      const lastScale = this.lastScalingTime.get(rule.id) ?? 0;
      if (now - lastScale < rule.cooldownMs) {
        decisions.push({
          timestamp: new Date().toISOString(),
          ruleId: rule.id,
          currentReplicas: this.currentReplicas,
          desiredReplicas: this.currentReplicas,
          reason: `cooldown active (${now - lastScale}ms < ${rule.cooldownMs}ms)`,
          metrics: { [rule.metric]: metricValue },
        });
        continue;
      }

      let desiredReplicas = this.currentReplicas;

      if (rule.metric === 'custom' && rule.customProvider) {
        const raw = rule.customProvider(metricValue, rule.targetValue);
        desiredReplicas = Math.round(raw);
      } else if (metricValue > rule.scaleUpThreshold) {
        const ratio = metricValue / rule.targetValue;
        desiredReplicas = Math.ceil(this.currentReplicas * ratio);
      } else if (metricValue < rule.scaleDownThreshold) {
        const ratio = metricValue / rule.targetValue;
        desiredReplicas = Math.max(1, Math.floor(this.currentReplicas * ratio));
      } else {
        continue;
      }

      desiredReplicas = Math.max(rule.minReplicas, Math.min(rule.maxReplicas, desiredReplicas));

      let reason: string;
      if (desiredReplicas > this.currentReplicas) {
        reason = `scale-up: ${rule.metric}=${metricValue} > threshold=${rule.scaleUpThreshold}`;
      } else if (desiredReplicas < this.currentReplicas) {
        reason = `scale-down: ${rule.metric}=${metricValue} < threshold=${rule.scaleDownThreshold}`;
      } else {
        reason = `no change needed (within bounds)`;
      }

      const decision: ScalingDecision = {
        timestamp: new Date().toISOString(),
        ruleId: rule.id,
        currentReplicas: this.currentReplicas,
        desiredReplicas,
        reason,
        metrics: { [rule.metric]: metricValue },
      };

      decisions.push(decision);
      if (desiredReplicas !== this.currentReplicas) {
        this.currentReplicas = desiredReplicas;
        this.lastScalingTime.set(rule.id, now);
      }
    }

    this.history.push(...decisions);
    return decisions;
  }

  getCurrentReplicas(): number {
    return this.currentReplicas;
  }

  getHistory(count?: number): ScalingDecision[] {
    if (count === undefined) return [...this.history];
    return this.history.slice(-count);
  }

  summarize(): {
    currentReplicas: number;
    totalRules: number;
    lastDecision?: ScalingDecision;
    averageReplicas: number;
  } {
    const replicasSum = this.history.reduce((sum, d) => sum + d.desiredReplicas, 0);
    const averageReplicas =
      this.history.length > 0 ? replicasSum / this.history.length : this.currentReplicas;

    return {
      currentReplicas: this.currentReplicas,
      totalRules: this.rules.size,
      lastDecision: this.history[this.history.length - 1],
      averageReplicas: Math.round(averageReplicas * 100) / 100,
    };
  }
}
