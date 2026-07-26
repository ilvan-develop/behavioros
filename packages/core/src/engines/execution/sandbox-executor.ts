import type { QueueItem } from './queue-manager';
import type { WorkerHandler } from './worker-pool';

/**
 * ExecutionResult — Type definition for executionresult.
 */
export type ExecutionResult = {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
};

/**
 * TimeoutError — timeout error.
 *
 * Methods: execute.
 */
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Execution timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * SandboxExecutorOptions — Type definition for sandboxexecutoroptions.
 */
export type SandboxExecutorOptions = {
  timeout?: number;
  onComplete?: (result: ExecutionResult) => void;
  onError?: (error: Error) => void;
};

/**
 * SandboxExecutor — sandbox executor.
 *
 * Methods: execute.
 */
export class SandboxExecutor {
  private readonly handler: WorkerHandler;
  private readonly timeoutMs: number;
  private readonly onComplete?: (result: ExecutionResult) => void;
  private readonly onError?: (error: Error) => void;

  constructor(handler: WorkerHandler, options: SandboxExecutorOptions = {}) {
    this.handler = handler;
    this.timeoutMs = options.timeout ?? 30_000;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  async execute(item: QueueItem): Promise<ExecutionResult> {
    const start = performance.now();

    try {
      const result = await this.runWithTimeout(this.handler(item));
      const duration = performance.now() - start;
      const execResult: ExecutionResult = {
        success: true,
        output: result.output,
        duration,
      };
      this.onComplete?.(execResult);
      return execResult;
    } catch (err) {
      const duration = performance.now() - start;
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (err instanceof TimeoutError) {
        this.onError?.(err);
      } else {
        this.onError?.(err instanceof Error ? err : new Error(errorMessage));
      }
      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  private async runWithTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      const id = setTimeout(() => reject(new TimeoutError(this.timeoutMs)), this.timeoutMs);
      if (typeof id === 'object' && typeof id.unref === 'function') {
        id.unref();
      }
    });

    return Promise.race([promise, timeout]);
  }
}
