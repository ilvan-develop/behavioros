import { ParallelExecutor } from './parallel-executor';
import { ResourceManager } from './resource-manager';
import { RetryManager } from './retry-manager';
import { SagaManager } from './saga-manager';
import { Scheduler } from './scheduler';
import { TimeoutManager } from './timeout-manager';
import { WorkflowEngine } from './workflow-engine';

/**
 * RuntimeOptions — Configuration and options interface.
 */
export interface RuntimeOptions {
  maxConcurrency?: number;
  defaultTimeout?: number;
  retryOptions?: { maxRetries?: number; baseDelay?: number };
}

/**
 * RuntimeHealth — Configuration and options interface.
 */
export interface RuntimeHealth {
  running: boolean;
  workflows: number;
  sagas: number;
  schedules: number;
  parallelTasks: number;
  concurrency: { used: number; max: number };
}

/**
 * LocalRuntime — Provides constructor, start, stop, isRunning, ... operations.
 */
export class LocalRuntime {
  readonly workflow: WorkflowEngine;
  readonly saga: SagaManager;
  readonly scheduler: Scheduler;
  readonly retry: RetryManager;
  readonly timeout: TimeoutManager;
  readonly resource: ResourceManager;
  readonly parallel: ParallelExecutor;

  private running = false;
  private startedAt: number = 0;

  constructor(options: RuntimeOptions = {}) {
    this.workflow = new WorkflowEngine();
    this.saga = new SagaManager();
    this.scheduler = new Scheduler();
    this.retry = new RetryManager(options.retryOptions);
    this.timeout = new TimeoutManager({ defaultTimeout: options.defaultTimeout ?? 30000 });
    this.resource = new ResourceManager({ maxConcurrent: options.maxConcurrency ?? 10 });
    this.parallel = new ParallelExecutor(options.maxConcurrency ?? 5);
  }

  start(): void {
    this.scheduler.start();
    this.running = true;
    this.startedAt = Date.now();
  }

  stop(): void {
    this.scheduler.stop();
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  getHealth(): RuntimeHealth {
    return {
      running: this.running,
      workflows: this.workflow.listInstances().length,
      sagas: this.saga.listSagas().length,
      schedules: this.scheduler.list().length,
      parallelTasks: this.parallel.getStats().total,
      concurrency: {
        used: this.resource.getUsage().concurrent,
        max: this.resource.getUsage().concurrent + this.resource.getAvailableConcurrency(),
      },
    };
  }

  getUptime(): number {
    return this.running ? Date.now() - this.startedAt : 0;
  }
}
