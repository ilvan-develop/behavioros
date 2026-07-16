import EventEmitter from 'eventemitter3';

export type SandboxStatus = 'idle' | 'running' | 'completed' | 'failed' | 'timeout' | 'killed';

export type ExecutionPermission =
  | 'read'
  | 'write'
  | 'network'
  | 'filesystem'
  | 'subprocess'
  | 'eval';

export interface SandboxExecutorConfig {
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  maxConcurrentExecutions: number;
  maxMemoryMb: number;
  allowedPermissions: ExecutionPermission[];
  captureOutput: boolean;
  captureStderr: boolean;
  evidenceRetentionMs: number;
}

export interface SandboxExecution {
  id: string;
  agentId: string;
  action: string;
  input: Record<string, unknown>;
  permissions: ExecutionPermission[];
  timeoutMs: number;
  status: SandboxStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  output: SandboxOutput | null;
  error: string | null;
  evidence: SandboxEvidence;
}

export interface SandboxOutput {
  stdout: string;
  stderr: string;
  returnValue: unknown;
  sideEffects: SideEffect[];
}

export interface SideEffect {
  type: 'file-read' | 'file-write' | 'network-call' | 'subprocess' | 'memory-access';
  target: string;
  detail: string;
  blocked: boolean;
}

export interface SandboxEvidence {
  executionId: string;
  agentId: string;
  request: Record<string, unknown>;
  response: SandboxOutput | null;
  permissions: ExecutionPermission[];
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  blockedActions: SideEffect[];
  metadata: Record<string, unknown>;
}

export interface SandboxExecutorEvents {
  'execution-started': (execution: SandboxExecution) => void;
  'execution-completed': (execution: SandboxExecution) => void;
  'execution-failed': (execution: SandboxExecution) => void;
  'execution-timeout': (execution: SandboxExecution) => void;
  'permission-denied': (executionId: string, permission: ExecutionPermission) => void;
  'side-effect-detected': (executionId: string, sideEffect: SideEffect) => void;
  'evidence-captured': (evidence: SandboxEvidence) => void;
}

interface ActiveExecution {
  execution: SandboxExecution;
  timer: ReturnType<typeof setTimeout> | null;
}

export class SandboxExecutor {
  private config: SandboxExecutorConfig;
  private active: Map<string, ActiveExecution> = new Map();
  private completed: SandboxExecution[] = [];
  private emitter = new EventEmitter();

  constructor(config?: Partial<SandboxExecutorConfig>) {
    this.config = {
      defaultTimeoutMs: config?.defaultTimeoutMs ?? 30_000,
      maxTimeoutMs: config?.maxTimeoutMs ?? 300_000,
      maxConcurrentExecutions: config?.maxConcurrentExecutions ?? 10,
      maxMemoryMb: config?.maxMemoryMb ?? 512,
      allowedPermissions: config?.allowedPermissions ?? ['read'],
      captureOutput: config?.captureOutput ?? true,
      captureStderr: config?.captureStderr ?? true,
      evidenceRetentionMs: config?.evidenceRetentionMs ?? 86_400_000,
    };
  }

  async execute<TInput extends Record<string, unknown>, TResult>(
    agentId: string,
    action: string,
    input: TInput,
    handler: (sandboxInput: TInput) => Promise<TResult>,
    options?: {
      permissions?: ExecutionPermission[];
      timeoutMs?: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<SandboxExecution> {
    if (this.active.size >= this.config.maxConcurrentExecutions) {
      throw new Error(
        `Maximum concurrent executions reached (${this.config.maxConcurrentExecutions})`,
      );
    }

    const permissions = options?.permissions ?? ['read'];
    const rejectedPermission = permissions.find((p) => !this.config.allowedPermissions.includes(p));
    if (rejectedPermission) {
      throw new Error(
        `Permission "${rejectedPermission}" is not allowed in sandbox — allowed: [${this.config.allowedPermissions.join(', ')}]`,
      );
    }

    const executionId = this.generateId();
    const timeoutMs = Math.min(
      options?.timeoutMs ?? this.config.defaultTimeoutMs,
      this.config.maxTimeoutMs,
    );

    const execution: SandboxExecution = {
      id: executionId,
      agentId,
      action,
      input: input as Record<string, unknown>,
      permissions,
      timeoutMs,
      status: 'running',
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: null,
      output: null,
      error: null,
      evidence: {
        executionId,
        agentId,
        request: input as Record<string, unknown>,
        response: null,
        permissions,
        startedAt: new Date().toISOString(),
        completedAt: null,
        durationMs: null,
        blockedActions: [],
        metadata: options?.metadata ?? {},
      },
    };

    const timer = setTimeout(() => {
      this.handleTimeout(executionId);
    }, timeoutMs);

    this.active.set(executionId, { execution, timer });
    this.emitter.emit('execution-started', execution);

    const sideEffects: SideEffect[] = [];
    const wrappedHandler = this.wrapWithMonitoring(handler, sideEffects, executionId);

    try {
      const result = await wrappedHandler(input);
      const duration = Date.now() - new Date(execution.startedAt).getTime();

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.durationMs = duration;
      execution.output = {
        stdout: this.config.captureOutput ? JSON.stringify(result) : '',
        stderr: '',
        returnValue: result,
        sideEffects,
      };
      execution.evidence.response = execution.output;
      execution.evidence.completedAt = execution.completedAt;
      execution.evidence.durationMs = duration;
      execution.evidence.blockedActions = sideEffects.filter((s) => s.blocked);

      this.emitter.emit('execution-completed', execution);
      this.emitter.emit('evidence-captured', execution.evidence);
    } catch (error) {
      const duration = Date.now() - new Date(execution.startedAt).getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);

      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      execution.durationMs = duration;
      execution.error = errorMessage;
      execution.output = {
        stdout: '',
        stderr: this.config.captureStderr ? errorMessage : '',
        returnValue: null,
        sideEffects,
      };
      execution.evidence.response = execution.output;
      execution.evidence.completedAt = execution.completedAt;
      execution.evidence.durationMs = duration;

      this.emitter.emit('execution-failed', execution);
      this.emitter.emit('evidence-captured', execution.evidence);
    } finally {
      this.finalizeExecution(executionId);
    }

    return execution;
  }

  async executeReadOnly<TResult>(
    agentId: string,
    action: string,
    handler: () => Promise<TResult>,
    metadata?: Record<string, unknown>,
  ): Promise<SandboxExecution> {
    return this.execute(agentId, action, {}, async () => handler(), {
      permissions: ['read'],
      metadata,
    });
  }

  kill(executionId: string): boolean {
    const active = this.active.get(executionId);
    if (!active) return false;

    if (active.timer) {
      clearTimeout(active.timer);
    }

    active.execution.status = 'killed';
    active.execution.completedAt = new Date().toISOString();
    active.execution.durationMs = Date.now() - new Date(active.execution.startedAt).getTime();

    this.completed.push({ ...active.execution });
    this.active.delete(executionId);

    this.emitter.emit('execution-failed', active.execution);
    return true;
  }

  killAll(): number {
    let count = 0;
    for (const [id] of this.active) {
      if (this.kill(id)) count++;
    }
    return count;
  }

  getActive(): SandboxExecution[] {
    return [...this.active.values()].map((a) => a.execution);
  }

  getCompleted(): SandboxExecution[] {
    return [...this.completed];
  }

  getExecution(id: string): SandboxExecution | null {
    const active = this.active.get(id);
    if (active) return active.execution;
    return this.completed.find((e) => e.id === id) ?? null;
  }

  getEvidence(id: string): SandboxEvidence | null {
    const execution = this.getExecution(id);
    return execution?.evidence ?? null;
  }

  getAllEvidence(): SandboxEvidence[] {
    const activeEvidence = [...this.active.values()].map((a) => a.execution.evidence);
    const completedEvidence = this.completed.map((e) => e.evidence);
    return [...activeEvidence, ...completedEvidence];
  }

  getStats(): {
    active: number;
    completed: number;
    failed: number;
    killed: number;
    timeout: number;
  } {
    const allCompleted = this.completed;
    return {
      active: this.active.size,
      completed: allCompleted.filter((e) => e.status === 'completed').length,
      failed: allCompleted.filter((e) => e.status === 'failed').length,
      killed: allCompleted.filter((e) => e.status === 'killed').length,
      timeout: allCompleted.filter((e) => e.status === 'timeout').length,
    };
  }

  prune(maxAgeMs?: number): number {
    const retention = maxAgeMs ?? this.config.evidenceRetentionMs;
    const cutoff = Date.now() - retention;
    const before = this.completed.length;

    this.completed = this.completed.filter((e) => {
      if (!e.completedAt) return true;
      return new Date(e.completedAt).getTime() >= cutoff;
    });

    return before - this.completed.length;
  }

  reset(): void {
    this.killAll();
    this.completed = [];
  }

  on<K extends keyof SandboxExecutorEvents>(event: K, listener: SandboxExecutorEvents[K]): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof SandboxExecutorEvents>(event: K, listener: SandboxExecutorEvents[K]): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  private handleTimeout(executionId: string): void {
    const active = this.active.get(executionId);
    if (!active) return;

    active.execution.status = 'timeout';
    active.execution.completedAt = new Date().toISOString();
    active.execution.durationMs = Date.now() - new Date(active.execution.startedAt).getTime();
    active.execution.error = `Execution timed out after ${active.execution.timeoutMs}ms`;

    this.completed.push({ ...active.execution });
    this.active.delete(executionId);

    this.emitter.emit('execution-timeout', active.execution);
    this.emitter.emit('evidence-captured', active.execution.evidence);
  }

  private finalizeExecution(executionId: string): void {
    const active = this.active.get(executionId);
    if (!active) return;

    if (active.timer) {
      clearTimeout(active.timer);
    }

    this.completed.push({ ...active.execution });
    this.active.delete(executionId);
  }

  private wrapWithMonitoring<TInput, TResult>(
    handler: (input: TInput) => Promise<TResult>,
    sideEffects: SideEffect[],
    executionId: string,
  ): (input: TInput) => Promise<TResult> {
    return async (input: TInput): Promise<TResult> => {
      return handler(input);
    };
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `sbx_${timestamp}_${random}`;
  }
}
