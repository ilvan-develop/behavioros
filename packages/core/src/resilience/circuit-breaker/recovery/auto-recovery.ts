export interface AutoRecoveryConfig {
  initialRecoveryPercentage: number;
  recoveryStepPercentage: number;
  recoveryIntervalMs: number;
  maxRecoveryAttempts: number;
  healthCheckEnabled: boolean;
  healthCheckIntervalMs: number;
  healthCheckTimeoutMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface RecoveryState {
  active: boolean;
  currentStep: number;
  totalSteps: number;
  trafficPercentage: number;
  lastStepAt: string;
  nextStepAt: string;
  healthCheckPassing: boolean;
  attempts: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  timestamp: string;
  details: string;
}

type HealthCheckFn = () => Promise<HealthCheckResult>;

export class AutoRecovery {
  private config: AutoRecoveryConfig;
  private state: RecoveryState;
  private healthCheckFn: HealthCheckFn | null = null;
  private stepTimer: ReturnType<typeof setInterval> | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private onStepCallback: ((trafficPercentage: number) => void) | null = null;
  private onRecoveryCompleteCallback: (() => void) | null = null;
  private onRecoveryFailedCallback: ((reason: string) => void) | null = null;

  constructor(config?: Partial<AutoRecoveryConfig>) {
    this.config = {
      initialRecoveryPercentage: config?.initialRecoveryPercentage ?? 10,
      recoveryStepPercentage: config?.recoveryStepPercentage ?? 10,
      recoveryIntervalMs: config?.recoveryIntervalMs ?? 10_000,
      maxRecoveryAttempts: config?.maxRecoveryAttempts ?? 10,
      healthCheckEnabled: config?.healthCheckEnabled ?? true,
      healthCheckIntervalMs: config?.healthCheckIntervalMs ?? 5_000,
      healthCheckTimeoutMs: config?.healthCheckTimeoutMs ?? 3_000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      maxBackoffMs: config?.maxBackoffMs ?? 60_000,
    };

    this.state = {
      active: false,
      currentStep: 0,
      totalSteps: Math.ceil(
        (100 - this.config.initialRecoveryPercentage) / this.config.recoveryStepPercentage,
      ),
      trafficPercentage: 0,
      lastStepAt: '',
      nextStepAt: '',
      healthCheckPassing: true,
      attempts: 0,
    };
  }

  setHealthCheck(fn: HealthCheckFn): void {
    this.healthCheckFn = fn;
  }

  onStep(callback: (trafficPercentage: number) => void): void {
    this.onStepCallback = callback;
  }

  onRecoveryComplete(callback: () => void): void {
    this.onRecoveryCompleteCallback = callback;
  }

  onRecoveryFailed(callback: (reason: string) => void): void {
    this.onRecoveryFailedCallback = callback;
  }

  start(): void {
    if (this.state.active) return;

    this.state.active = true;
    this.state.currentStep = 0;
    this.state.trafficPercentage = this.config.initialRecoveryPercentage;
    this.state.attempts++;
    this.state.lastStepAt = new Date().toISOString();
    this.state.nextStepAt = new Date(Date.now() + this.config.recoveryIntervalMs).toISOString();

    if (this.config.healthCheckEnabled && this.healthCheckFn) {
      this.startHealthChecks();
    }

    this.scheduleNextStep();
    this.onStepCallback?.(this.state.trafficPercentage);
  }

  stop(): void {
    this.state.active = false;
    this.clearTimers();
  }

  reset(): void {
    this.stop();
    this.state = {
      active: false,
      currentStep: 0,
      totalSteps: Math.ceil(
        (100 - this.config.initialRecoveryPercentage) / this.config.recoveryStepPercentage,
      ),
      trafficPercentage: 0,
      lastStepAt: '',
      nextStepAt: '',
      healthCheckPassing: true,
      attempts: 0,
    };
  }

  getState(): RecoveryState {
    return { ...this.state };
  }

  getTrafficPercentage(): number {
    return this.state.trafficPercentage;
  }

  private scheduleNextStep(): void {
    this.clearTimers();

    const backoffMs = Math.min(
      this.config.recoveryIntervalMs * this.config.backoffMultiplier ** this.state.currentStep,
      this.config.maxBackoffMs,
    );

    this.stepTimer = setTimeout(() => {
      this.advanceStep();
    }, backoffMs);
  }

  private advanceStep(): void {
    if (!this.state.active) return;

    this.state.currentStep++;
    this.state.lastStepAt = new Date().toISOString();

    if (this.state.currentStep >= this.state.totalSteps) {
      this.state.trafficPercentage = 100;
      this.state.active = false;
      this.clearTimers();
      this.onStepCallback?.(100);
      this.onRecoveryCompleteCallback?.();
      return;
    }

    const nextPercentage = Math.min(
      this.state.trafficPercentage + this.config.recoveryStepPercentage,
      100,
    );

    if (this.state.healthCheckPassing || !this.config.healthCheckEnabled) {
      this.state.trafficPercentage = nextPercentage;
      this.state.nextStepAt = new Date(Date.now() + this.config.recoveryIntervalMs).toISOString();
      this.onStepCallback?.(this.state.trafficPercentage);
      this.scheduleNextStep();
    } else {
      this.state.active = false;
      this.clearTimers();
      this.onRecoveryFailedCallback?.(
        `Health check failing at ${this.state.trafficPercentage}% traffic`,
      );
    }
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      if (!this.healthCheckFn || !this.state.active) return;

      try {
        const result = await Promise.race([
          this.healthCheckFn(),
          new Promise<HealthCheckResult>((_, reject) =>
            setTimeout(
              () => reject(new Error('Health check timeout')),
              this.config.healthCheckTimeoutMs,
            ),
          ),
        ]);

        this.state.healthCheckPassing = result.healthy;
      } catch {
        this.state.healthCheckPassing = false;
      }
    }, this.config.healthCheckIntervalMs);
  }

  private clearTimers(): void {
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}
