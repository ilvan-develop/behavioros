/**
 * ParallelTask — Configuration and options interface.
 */
export interface ParallelTask<T = unknown> {
  id: string;
  execute: () => Promise<T>;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown>;
}

/**
 * ParallelResult — Configuration and options interface.
 */
export interface ParallelResult<T = unknown> {
  id: string;
  status: 'completed' | 'failed';
  result?: T;
  error?: string;
  duration: number;
}

/**
 * ParallelMode — Union type: fail-fast, all-settle;.
 */
export type ParallelMode = 'fail-fast' | 'all-settle';

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * ParallelExecutor — parallel executor.
 *
 * Methods: tryComplete, startNext, runTask, abort, getStats.
 */
export class ParallelExecutor {
  private maxConcurrency: number;
  private mode: ParallelMode;
  private aborted = false;
  private results: ParallelResult[] = [];
  private total = 0;
  private completed = 0;
  private failed = 0;
  private running = 0;
  private resolvePromise: ((results: ParallelResult[]) => void) | null = null;

  constructor(maxConcurrency?: number, mode?: ParallelMode) {
    this.maxConcurrency = maxConcurrency ?? 5;
    this.mode = mode ?? 'all-settle';
  }

  async execute<T>(tasks: ParallelTask<T>[]): Promise<ParallelResult<T>[]> {
    this.aborted = false;
    this.results = [];
    this.total = tasks.length;
    this.completed = 0;
    this.failed = 0;
    this.running = 0;
    this.resolvePromise = null;

    if (tasks.length === 0) return [];

    const sorted = [...tasks].sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority ?? 'medium'] ?? 99) -
        (PRIORITY_ORDER[b.priority ?? 'medium'] ?? 99),
    );

    return new Promise<ParallelResult<T>[]>((resolve) => {
      this.resolvePromise = resolve as (r: ParallelResult[]) => void;
      let index = 0;
      let completedCount = 0;

      const tryComplete = () => {
        if (completedCount === tasks.length || this.aborted) {
          this.resolvePromise?.([...this.results]);
          this.resolvePromise = null;
        }
      };

      const runTask = async (task: ParallelTask<T>) => {
        const startTime = Date.now();
        try {
          const value = await task.execute();
          const duration = Date.now() - startTime;
          this.results.push({ id: task.id, status: 'completed', result: value, duration });
          this.completed++;
          completedCount++;
        } catch (err) {
          const duration = Date.now() - startTime;
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.results.push({ id: task.id, status: 'failed', error: errorMessage, duration });
          this.failed++;
          completedCount++;

          if (this.mode === 'fail-fast') {
            this.aborted = true;
            this.resolvePromise?.([...this.results]);
            this.resolvePromise = null;
            return;
          }
        } finally {
          this.running--;
        }

        tryComplete();
        if (!this.aborted) {
          startNext();
        }
      };

      const startNext = () => {
        while (this.running < this.maxConcurrency && index < sorted.length && !this.aborted) {
          const task = sorted[index++];
          this.running++;
          runTask(task);
        }
      };

      startNext();
    });
  }

  abort(): void {
    if (this.aborted) return;
    this.aborted = true;
    this.resolvePromise?.([...this.results]);
    this.resolvePromise = null;
  }

  getStats(): { total: number; completed: number; failed: number; running: number } {
    return {
      total: this.total,
      completed: this.completed,
      failed: this.failed,
      running: this.running,
    };
  }
}
