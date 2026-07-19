export interface BlockConfig {
  thresholdPercent: number;
  blockDurationMs: number;
  maxBlockDurationMs: number;
  cooldownMs: number;
  allowOverride: boolean;
}

export interface BlockEvent {
  id: string;
  timestamp: string;
  targetId: string;
  targetType: 'agent' | 'dna' | 'action';
  reason: string;
  expiresAt: string;
  utilizationPercent: number;
}

export interface BlockResult {
  blocked: boolean;
  reason: string;
  expiresAt?: string;
  remainingMs?: number;
}

export class BlockEscalation {
  private config: BlockConfig;
  private blocks: Map<string, BlockEvent> = new Map();
  private blockHistory: BlockEvent[] = [];

  constructor(config?: Partial<BlockConfig>) {
    this.config = {
      thresholdPercent: config?.thresholdPercent ?? 100,
      blockDurationMs: config?.blockDurationMs ?? 60_000,
      maxBlockDurationMs: config?.maxBlockDurationMs ?? 300_000,
      cooldownMs: config?.cooldownMs ?? 10_000,
      allowOverride: config?.allowOverride ?? false,
    };
  }

  check(targetId: string, utilizationPercent: number): BlockResult {
    const existing = this.blocks.get(targetId);
    if (existing) {
      const expiresAt = new Date(existing.expiresAt).getTime();
      if (Date.now() < expiresAt) {
        return {
          blocked: true,
          reason: existing.reason,
          expiresAt: existing.expiresAt,
          remainingMs: expiresAt - Date.now(),
        };
      }
      this.blocks.delete(targetId);
    }

    if (utilizationPercent < this.config.thresholdPercent) {
      return {
        blocked: false,
        reason: `Utilization ${utilizationPercent.toFixed(1)}% within acceptable range`,
      };
    }

    return this.applyBlock(targetId, 'agent', utilizationPercent);
  }

  private applyBlock(
    targetId: string,
    targetType: 'agent' | 'dna' | 'action',
    utilizationPercent: number,
  ): BlockResult {
    const previousBlocks = this.blockHistory.filter((b) => b.targetId === targetId).length;
    const durationMultiplier = Math.min(
      2 ** previousBlocks,
      this.config.maxBlockDurationMs / this.config.blockDurationMs,
    );
    const duration = Math.min(
      this.config.blockDurationMs * durationMultiplier,
      this.config.maxBlockDurationMs,
    );

    const event: BlockEvent = {
      id: `block-${targetId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      targetId,
      targetType,
      reason: `Blocked "${targetId}" — utilization ${utilizationPercent.toFixed(1)}% reached ${this.config.thresholdPercent}% threshold (duration: ${duration}ms, attempt #${previousBlocks + 1})`,
      expiresAt: new Date(Date.now() + duration).toISOString(),
      utilizationPercent,
    };

    this.blocks.set(targetId, event);
    this.blockHistory.push(event);

    return {
      blocked: true,
      reason: event.reason,
      expiresAt: event.expiresAt,
      remainingMs: duration,
    };
  }

  isBlocked(targetId: string): boolean {
    const block = this.blocks.get(targetId);
    if (!block) return false;

    if (Date.now() >= new Date(block.expiresAt).getTime()) {
      this.blocks.delete(targetId);
      return false;
    }

    return true;
  }

  getBlockRemaining(targetId: string): number {
    const block = this.blocks.get(targetId);
    if (!block) return 0;

    const expiresAt = new Date(block.expiresAt).getTime();
    return Math.max(0, expiresAt - Date.now());
  }

  overrideBlock(targetId: string): boolean {
    if (!this.config.allowOverride) return false;
    return this.blocks.delete(targetId);
  }

  forceBlock(
    targetId: string,
    targetType: 'agent' | 'dna' | 'action',
    durationMs?: number,
  ): BlockResult {
    const duration = durationMs ?? this.config.blockDurationMs;
    const event: BlockEvent = {
      id: `block-forced-${targetId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      targetId,
      targetType,
      reason: `Forced block on "${targetId}" (duration: ${duration}ms)`,
      expiresAt: new Date(Date.now() + duration).toISOString(),
      utilizationPercent: 100,
    };

    this.blocks.set(targetId, event);
    this.blockHistory.push(event);

    return {
      blocked: true,
      reason: event.reason,
      expiresAt: event.expiresAt,
      remainingMs: duration,
    };
  }

  getActiveBlocks(): BlockEvent[] {
    const now = Date.now();
    for (const [id, block] of this.blocks) {
      if (now >= new Date(block.expiresAt).getTime()) {
        this.blocks.delete(id);
      }
    }
    return Array.from(this.blocks.values());
  }

  getBlockHistory(): BlockEvent[] {
    return [...this.blockHistory];
  }

  reset(targetId: string): void {
    this.blocks.delete(targetId);
  }

  resetAll(): void {
    this.blocks.clear();
  }
}
