export interface ManualRecoveryConfig {
  requireConfirmation: boolean;
  allowForceReset: boolean;
  logAllActions: boolean;
  cooldownMs: number;
}

export interface RecoveryAction {
  id: string;
  type: 'force-reset' | 'force-half-open' | 'force-open' | 'manual-recovery';
  performedBy: string;
  timestamp: string;
  reason: string;
  previousState: string;
  newState: string;
}

export class ManualRecovery {
  private config: ManualRecoveryConfig;
  private actionHistory: RecoveryAction[] = [];
  private lastActionTime = 0;
  private onActionCallback: ((action: RecoveryAction) => void) | null = null;

  constructor(config?: Partial<ManualRecoveryConfig>) {
    this.config = {
      requireConfirmation: config?.requireConfirmation ?? false,
      allowForceReset: config?.allowForceReset ?? true,
      logAllActions: config?.logAllActions ?? true,
      cooldownMs: config?.cooldownMs ?? 5_000,
    };
  }

  onAction(callback: (action: RecoveryAction) => void): void {
    this.onActionCallback = callback;
  }

  forceReset(performedBy: string, reason: string, currentState: string): RecoveryAction | null {
    if (!this.config.allowForceReset) {
      return null;
    }

    if (!this.checkCooldown()) {
      return null;
    }

    const action: RecoveryAction = {
      id: `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'force-reset',
      performedBy,
      timestamp: new Date().toISOString(),
      reason,
      previousState: currentState,
      newState: 'closed',
    };

    this.recordAction(action);
    return action;
  }

  forceHalfOpen(performedBy: string, reason: string, currentState: string): RecoveryAction | null {
    if (!this.checkCooldown()) {
      return null;
    }

    const action: RecoveryAction = {
      id: `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'force-half-open',
      performedBy,
      timestamp: new Date().toISOString(),
      reason,
      previousState: currentState,
      newState: 'half-open',
    };

    this.recordAction(action);
    return action;
  }

  forceOpen(performedBy: string, reason: string, currentState: string): RecoveryAction | null {
    if (!this.checkCooldown()) {
      return null;
    }

    const action: RecoveryAction = {
      id: `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'force-open',
      performedBy,
      timestamp: new Date().toISOString(),
      reason,
      previousState: currentState,
      newState: 'open',
    };

    this.recordAction(action);
    return action;
  }

  manualRecovery(
    performedBy: string,
    reason: string,
    currentState: string,
    targetState: 'closed' | 'half-open',
  ): RecoveryAction | null {
    if (!this.checkCooldown()) {
      return null;
    }

    const action: RecoveryAction = {
      id: `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'manual-recovery',
      performedBy,
      timestamp: new Date().toISOString(),
      reason,
      previousState: currentState,
      newState: targetState,
    };

    this.recordAction(action);
    return action;
  }

  private checkCooldown(): boolean {
    const now = Date.now();
    if (now - this.lastActionTime < this.config.cooldownMs) {
      return false;
    }
    return true;
  }

  private recordAction(action: RecoveryAction): void {
    this.lastActionTime = Date.now();

    if (this.config.logAllActions) {
      this.actionHistory.push(action);
    }

    this.onActionCallback?.(action);
  }

  getHistory(): RecoveryAction[] {
    return [...this.actionHistory];
  }

  getLastAction(): RecoveryAction | null {
    return this.actionHistory.length > 0 ? this.actionHistory[this.actionHistory.length - 1] : null;
  }

  clearHistory(): void {
    this.actionHistory = [];
  }
}
