export interface WarningConfig {
  thresholdPercent: number;
  cooldownMs: number;
  maxWarnings: number;
  escalateAfter?: number;
}

export interface WarningEvent {
  id: string;
  timestamp: string;
  targetId: string;
  targetType: 'agent' | 'dna' | 'action';
  utilizationPercent: number;
  message: string;
  consecutiveCount: number;
}

export class WarningEscalation {
  private config: WarningConfig;
  private warnings: WarningEvent[] = [];
  private lastWarning: Map<string, number> = new Map();
  private warningCounts: Map<string, number> = new Map();

  constructor(config?: Partial<WarningConfig>) {
    this.config = {
      thresholdPercent: config?.thresholdPercent ?? 80,
      cooldownMs: config?.cooldownMs ?? 30_000,
      maxWarnings: config?.maxWarnings ?? 5,
      escalateAfter: config?.escalateAfter ?? 3,
    };
  }

  check(
    targetId: string,
    targetType: 'agent' | 'dna' | 'action',
    utilizationPercent: number,
  ): WarningEvent | undefined {
    if (utilizationPercent < this.config.thresholdPercent) {
      this.warningCounts.delete(targetId);
      return undefined;
    }

    const now = Date.now();
    const lastWarn = this.lastWarning.get(targetId) ?? 0;
    if (now - lastWarn < this.config.cooldownMs) return undefined;

    const count = (this.warningCounts.get(targetId) ?? 0) + 1;
    this.warningCounts.set(targetId, count);
    this.lastWarning.set(targetId, now);

    const event: WarningEvent = {
      id: `warn-${targetId}-${now}`,
      timestamp: new Date().toISOString(),
      targetId,
      targetType,
      utilizationPercent,
      message: this.formatMessage(targetId, targetType, utilizationPercent, count),
      consecutiveCount: count,
    };

    this.warnings.push(event);
    return event;
  }

  shouldEscalate(targetId: string): boolean {
    const count = this.warningCounts.get(targetId) ?? 0;
    return this.config.escalateAfter !== undefined && count >= this.config.escalateAfter;
  }

  hasExceededMax(targetId: string): boolean {
    const count = this.warningCounts.get(targetId) ?? 0;
    return count >= this.config.maxWarnings;
  }

  getWarnings(targetId?: string): WarningEvent[] {
    if (targetId) return this.warnings.filter((w) => w.targetId === targetId);
    return [...this.warnings];
  }

  getWarningCount(targetId: string): number {
    return this.warningCounts.get(targetId) ?? 0;
  }

  reset(targetId: string): void {
    this.warningCounts.delete(targetId);
    this.lastWarning.delete(targetId);
  }

  resetAll(): void {
    this.warnings = [];
    this.warningCounts.clear();
    this.lastWarning.clear();
  }

  private formatMessage(
    targetId: string,
    targetType: string,
    utilization: number,
    count: number,
  ): string {
    return `[WARNING] ${targetType} "${targetId}" at ${utilization.toFixed(1)}% capacity (warning #${count})`;
  }
}
