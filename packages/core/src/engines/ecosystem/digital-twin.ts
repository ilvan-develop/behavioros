/**
 * TwinState — Configuration and options interface.
 */
export interface TwinState {
  id: string;
  entityId: string;
  snapshot: Record<string, unknown>;
  timestamp: string;
  version: number;
}

/**
 * SimulationConfig — Configuration and options interface.
 */
export interface SimulationConfig {
  id: string;
  name: string;
  steps: number;
  interval: number;
  initialState: Record<string, unknown>;
  rules: { name: string; condition: string; action: string }[];
}

/**
 * SimulationResult — Configuration and options interface.
 */
export interface SimulationResult {
  id: string;
  configId: string;
  steps: { step: number; state: Record<string, unknown>; timestamp: string }[];
  startedAt: string;
  completedAt: string;
  summary: Record<string, unknown>;
}

/**
 * Forecast — Configuration and options interface.
 */
export interface Forecast {
  id: string;
  metric: string;
  currentValue: number;
  predictedValues: { period: string; value: number }[];
  confidence: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * ChaosExperiment — Configuration and options interface.
 */
export interface ChaosExperiment {
  id: string;
  name: string;
  faultType: 'latency' | 'error' | 'crash' | 'resource-exhaustion';
  target: string;
  intensity: number;
  duration: number;
  active: boolean;
}

/**
 * DigitalTwin — digital twin.
 *
 * Methods: createTwin, updateTwin, getTwin, sync, runSimulation, forecast, injectChaos, stopChaos, +2 more.
 */
export class DigitalTwin {
  private twins = new Map<string, TwinState>();
  private experiments = new Map<string, ChaosExperiment>();
  private chaosTimers = new Map<string, ReturnType<typeof setTimeout>>();

  createTwin(entityId: string, initialState?: Record<string, unknown>): string {
    const id = `twin-${entityId}-${Date.now()}`;
    const twin: TwinState = {
      id,
      entityId,
      snapshot: initialState ?? {},
      timestamp: new Date().toISOString(),
      version: 1,
    };
    this.twins.set(id, twin);
    return id;
  }

  updateTwin(id: string, state: Record<string, unknown>): void {
    const twin = this.twins.get(id);
    if (!twin) throw new Error(`Twin ${id} not found`);
    twin.snapshot = { ...twin.snapshot, ...state };
    twin.timestamp = new Date().toISOString();
    twin.version++;
  }

  getTwin(id: string): TwinState | undefined {
    return this.twins.get(id);
  }

  sync(liveState: Record<string, unknown>): { twinId: string; drift: number } {
    const entityId = (liveState.entityId as string) ?? 'unknown';
    const existing = Array.from(this.twins.values()).find((t) => t.entityId === entityId);

    let twinId: string;
    let drift = 0;

    if (existing) {
      drift = this.computeDrift(existing.snapshot, liveState);
      this.updateTwin(existing.id, liveState);
      twinId = existing.id;
    } else {
      twinId = this.createTwin(entityId, liveState);
    }

    return { twinId, drift };
  }

  async runSimulation(config: SimulationConfig): Promise<SimulationResult> {
    const resultId = `sim-${config.id}-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const steps: SimulationResult['steps'] = [];
    let state = { ...config.initialState };

    for (let i = 0; i < config.steps; i++) {
      await this.delay(config.interval);
      state = this.applyRules(state, config.rules, i);
      steps.push({ step: i + 1, state: { ...state }, timestamp: new Date().toISOString() });
    }

    const completedAt = new Date().toISOString();
    const lastState = steps[steps.length - 1]?.state ?? {};
    const summary: Record<string, unknown> = {
      finalState: lastState,
      totalSteps: config.steps,
    };

    return {
      id: resultId,
      configId: config.id,
      steps,
      startedAt,
      completedAt,
      summary,
    };
  }

  forecast(metric: string, history: number[], periods: number): Forecast {
    if (history.length < 2) {
      return {
        id: `forecast-${metric}-${Date.now()}`,
        metric,
        currentValue: history[0] ?? 0,
        predictedValues: Array.from({ length: periods }, (_, i) => ({
          period: `t+${i + 1}`,
          value: history[0] ?? 0,
        })),
        confidence: 0.3,
        trend: 'stable',
      };
    }

    const currentValue = history[history.length - 1];
    const n = history.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = history.reduce((a, b) => a + b, 0);
    const sumXY = history.reduce((a, v, i) => a + i * v, 0);
    const sumX2 = history.reduce((a, _, i) => a + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predictedValues = Array.from({ length: periods }, (_, i) => ({
      period: `t+${i + 1}`,
      value: Math.round((intercept + slope * (n + i)) * 100) / 100,
    }));

    const trend: 'up' | 'down' | 'stable' = slope > 0.01 ? 'up' : slope < -0.01 ? 'down' : 'stable';

    const residuals = history.map((v, i) => Math.abs(v - (intercept + slope * i)));
    const mae = residuals.reduce((a, b) => a + b, 0) / n;
    const maxVal = Math.max(...history, 1);
    const confidence = Math.max(0, Math.min(1, 1 - mae / maxVal));

    return {
      id: `forecast-${metric}-${Date.now()}`,
      metric,
      currentValue,
      predictedValues,
      confidence: Math.round(confidence * 100) / 100,
      trend,
    };
  }

  async injectChaos(experiment: ChaosExperiment): Promise<void> {
    if (this.experiments.has(experiment.id)) {
      throw new Error(`Experiment ${experiment.id} already active`);
    }
    this.experiments.set(experiment.id, { ...experiment, active: true });

    const timer = setTimeout(() => {
      this.stopChaos(experiment.id);
    }, experiment.duration);
    this.chaosTimers.set(experiment.id, timer);
  }

  stopChaos(experimentId: string): void {
    const exp = this.experiments.get(experimentId);
    if (exp) {
      exp.active = false;
    }
    const timer = this.chaosTimers.get(experimentId);
    if (timer) {
      clearTimeout(timer);
      this.chaosTimers.delete(experimentId);
    }
  }

  getActiveChaos(): ChaosExperiment[] {
    return Array.from(this.experiments.values()).filter((e) => e.active);
  }

  private computeDrift(twin: Record<string, unknown>, live: Record<string, unknown>): number {
    const keys = new Set([...Object.keys(twin), ...Object.keys(live)]);
    let diffSum = 0;
    let count = 0;

    for (const key of keys) {
      if (key === 'entityId') continue;
      const tv = twin[key];
      const lv = live[key];
      if (typeof tv === 'number' && typeof lv === 'number') {
        diffSum += Math.abs(tv - lv);
        count++;
      } else if (tv !== lv) {
        diffSum += 1;
        count++;
      }
    }

    return count > 0 ? Math.round((diffSum / count) * 100) / 100 : 0;
  }

  private applyRules(
    state: Record<string, unknown>,
    rules: SimulationConfig['rules'],
    step: number,
  ): Record<string, unknown> {
    const newState = { ...state };
    for (const rule of rules) {
      const conditionMet = this.evaluateCondition(rule.condition, newState, step);
      if (conditionMet) {
        this.executeAction(rule.action, newState, step);
      }
    }
    return newState;
  }

  private evaluateCondition(
    condition: string,
    state: Record<string, unknown>,
    _step: number,
  ): boolean {
    const [field, op, rawValue] = condition.split(' ');
    const current = state[field];
    if (current === undefined) return false;
    const value = Number(rawValue);
    if (Number.isNaN(value)) return false;
    switch (op) {
      case '>':
        return Number(current) > value;
      case '<':
        return Number(current) < value;
      case '>=':
        return Number(current) >= value;
      case '<=':
        return Number(current) <= value;
      case '==':
        return Number(current) === value;
      default:
        return false;
    }
  }

  private executeAction(action: string, state: Record<string, unknown>, _step: number): void {
    const [field, op, rawValue] = action.split(' ');
    if (op === '=') {
      state[field] = Number(rawValue);
    } else if (op === '+=') {
      state[field] = (Number(state[field]) || 0) + Number(rawValue);
    } else if (op === '-=') {
      state[field] = (Number(state[field]) || 0) - Number(rawValue);
    }
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
