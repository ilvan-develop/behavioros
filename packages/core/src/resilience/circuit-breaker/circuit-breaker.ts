import EventEmitter from 'eventemitter3';
import { ClosedState, type ClosedStateConfig } from './states/closed';
import { HalfOpenState, type HalfOpenStateConfig } from './states/half-open';
import { OpenState, type OpenStateConfig } from './states/open';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  halfOpenMaxAttempts: number;
  successThreshold: number;
  monitoringWindowMs: number;
  halfOpen: Partial<HalfOpenStateConfig>;
  open: Partial<OpenStateConfig>;
  closed: Partial<ClosedStateConfig>;
}

export interface CircuitBreakerStats {
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
  totalRejected: number;
  consecutiveFailures: number;
  lastFailureTime: string | null;
  lastSuccessTime: string | null;
  stateChanges: number;
  currentState: CircuitState;
  uptimeMs: number;
}

export interface CircuitBreakerEvents {
  'state-change': (from: CircuitState, to: CircuitState, reason: string) => void;
  'request-allowed': (requestId: string) => void;
  'request-rejected': (requestId: string, reason: string) => void;
  'failure-recorded': (requestId: string, error: Error) => void;
  'success-recorded': (requestId: string) => void;
  'half-open-test': (requestId: string) => void;
}

export interface CircuitRequest {
  id: string;
  action: string;
  agentId?: string;
  timestamp: string;
}

export interface CircuitResult {
  allowed: boolean;
  reason: string;
  state: CircuitState;
  requestId: string;
  retryAfterMs?: number;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: ClosedState | OpenState | HalfOpenState;
  private currentState: CircuitState = 'closed';
  private emitter = new EventEmitter();
  private stats: CircuitBreakerStats;
  private createdAt: number;
  private stateHistory: Array<{
    from: CircuitState;
    to: CircuitState;
    reason: string;
    timestamp: string;
  }> = [];

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      recoveryTimeoutMs: config?.recoveryTimeoutMs ?? 30_000,
      halfOpenMaxAttempts: config?.halfOpenMaxAttempts ?? 3,
      successThreshold: config?.successThreshold ?? 2,
      monitoringWindowMs: config?.monitoringWindowMs ?? 60_000,
      halfOpen: config?.halfOpen ?? {},
      open: config?.open ?? {},
      closed: config?.closed ?? {},
    };

    this.createdAt = Date.now();
    this.stats = {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalRejected: 0,
      consecutiveFailures: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      stateChanges: 0,
      currentState: 'closed',
      uptimeMs: 0,
    };

    this.state = new ClosedState(this.config.failureThreshold, this.config.closed);
    this.currentState = 'closed';
  }

  check(request: CircuitRequest): CircuitResult {
    this.updateStats();
    const result = this.state.check(request);

    if (result.allowed) {
      this.stats.totalRequests++;
      this.emitter.emit('request-allowed', request.id);
    } else {
      this.stats.totalRejected++;
      this.emitter.emit('request-rejected', request.id, result.reason);
    }

    return result;
  }

  recordSuccess(requestId: string): void {
    this.stats.totalSuccesses++;
    this.stats.lastSuccessTime = new Date().toISOString();
    this.stats.consecutiveFailures = 0;

    const transition = this.state.onSuccess(requestId);
    this.emitter.emit('success-recorded', requestId);

    if (transition) {
      this.transitionTo(transition.to, transition.reason);
    }
  }

  recordFailure(requestId: string, error: Error): void {
    this.stats.totalFailures++;
    this.stats.lastFailureTime = new Date().toISOString();
    this.stats.consecutiveFailures++;

    const transition = this.state.onFailure(requestId, error);
    this.emitter.emit('failure-recorded', requestId, error);

    if (transition) {
      this.transitionTo(transition.to, transition.reason);
    }
  }

  private transitionTo(newState: CircuitState, reason: string): void {
    const from = this.currentState;
    if (from === newState) return;

    this.stateHistory.push({
      from,
      to: newState,
      reason,
      timestamp: new Date().toISOString(),
    });

    this.stats.stateChanges++;
    this.currentState = newState;
    this.stats.currentState = newState;

    switch (newState) {
      case 'closed':
        this.state = new ClosedState(this.config.failureThreshold, this.config.closed);
        break;
      case 'open':
        this.state = new OpenState(
          this.config.recoveryTimeoutMs,
          this.config.halfOpenMaxAttempts,
          this.config.open,
        );
        break;
      case 'half-open':
        this.state = new HalfOpenState(
          this.config.halfOpenMaxAttempts,
          this.config.successThreshold,
          this.config.halfOpen,
        );
        break;
    }

    this.emitter.emit('state-change', from, newState, reason);
  }

  private updateStats(): void {
    this.stats.uptimeMs = Date.now() - this.createdAt;
  }

  on<K extends keyof CircuitBreakerEvents>(event: K, listener: CircuitBreakerEvents[K]): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof CircuitBreakerEvents>(event: K, listener: CircuitBreakerEvents[K]): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  getState(): CircuitState {
    return this.currentState;
  }

  getStats(): CircuitBreakerStats {
    this.updateStats();
    return { ...this.stats };
  }

  getStateHistory(): Array<{
    from: CircuitState;
    to: CircuitState;
    reason: string;
    timestamp: string;
  }> {
    return [...this.stateHistory];
  }

  reset(): void {
    this.transitionTo('closed', 'Manual reset');
    this.stats.consecutiveFailures = 0;
    this.stats.totalRejected = 0;
  }

  forceOpen(reason?: string): void {
    this.transitionTo('open', reason ?? 'Forced open');
  }

  forceHalfOpen(): void {
    this.transitionTo('half-open', 'Forced half-open');
  }

  isAvailable(): boolean {
    return this.state.isAvailable();
  }

  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }
}
