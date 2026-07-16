export type DNAMode = 'conversational' | 'transactional' | 'hybrid';

export interface DNARateLimit {
  dnaId: string;
  maxRequests: number;
  windowMs: number;
  mode: DNAMode;
}

export interface PerDNAPolicyConfig {
  modeLimits: Record<DNAMode, DNARateLimit>;
  dnaOverrides: Map<string, DNARateLimit>;
}

const DEFAULT_MODE_LIMITS: Record<DNAMode, DNARateLimit> = {
  conversational: {
    dnaId: '*',
    maxRequests: 60,
    windowMs: 60_000,
    mode: 'conversational',
  },
  transactional: {
    dnaId: '*',
    maxRequests: 20,
    windowMs: 60_000,
    mode: 'transactional',
  },
  hybrid: {
    dnaId: '*',
    maxRequests: 40,
    windowMs: 60_000,
    mode: 'hybrid',
  },
};

export class PerDNAPolicy {
  private config: PerDNAPolicyConfig;

  constructor(config?: Partial<PerDNAPolicyConfig>) {
    this.config = {
      modeLimits: config?.modeLimits ?? { ...DEFAULT_MODE_LIMITS },
      dnaOverrides: config?.dnaOverrides ?? new Map(),
    };
  }

  getLimitForDNA(dnaId: string, mode: DNAMode): DNARateLimit {
    const override = this.config.dnaOverrides.get(dnaId);
    if (override) return { ...override };

    return { ...this.config.modeLimits[mode] };
  }

  setDNAOverride(dnaId: string, limit: DNARateLimit): void {
    this.config.dnaOverrides.set(dnaId, { ...limit, dnaId });
  }

  removeDNAOverride(dnaId: string): boolean {
    return this.config.dnaOverrides.delete(dnaId);
  }

  updateModeLimit(mode: DNAMode, limit: DNARateLimit): void {
    this.config.modeLimits[mode] = { ...limit };
  }

  getModeLimits(): Record<DNAMode, DNARateLimit> {
    return { ...this.config.modeLimits };
  }

  getDNAOverrides(): Map<string, DNARateLimit> {
    return new Map(this.config.dnaOverrides);
  }
}
