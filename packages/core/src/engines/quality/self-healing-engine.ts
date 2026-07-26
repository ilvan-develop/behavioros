import { randomUUID } from 'node:crypto';

// ============================================================
// Types
// ============================================================

/**
 * HealingAction — Configuration and options interface.
 */
export interface HealingAction {
  id: string;
  type: 'auto-fix' | 'rollback' | 'degrade' | 'alert';
  target: string;
  description: string;
  timestamp: string;
  success?: boolean;
}

/**
 * SelfHealingEngineOptions — Configuration and options interface.
 */
export interface SelfHealingEngineOptions {
  enabled?: boolean;
  maxRetries?: number;
  autoFixPatterns?: Map<string, (context: unknown) => Promise<boolean>>;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_MAX_RETRIES = 3;

// ============================================================
// Self-Healing Engine
// ============================================================

/**
 * SelfHealingEngine — ============================================================.
 */
export class SelfHealingEngine {
  private enabled: boolean;
  private maxRetries: number;
  private history: HealingAction[] = [];
  private fixPatterns: Map<string, (context: unknown) => Promise<boolean>>;
  private retryCount: Map<string, number> = new Map();

  constructor(options?: SelfHealingEngineOptions) {
    this.enabled = options?.enabled ?? true;
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fixPatterns = options?.autoFixPatterns ?? new Map();
  }

  // ----------------------------------------------------------
  // Monitor
  // ----------------------------------------------------------

  async monitor(gateResult: {
    gate: string;
    passed: boolean;
    error?: string;
    details?: Record<string, unknown>;
  }): Promise<HealingAction | null> {
    if (!this.enabled) return null;
    if (gateResult.passed) return null;

    const currentRetries = this.retryCount.get(gateResult.gate) ?? 0;

    if (currentRetries >= this.maxRetries) {
      const action = this.recordAction({
        type: 'alert',
        target: gateResult.gate,
        description: `Max retries (${this.maxRetries}) exceeded for gate: ${gateResult.gate}. Escalating.`,
        success: undefined,
      });
      this.retryCount.delete(gateResult.gate);
      return action;
    }

    const hasFixPattern = this.fixPatterns.has(gateResult.gate);
    if (hasFixPattern) {
      this.retryCount.set(gateResult.gate, currentRetries + 1);
      const success = await this.autoFix(gateResult.gate, gateResult);
      const action = this.recordAction({
        type: 'auto-fix',
        target: gateResult.gate,
        description: `Auto-fix attempt ${currentRetries + 1}/${this.maxRetries} for: ${gateResult.error ?? gateResult.gate}`,
        success,
      });
      return action;
    }

    const action = this.recordAction({
      type: 'alert',
      target: gateResult.gate,
      description: `No auto-fix pattern registered for gate: ${gateResult.gate}. Manual intervention required.`,
      success: undefined,
    });
    return action;
  }

  // ----------------------------------------------------------
  // Auto-fix
  // ----------------------------------------------------------

  async autoFix(pattern: string, context: unknown): Promise<boolean> {
    const handler = this.fixPatterns.get(pattern);
    if (!handler) return false;

    try {
      return await handler(context);
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // Rollback
  // ----------------------------------------------------------

  async rollback(checkpointId: string): Promise<boolean> {
    if (!checkpointId) return false;

    const action = this.recordAction({
      type: 'rollback',
      target: checkpointId,
      description: `Rollback to checkpoint: ${checkpointId}`,
      success: true,
    });

    return action.success ?? false;
  }

  // ----------------------------------------------------------
  // History & Stats
  // ----------------------------------------------------------

  async getHistory(): Promise<HealingAction[]> {
    return [...this.history];
  }

  async getStats(): Promise<{
    totalAttempts: number;
    successful: number;
    failed: number;
    byType: Record<string, number>;
  }> {
    const totalAttempts = this.history.length;
    const successful = this.history.filter((a) => a.success === true).length;
    const failed = this.history.filter((a) => a.success === false).length;

    const byType: Record<string, number> = {};
    for (const action of this.history) {
      byType[action.type] = (byType[action.type] ?? 0) + 1;
    }

    return { totalAttempts, successful, failed, byType };
  }

  // ----------------------------------------------------------
  // Pattern registration
  // ----------------------------------------------------------

  registerFixPattern(pattern: string, handler: (context: unknown) => Promise<boolean>): void {
    this.fixPatterns.set(pattern, handler);
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private recordAction(data: Omit<HealingAction, 'id' | 'timestamp'>): HealingAction {
    const action: HealingAction = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...data,
    };
    this.history.push(action);
    return action;
  }
}
