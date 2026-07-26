import { randomUUID } from 'node:crypto';

/**
 * SagaStep — Configuration and options interface.
 */
export interface SagaStep {
  id: string;
  name: string;
  execute: () => Promise<unknown>;
  compensate: () => Promise<void>;
  timeout?: number;
}

/**
 * SagaState — Type alias for sagastate.
 */
export type SagaState =
  | 'pending'
  | 'active'
  | 'completed'
  | 'failed'
  | 'compensating'
  | 'compensated';

/**
 * SagaInstance — Configuration and options interface.
 */
export interface SagaInstance {
  id: string;
  name: string;
  steps: SagaStep[];
  state: SagaState;
  currentStepIndex: number;
  completedSteps: string[];
  failedStep?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

const DEFAULT_TIMEOUT = 30_000;

function executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Step timed out after ${timeout}ms`)), timeout);
    fn().then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * SagaManager — saga manager.
 *
 * Methods: createSaga, getSaga, start, compensate, getState, listSagas.
 */
export class SagaManager {
  private sagas = new Map<string, SagaInstance>();

  createSaga(name: string, steps: SagaStep[]): string {
    const id = randomUUID();
    const saga: SagaInstance = {
      id,
      name,
      steps,
      state: 'pending',
      currentStepIndex: 0,
      completedSteps: [],
      startedAt: new Date().toISOString(),
    };
    this.sagas.set(id, saga);
    return id;
  }

  getSaga(id: string): SagaInstance | undefined {
    return this.sagas.get(id);
  }

  async start(id: string): Promise<void> {
    const saga = this.sagas.get(id);
    if (!saga) throw new Error(`Saga ${id} not found`);
    if (saga.state !== 'pending')
      throw new Error(`Saga ${id} is in state ${saga.state}, cannot start`);

    saga.state = 'active';
    saga.startedAt = new Date().toISOString();

    for (let i = 0; i < saga.steps.length; i++) {
      const step = saga.steps[i];
      saga.currentStepIndex = i;

      try {
        const timeout = step.timeout ?? DEFAULT_TIMEOUT;
        await executeWithTimeout(step.execute, timeout);
        saga.completedSteps.push(step.id);
      } catch (err) {
        saga.state = 'failed';
        saga.failedStep = step.id;
        saga.error = err instanceof Error ? err.message : String(err);
        await this.compensate(id);
        return;
      }
    }

    saga.state = 'completed';
    saga.completedAt = new Date().toISOString();
  }

  async compensate(id: string): Promise<void> {
    const saga = this.sagas.get(id);
    if (!saga) throw new Error(`Saga ${id} not found`);
    if (saga.state === 'compensated') return;

    saga.state = 'compensating';

    const completedIds = [...saga.completedSteps].reverse();
    for (const stepId of completedIds) {
      const step = saga.steps.find((s) => s.id === stepId);
      if (step) {
        try {
          await step.compensate();
        } catch {
          // compensation errors are swallowed per saga pattern best practices
        }
      }
    }

    saga.state = 'compensated';
    saga.completedAt = new Date().toISOString();
  }

  getState(id: string): SagaState {
    const saga = this.sagas.get(id);
    if (!saga) throw new Error(`Saga ${id} not found`);
    return saga.state;
  }

  listSagas(): SagaInstance[] {
    return Array.from(this.sagas.values());
  }
}
