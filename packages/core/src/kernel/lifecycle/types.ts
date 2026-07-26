export type LifecycleState =
  | 'draft'
  | 'initialized'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface LifecycleTransition {
  from: LifecycleState;
  to: LifecycleState;
  timestamp: string;
  reason?: string;
}

export interface LifecycleEvent {
  type: 'transition' | 'error';
  from?: LifecycleState;
  to?: LifecycleState;
  current: LifecycleState;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type LifecycleListener = (event: LifecycleEvent) => void;

export class InvalidTransitionError extends Error {
  constructor(from: LifecycleState, to: LifecycleState) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  draft: ['initialized'],
  initialized: ['starting'],
  starting: ['running', 'error'],
  running: ['stopping', 'error'],
  stopping: ['stopped', 'error'],
  stopped: ['initialized'],
  error: ['stopped'],
};

export function isValidTransition(from: LifecycleState, to: LifecycleState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
