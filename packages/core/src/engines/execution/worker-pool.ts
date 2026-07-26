import type { QueueItem, QueueManager } from './queue-manager';
import type { SandboxExecutor } from './sandbox-executor';

/**
 * Worker — Configuration and options interface.
 */
export interface Worker {
  id: string;
  status: 'idle' | 'busy' | 'error';
  currentTaskId?: string;
  tasksCompleted: number;
  lastActive: string;
}

/**
 * WorkerHandler — Type alias for workerhandler.
 */
export type WorkerHandler = (
  item: QueueItem,
) => Promise<{ success: boolean; output?: string; error?: string }>;

/**
 * WorkerPool — worker pool.
 *
 * Methods: start, stop, clearTimeout, getWorkers, getStats, resize.
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private handler: WorkerHandler;
  private running = false;
  private activeTimers: Set<NodeJS.Timeout> = new Set();
  private sandbox?: SandboxExecutor;

  constructor(size: number, handler: WorkerHandler, sandbox?: SandboxExecutor) {
    this.handler = handler;
    this.sandbox = sandbox;
    for (let i = 0; i < size; i++) {
      this.workers.push({
        id: `worker-${i + 1}`,
        status: 'idle',
        tasksCompleted: 0,
        lastActive: new Date().toISOString(),
      });
    }
  }

  start(queue: QueueManager): void {
    this.running = true;
    for (const worker of this.workers) {
      this.pollWorker(worker, queue);
    }
  }

  stop(): void {
    this.running = false;
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }

  getWorkers(): Worker[] {
    return this.workers.map((w) => ({ ...w }));
  }

  getStats(): {
    total: number;
    idle: number;
    busy: number;
    completed: number;
    failed: number;
  } {
    let idle = 0;
    let busy = 0;
    let completed = 0;
    const failed = 0;

    for (const worker of this.workers) {
      if (worker.status === 'idle') idle++;
      if (worker.status === 'busy') busy++;
      completed += worker.tasksCompleted;
    }

    return { total: this.workers.length, idle, busy, completed, failed };
  }

  resize(newSize: number): void {
    while (this.workers.length < newSize) {
      this.workers.push({
        id: `worker-${this.workers.length + 1}`,
        status: 'idle',
        tasksCompleted: 0,
        lastActive: new Date().toISOString(),
      });
    }
    while (this.workers.length > newSize) {
      const worker = this.workers.pop();
      if (worker && worker.status === 'busy') {
        this.workers.unshift(worker);
        break;
      }
    }
  }

  private pollWorker(worker: Worker, queue: QueueManager): void {
    if (!this.running) return;

    if (worker.status === 'idle') {
      const item = queue.dequeue();
      if (item) {
        worker.status = 'busy';
        worker.currentTaskId = item.id;
        worker.lastActive = new Date().toISOString();
        this.processItem(worker, item, queue);
        return;
      }
    }

    const timer = setTimeout(() => this.pollWorker(worker, queue), 100);
    this.activeTimers.add(timer);
  }

  private async processItem(worker: Worker, item: QueueItem, queue: QueueManager): Promise<void> {
    try {
      const result = this.sandbox ? await this.sandbox.execute(item) : await this.handler(item);
      if (result.success) {
        queue.complete(item.id);
        worker.tasksCompleted++;
      } else {
        if (item.retryCount < item.maxRetries) {
          const retryItem = {
            ...item,
            status: 'queued' as const,
            retryCount: item.retryCount + 1,
            startedAt: undefined,
          };
          queue.enqueue(retryItem);
        } else {
          queue.fail(item.id, result.error ?? 'Unknown error');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (item.retryCount < item.maxRetries) {
        const retryItem = {
          ...item,
          status: 'queued' as const,
          retryCount: item.retryCount + 1,
          startedAt: undefined,
        };
        queue.enqueue(retryItem);
      } else {
        queue.fail(item.id, errorMessage);
      }
    } finally {
      worker.status = 'idle';
      worker.currentTaskId = undefined;
      this.pollWorker(worker, queue);
    }
  }
}
