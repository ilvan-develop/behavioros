import { LifecycleManager } from './lifecycle-manager';
import type { LifecycleState } from './types';

type LifecycleHook = () => Promise<void>;

export interface KernelHealth {
  state: LifecycleState;
  uptime: number;
  lastTransition: string | null;
  activeEngines: number;
}

export class KernelLifecycle {
  private manager: LifecycleManager;
  private beforeStartHooks: LifecycleHook[] = [];
  private afterStartHooks: LifecycleHook[] = [];
  private beforeStopHooks: LifecycleHook[] = [];
  private afterStopHooks: LifecycleHook[] = [];
  private startTime: number = 0;

  constructor() {
    this.manager = new LifecycleManager();
  }

  getState(): LifecycleState {
    return this.manager.getState();
  }

  onBeforeStart(hook: LifecycleHook): void {
    this.beforeStartHooks.push(hook);
  }

  onAfterStart(hook: LifecycleHook): void {
    this.afterStartHooks.push(hook);
  }

  onBeforeStop(hook: LifecycleHook): void {
    this.beforeStopHooks.push(hook);
  }

  onAfterStop(hook: LifecycleHook): void {
    this.afterStopHooks.push(hook);
  }

  async initialize(): Promise<void> {
    this.manager.transition('initialized');
  }

  async start(): Promise<void> {
    this.manager.transition('starting');
    try {
      for (const hook of this.beforeStartHooks) {
        await hook();
      }
      this.startTime = Date.now();
      this.manager.transition('running');
      for (const hook of this.afterStartHooks) {
        await hook();
      }
    } catch (err) {
      this.manager.transition('error', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.manager.transition('stopping');
    try {
      for (const hook of this.beforeStopHooks) {
        await hook();
      }
      this.manager.transition('stopped');
      for (const hook of this.afterStopHooks) {
        await hook();
      }
    } catch (err) {
      this.manager.transition('error', err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async restart(): Promise<void> {
    if (this.manager.getState() === 'stopped') {
      await this.initialize();
      await this.start();
    } else {
      await this.stop();
      await this.initialize();
      await this.start();
    }
  }

  getHealth(): KernelHealth {
    const history = this.manager.getHistory();
    const lastTransition = history.length > 0 ? history[history.length - 1].timestamp : null;
    const uptime = this.manager.getState() === 'running' ? Date.now() - this.startTime : 0;
    return {
      state: this.manager.getState(),
      uptime,
      lastTransition,
      activeEngines: this.beforeStartHooks.length + this.afterStartHooks.length,
    };
  }
}
