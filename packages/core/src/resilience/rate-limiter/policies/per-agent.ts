export type AuthorityLevel =
  | 'junior'
  | 'senior'
  | 'architect'
  | 'lead'
  | 'director'
  | 'vp'
  | 'c-level';

export interface AgentRateLimit {
  agentId: string;
  maxRequests: number;
  windowMs: number;
  burstCapacity?: number;
  refillRate?: number;
}

export interface PerAgentPolicyConfig {
  defaultLimits: Record<AuthorityLevel, AgentRateLimit>;
  customLimits: Map<string, AgentRateLimit>;
  fallbackPolicy: 'block' | 'throttle' | 'allow';
}

const DEFAULT_AUTHORITY_LIMITS: Record<AuthorityLevel, AgentRateLimit> = {
  junior: {
    agentId: '*',
    maxRequests: 10,
    windowMs: 60_000,
    burstCapacity: 15,
    refillRate: 2,
  },
  senior: {
    agentId: '*',
    maxRequests: 30,
    windowMs: 60_000,
    burstCapacity: 40,
    refillRate: 5,
  },
  architect: {
    agentId: '*',
    maxRequests: 50,
    windowMs: 60_000,
    burstCapacity: 70,
    refillRate: 8,
  },
  lead: {
    agentId: '*',
    maxRequests: 80,
    windowMs: 60_000,
    burstCapacity: 100,
    refillRate: 12,
  },
  director: {
    agentId: '*',
    maxRequests: 120,
    windowMs: 60_000,
    burstCapacity: 150,
    refillRate: 20,
  },
  vp: {
    agentId: '*',
    maxRequests: 200,
    windowMs: 60_000,
    burstCapacity: 250,
    refillRate: 30,
  },
  'c-level': {
    agentId: '*',
    maxRequests: 500,
    windowMs: 60_000,
    burstCapacity: 600,
    refillRate: 50,
  },
};

export class PerAgentPolicy {
  private config: PerAgentPolicyConfig;

  constructor(config?: Partial<PerAgentPolicyConfig>) {
    this.config = {
      defaultLimits: config?.defaultLimits ?? { ...DEFAULT_AUTHORITY_LIMITS },
      customLimits: config?.customLimits ?? new Map(),
      fallbackPolicy: config?.fallbackPolicy ?? 'throttle',
    };
  }

  getLimitForAgent(agentId: string, authority: AuthorityLevel): AgentRateLimit {
    const custom = this.config.customLimits.get(agentId);
    if (custom) return { ...custom };

    return { ...this.config.defaultLimits[authority] };
  }

  setCustomLimit(agentId: string, limit: AgentRateLimit): void {
    this.config.customLimits.set(agentId, { ...limit, agentId });
  }

  removeCustomLimit(agentId: string): boolean {
    return this.config.customLimits.delete(agentId);
  }

  getFallbackPolicy(): 'block' | 'throttle' | 'allow' {
    return this.config.fallbackPolicy;
  }

  getDefaultLimits(): Record<AuthorityLevel, AgentRateLimit> {
    return { ...this.config.defaultLimits };
  }

  updateDefaultLimit(authority: AuthorityLevel, limit: AgentRateLimit): void {
    this.config.defaultLimits[authority] = { ...limit };
  }

  getCustomLimits(): Map<string, AgentRateLimit> {
    return new Map(this.config.customLimits);
  }
}
