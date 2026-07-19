export type ActionType = 'read' | 'write' | 'api' | 'deploy' | 'governance' | 'audit';

export interface ActionRateLimit {
  actionType: ActionType;
  maxRequests: number;
  windowMs: number;
  burstCapacity?: number;
}

export interface PerActionPolicyConfig {
  actionLimits: Record<ActionType, ActionRateLimit>;
  actionAliases: Map<string, ActionType>;
}

const DEFAULT_ACTION_LIMITS: Record<ActionType, ActionRateLimit> = {
  read: {
    actionType: 'read',
    maxRequests: 100,
    windowMs: 60_000,
    burstCapacity: 150,
  },
  write: {
    actionType: 'write',
    maxRequests: 30,
    windowMs: 60_000,
    burstCapacity: 40,
  },
  api: {
    actionType: 'api',
    maxRequests: 50,
    windowMs: 60_000,
    burstCapacity: 60,
  },
  deploy: {
    actionType: 'deploy',
    maxRequests: 5,
    windowMs: 300_000,
    burstCapacity: 8,
  },
  governance: {
    actionType: 'governance',
    maxRequests: 20,
    windowMs: 60_000,
    burstCapacity: 25,
  },
  audit: {
    actionType: 'audit',
    maxRequests: 10,
    windowMs: 60_000,
    burstCapacity: 15,
  },
};

export class PerActionPolicy {
  private config: PerActionPolicyConfig;

  constructor(config?: Partial<PerActionPolicyConfig>) {
    this.config = {
      actionLimits: config?.actionLimits ?? { ...DEFAULT_ACTION_LIMITS },
      actionAliases: config?.actionAliases ?? new Map(),
    };
  }

  getLimitForAction(actionName: string): ActionRateLimit {
    const actionType = this.resolveActionType(actionName);
    return { ...this.config.actionLimits[actionType] };
  }

  resolveActionType(actionName: string): ActionType {
    const alias = this.config.actionAliases.get(actionName);
    if (alias) return alias;

    const normalized = actionName.toLowerCase();
    if (normalized.includes('read') || normalized.includes('get') || normalized.includes('list')) {
      return 'read';
    }
    if (
      normalized.includes('write') ||
      normalized.includes('create') ||
      normalized.includes('update') ||
      normalized.includes('delete')
    ) {
      return 'write';
    }
    if (normalized.includes('deploy') || normalized.includes('release')) {
      return 'deploy';
    }
    if (
      normalized.includes('governance') ||
      normalized.includes('approve') ||
      normalized.includes('escalat')
    ) {
      return 'governance';
    }
    if (
      normalized.includes('audit') ||
      normalized.includes('review') ||
      normalized.includes('validate')
    ) {
      return 'audit';
    }
    if (
      normalized.includes('api') ||
      normalized.includes('call') ||
      normalized.includes('request')
    ) {
      return 'api';
    }

    return 'read';
  }

  setActionAlias(actionName: string, type: ActionType): void {
    this.config.actionAliases.set(actionName, type);
  }

  removeActionAlias(actionName: string): boolean {
    return this.config.actionAliases.delete(actionName);
  }

  updateActionLimit(actionType: ActionType, limit: ActionRateLimit): void {
    this.config.actionLimits[actionType] = { ...limit };
  }

  getActionLimits(): Record<ActionType, ActionRateLimit> {
    return { ...this.config.actionLimits };
  }
}
