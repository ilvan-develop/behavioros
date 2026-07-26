import { describe, expect, it } from 'vitest';
import { SagaManager, type SagaStep } from '../engines/runtime/saga-manager';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('SagaManager', () => {
  it('creates a saga and returns its id', () => {
    const mgr = new SagaManager();
    const id = mgr.createSaga('test', []);
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('getSaga returns the saga instance', () => {
    const mgr = new SagaManager();
    const id = mgr.createSaga('get-test', []);
    const saga = mgr.getSaga(id);
    expect(saga).toBeDefined();
    expect(saga!.name).toBe('get-test');
    expect(saga!.state).toBe('pending');
  });

  it('getSaga returns undefined for unknown id', () => {
    const mgr = new SagaManager();
    expect(mgr.getSaga('nonexistent')).toBeUndefined();
  });

  it('full saga success flow executes all steps in order', async () => {
    const mgr = new SagaManager();
    const order: string[] = [];

    const steps: SagaStep[] = [
      {
        id: '1',
        name: 'step1',
        execute: async () => {
          order.push('1');
        },
        compensate: async () => {},
      },
      {
        id: '2',
        name: 'step2',
        execute: async () => {
          order.push('2');
        },
        compensate: async () => {},
      },
      {
        id: '3',
        name: 'step3',
        execute: async () => {
          order.push('3');
        },
        compensate: async () => {},
      },
    ];

    const id = mgr.createSaga('success', steps);
    await mgr.start(id);

    expect(order).toEqual(['1', '2', '3']);
    const saga = mgr.getSaga(id)!;
    expect(saga.state).toBe('completed');
    expect(saga.completedSteps).toEqual(['1', '2', '3']);
    expect(saga.completedAt).toBeDefined();
  });

  it('step failure triggers compensation in reverse order', async () => {
    const mgr = new SagaManager();
    const execOrder: string[] = [];
    const compOrder: string[] = [];

    const steps: SagaStep[] = [
      {
        id: 'a',
        name: 'a',
        execute: async () => {
          execOrder.push('a');
        },
        compensate: async () => {
          compOrder.push('a');
        },
      },
      {
        id: 'b',
        name: 'b',
        execute: async () => {
          execOrder.push('b');
        },
        compensate: async () => {
          compOrder.push('b');
        },
      },
      {
        id: 'c',
        name: 'c',
        execute: async () => {
          throw new Error('step-c-failed');
        },
        compensate: async () => {},
      },
    ];

    const id = mgr.createSaga('fail-comp', steps);
    await mgr.start(id);

    expect(execOrder).toEqual(['a', 'b']);
    expect(compOrder).toEqual(['b', 'a']);
    const saga = mgr.getSaga(id)!;
    expect(saga.state).toBe('compensated');
    expect(saga.failedStep).toBe('c');
    expect(saga.error).toBe('step-c-failed');
  });

  it('partial compensation when some steps completed', async () => {
    const mgr = new SagaManager();
    const compOrder: string[] = [];

    const steps: SagaStep[] = [
      {
        id: 'x',
        name: 'x',
        execute: async () => {},
        compensate: async () => {
          compOrder.push('x');
        },
      },
      {
        id: 'y',
        name: 'y',
        execute: async () => {
          throw new Error('y-error');
        },
        compensate: async () => {},
      },
    ];

    const id = mgr.createSaga('partial', steps);
    await mgr.start(id);

    expect(compOrder).toEqual(['x']);
  });

  it('timeout enforcement aborts step and marks saga as compensated', async () => {
    const mgr = new SagaManager();

    const steps: SagaStep[] = [
      {
        id: 't1',
        name: 't1',
        execute: async () => {
          await delay(5000);
        },
        compensate: async () => {},
        timeout: 10,
      },
    ];

    const id = mgr.createSaga('timeout', steps);
    const start = Date.now();
    await mgr.start(id);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
    const saga = mgr.getSaga(id)!;
    expect(saga.state).toBe('compensated');
    expect(saga.error).toContain('timed out');
    expect(saga.completedSteps).toHaveLength(0);
  });

  it('state transitions: pending -> active -> completed', async () => {
    const mgr = new SagaManager();
    const steps: SagaStep[] = [
      { id: 's', name: 's', execute: async () => {}, compensate: async () => {} },
    ];

    const id = mgr.createSaga('states', steps);
    expect(mgr.getState(id)).toBe('pending');

    // start but don't await to inspect intermediate state
    const promise = mgr.start(id);
    expect(mgr.getSaga(id)!.state).toBe('active');
    await promise;
    expect(mgr.getState(id)).toBe('completed');
  });

  it('getState throws for unknown saga', () => {
    const mgr = new SagaManager();
    expect(() => mgr.getState('unknown')).toThrow('not found');
  });

  it('listSagas returns all sagas', () => {
    const mgr = new SagaManager();
    const id1 = mgr.createSaga('s1', []);
    const id2 = mgr.createSaga('s2', []);
    const sagas = mgr.listSagas();
    expect(sagas).toHaveLength(2);
    expect(sagas.map((s) => s.id)).toContain(id1);
    expect(sagas.map((s) => s.id)).toContain(id2);
  });

  it('multiple independent sagas', async () => {
    const mgr = new SagaManager();
    const order: string[] = [];

    const makeStep = (id: string): SagaStep => ({
      id,
      name: id,
      execute: async () => {
        order.push(id);
      },
      compensate: async () => {},
    });

    const id1 = mgr.createSaga('multi-1', [makeStep('a'), makeStep('b')]);
    const id2 = mgr.createSaga('multi-2', [makeStep('c'), makeStep('d')]);

    await Promise.all([mgr.start(id1), mgr.start(id2)]);

    expect(mgr.getState(id1)).toBe('completed');
    expect(mgr.getState(id2)).toBe('completed');
    expect(order).toContain('a');
    expect(order).toContain('b');
    expect(order).toContain('c');
    expect(order).toContain('d');
  });

  it('empty saga completes immediately', async () => {
    const mgr = new SagaManager();
    const id = mgr.createSaga('empty', []);
    await mgr.start(id);
    expect(mgr.getState(id)).toBe('completed');
  });

  it('compensate on already compensated saga is no-op', async () => {
    const mgr = new SagaManager();
    const compCalls: string[] = [];

    const steps: SagaStep[] = [
      {
        id: 'o',
        name: 'o',
        execute: async () => {},
        compensate: async () => {
          compCalls.push('o');
        },
      },
      {
        id: 'p',
        name: 'p',
        execute: async () => {
          throw new Error('p-err');
        },
        compensate: async () => {},
      },
    ];

    const id = mgr.createSaga('double-comp', steps);
    await mgr.start(id);
    expect(mgr.getState(id)).toBe('compensated');
    expect(compCalls).toEqual(['o']);

    // call compensate again
    await mgr.compensate(id);
    expect(compCalls).toEqual(['o']); // no additional calls
  });

  it('compensate on completed saga runs all compensations', async () => {
    const mgr = new SagaManager();
    const compCalls: string[] = [];

    const steps: SagaStep[] = [
      {
        id: 'c1',
        name: 'c1',
        execute: async () => {},
        compensate: async () => {
          compCalls.push('c1');
        },
      },
      {
        id: 'c2',
        name: 'c2',
        execute: async () => {},
        compensate: async () => {
          compCalls.push('c2');
        },
      },
    ];

    const id = mgr.createSaga('manual-comp', steps);
    await mgr.start(id);
    expect(mgr.getState(id)).toBe('completed');

    await mgr.compensate(id);
    expect(compCalls).toEqual(['c2', 'c1']);
    expect(mgr.getState(id)).toBe('compensated');
  });

  it('step order is preserved during execution', async () => {
    const mgr = new SagaManager();
    const order: string[] = [];

    const steps: SagaStep[] = [
      {
        id: '1',
        name: 'first',
        execute: async () => {
          await delay(5);
          order.push('1');
        },
        compensate: async () => {},
      },
      {
        id: '2',
        name: 'second',
        execute: async () => {
          await delay(2);
          order.push('2');
        },
        compensate: async () => {},
      },
      {
        id: '3',
        name: 'third',
        execute: async () => {
          order.push('3');
        },
        compensate: async () => {},
      },
    ];

    const id = mgr.createSaga('order', steps);
    await mgr.start(id);
    expect(order).toEqual(['1', '2', '3']);
  });

  it('start throws for already started saga', async () => {
    const mgr = new SagaManager();
    const steps: SagaStep[] = [
      { id: 'once', name: 'once', execute: async () => {}, compensate: async () => {} },
    ];
    const id = mgr.createSaga('double-start', steps);
    await mgr.start(id);
    await expect(mgr.start(id)).rejects.toThrow('cannot start');
  });

  it('start throws for unknown saga', async () => {
    const mgr = new SagaManager();
    await expect(mgr.start('ghost')).rejects.toThrow('not found');
  });

  it('compensation errors do not propagate', async () => {
    const mgr = new SagaManager();

    const steps: SagaStep[] = [
      {
        id: 'bad',
        name: 'bad',
        execute: async () => {},
        compensate: async () => {
          throw new Error('comp-fail');
        },
      },
      {
        id: 'fail',
        name: 'fail',
        execute: async () => {
          throw new Error('exec-fail');
        },
        compensate: async () => {},
      },
    ];

    const id = mgr.createSaga('comp-error', steps);
    await mgr.start(id);
    expect(mgr.getState(id)).toBe('compensated');
  });
});
