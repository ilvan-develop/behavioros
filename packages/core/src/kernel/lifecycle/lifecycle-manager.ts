import {
  InvalidTransitionError,
  isValidTransition,
  type LifecycleEvent,
  type LifecycleListener,
  type LifecycleState,
  type LifecycleTransition,
} from './types';

export class LifecycleManager {
  private state: LifecycleState = 'draft';
  private history: LifecycleTransition[] = [];
  private listeners = new Map<string, LifecycleListener>();
  private maxHistorySize: number;

  constructor(maxHistorySize = 1000) {
    this.maxHistorySize = maxHistorySize;
  }

  getState(): LifecycleState {
    return this.state;
  }

  getHistory(): LifecycleTransition[] {
    return [...this.history];
  }

  transition(to: LifecycleState, reason?: string): void {
    if (!isValidTransition(this.state, to)) {
      throw new InvalidTransitionError(this.state, to);
    }
    const from = this.state;
    this.state = to;
    const entry: LifecycleTransition = { from, to, timestamp: new Date().toISOString(), reason };
    this.history.push(entry);
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
    this.emit({
      type: 'transition',
      from,
      to,
      current: to,
      timestamp: entry.timestamp,
      metadata: reason ? { reason } : undefined,
    });
  }

  on(id: string, listener: LifecycleListener): void {
    this.listeners.set(id, listener);
  }

  off(id: string): void {
    this.listeners.delete(id);
  }

  reset(): void {
    this.state = 'draft';
    this.history = [];
    this.listeners.clear();
  }

  private emit(event: LifecycleEvent): void {
    for (const listener of this.listeners.values()) {
      listener(event);
    }
  }
}
