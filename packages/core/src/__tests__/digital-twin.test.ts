import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ChaosExperiment,
  DigitalTwin,
  type SimulationConfig,
} from '../engines/ecosystem/digital-twin';

describe('DigitalTwin', () => {
  let twin: DigitalTwin;

  beforeEach(() => {
    vi.useFakeTimers();
    twin = new DigitalTwin();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createTwin', () => {
    it('should create a twin and return an id', () => {
      const id = twin.createTwin('entity-1');
      expect(id).toContain('twin-entity-1');
    });

    it('should store initial state when provided', () => {
      const id = twin.createTwin('entity-1', { cpu: 50, memory: 256 });
      const state = twin.getTwin(id);
      expect(state?.snapshot).toEqual({ cpu: 50, memory: 256 });
      expect(state?.version).toBe(1);
    });

    it('should start with empty snapshot when no initialState', () => {
      const id = twin.createTwin('entity-1');
      expect(twin.getTwin(id)?.snapshot).toEqual({});
    });
  });

  describe('updateTwin', () => {
    it('should merge new state into existing twin', () => {
      const id = twin.createTwin('entity-1', { cpu: 50 });
      twin.updateTwin(id, { memory: 512 });
      expect(twin.getTwin(id)?.snapshot).toEqual({ cpu: 50, memory: 512 });
    });

    it('should increment version on each update', () => {
      const id = twin.createTwin('entity-1');
      expect(twin.getTwin(id)?.version).toBe(1);
      twin.updateTwin(id, { cpu: 80 });
      expect(twin.getTwin(id)?.version).toBe(2);
      twin.updateTwin(id, { cpu: 90 });
      expect(twin.getTwin(id)?.version).toBe(3);
    });

    it('should throw for nonexistent twin', () => {
      expect(() => twin.updateTwin('nonexistent', {})).toThrow('Twin nonexistent not found');
    });
  });

  describe('getTwin', () => {
    it('should return undefined for nonexistent twin', () => {
      expect(twin.getTwin('nonexistent')).toBeUndefined();
    });

    it('should return the full twin state', () => {
      const id = twin.createTwin('entity-1', { cpu: 50 });
      const state = twin.getTwin(id);
      expect(state).toBeDefined();
      expect(state!.id).toBe(id);
      expect(state!.entityId).toBe('entity-1');
      expect(state!.snapshot).toEqual({ cpu: 50 });
      expect(state!.version).toBe(1);
    });
  });

  describe('sync', () => {
    it('should create a new twin if none exists for entity', () => {
      const result = twin.sync({ entityId: 'entity-new', cpu: 75 });
      expect(result.twinId).toContain('twin-entity-new');
      expect(result.drift).toBe(0);
    });

    it('should compute drift for existing twin with numeric differences', () => {
      const id = twin.createTwin('entity-1', { cpu: 50, memory: 256 });
      const result = twin.sync({ entityId: 'entity-1', cpu: 70, memory: 256 });
      expect(result.twinId).toBe(id);
      expect(result.drift).toBe(10);
    });

    it('should compute drift when keys differ between twin and live', () => {
      twin.createTwin('entity-1', { cpu: 50, disk: 100 });
      const result = twin.sync({ entityId: 'entity-1', cpu: 50, memory: 512 });
      expect(result.drift).toBeGreaterThan(0);
    });
  });

  describe('runSimulation', () => {
    it('should run simulation for the specified number of steps', async () => {
      const config: SimulationConfig = {
        id: 'sim-1',
        name: 'Growth Sim',
        steps: 5,
        interval: 0,
        initialState: { value: 0 },
        rules: [
          {
            name: 'growth',
            condition: 'value < 100',
            action: 'value += 10',
          },
        ],
      };

      const _mock = vi.fn().mockResolvedValue(config);
      const result = await twin.runSimulation(config);

      expect(result.configId).toBe('sim-1');
      expect(result.steps).toHaveLength(5);
      expect(result.steps[0].state.value).toBe(10);
      expect(result.steps[4].state.value).toBe(50);
    });

    it('should apply multiple rules in each step', async () => {
      const config: SimulationConfig = {
        id: 'sim-2',
        name: 'Multi-rule Sim',
        steps: 3,
        interval: 0,
        initialState: { temp: 30, pressure: 100 },
        rules: [
          { name: 'heat', condition: 'temp > 25', action: 'temp += 5' },
          { name: 'vent', condition: 'pressure > 110', action: 'pressure -= 10' },
        ],
      };

      const result = await twin.runSimulation(config);
      expect(result.steps).toHaveLength(3);
      expect(result.steps[2].state.temp).toBe(45);
    });

    it('should include timestamps and summary in result', async () => {
      const config: SimulationConfig = {
        id: 'sim-3',
        name: 'Timestamps Sim',
        steps: 2,
        interval: 0,
        initialState: { x: 1 },
        rules: [{ name: 'double', condition: 'x > 0', action: 'x *= 2' }],
      };

      // override action to handle '*=' properly
      const customConfig: SimulationConfig = {
        ...config,
        rules: [{ name: 'double', condition: 'x > 0', action: 'x += 1' }],
      };

      const result = await twin.runSimulation(customConfig);
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.summary.totalSteps).toBe(2);
      expect(result.steps[0].timestamp).toBeDefined();
    });
  });

  describe('forecast', () => {
    it('should return stable trend for flat history', () => {
      const result = twin.forecast('cpu', [50, 50, 50], 3);
      expect(result.trend).toBe('stable');
      expect(result.currentValue).toBe(50);
      expect(result.predictedValues).toHaveLength(3);
    });

    it('should detect upward trend', () => {
      const result = twin.forecast('requests', [10, 20, 30, 40], 2);
      expect(result.trend).toBe('up');
      expect(result.predictedValues[0].value).toBeGreaterThan(40);
    });

    it('should detect downward trend', () => {
      const result = twin.forecast('errors', [100, 80, 60, 40], 2);
      expect(result.trend).toBe('down');
      expect(result.predictedValues[0].value).toBeLessThan(40);
    });

    it('should return stable with low confidence for single point', () => {
      const result = twin.forecast('latency', [100], 3);
      expect(result.trend).toBe('stable');
      expect(result.confidence).toBe(0.3);
    });
  });

  describe('Chaos experiments', () => {
    it('should inject a chaos experiment and mark it active', async () => {
      const exp: ChaosExperiment = {
        id: 'chaos-1',
        name: 'Latency spike',
        faultType: 'latency',
        target: 'payment-service',
        intensity: 0.5,
        duration: 10000,
        active: false,
      };

      await twin.injectChaos(exp);
      const active = twin.getActiveChaos();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('chaos-1');
      expect(active[0].active).toBe(true);
    });

    it('should stop a chaos experiment before its duration expires', async () => {
      const exp: ChaosExperiment = {
        id: 'chaos-2',
        name: 'Error injection',
        faultType: 'error',
        target: 'auth-service',
        intensity: 0.3,
        duration: 50000,
        active: false,
      };

      await twin.injectChaos(exp);
      expect(twin.getActiveChaos()).toHaveLength(1);

      twin.stopChaos('chaos-2');
      expect(twin.getActiveChaos()).toHaveLength(0);
    });

    it('should auto-stop experiment after duration elapses', async () => {
      const exp: ChaosExperiment = {
        id: 'chaos-3',
        name: 'Crash pod',
        faultType: 'crash',
        target: 'worker-1',
        intensity: 1,
        duration: 5000,
        active: false,
      };

      await twin.injectChaos(exp);
      expect(twin.getActiveChaos()).toHaveLength(1);

      vi.advanceTimersByTime(5000);
      expect(twin.getActiveChaos()).toHaveLength(0);
    });

    it('should throw when injecting duplicate experiment', async () => {
      const exp: ChaosExperiment = {
        id: 'chaos-4',
        name: 'Resource exhaustion',
        faultType: 'resource-exhaustion',
        target: 'database',
        intensity: 0.8,
        duration: 3000,
        active: false,
      };

      await twin.injectChaos(exp);
      await expect(twin.injectChaos(exp)).rejects.toThrow('Experiment chaos-4 already active');
    });

    it('should support multiple simultaneous experiments', async () => {
      await twin.injectChaos({
        id: 'c1',
        name: 'Latency',
        faultType: 'latency',
        target: 'svc-a',
        intensity: 0.5,
        duration: 10000,
        active: false,
      });
      await twin.injectChaos({
        id: 'c2',
        name: 'Errors',
        faultType: 'error',
        target: 'svc-b',
        intensity: 0.3,
        duration: 20000,
        active: false,
      });

      expect(twin.getActiveChaos()).toHaveLength(2);
      twin.stopChaos('c1');
      expect(twin.getActiveChaos()).toHaveLength(1);
      expect(twin.getActiveChaos()[0].id).toBe('c2');
    });
  });

  describe('simulation with multiple rules', () => {
    it('should apply conditional rules correctly across steps', async () => {
      const config: SimulationConfig = {
        id: 'sim-complex',
        name: 'Complex Sim',
        steps: 4,
        interval: 0,
        initialState: { cpu: 10, memory: 50, throttled: 0 },
        rules: [
          { name: 'cpu-spike', condition: 'cpu >= 70', action: 'throttled += 1' },
          { name: 'cool-down', condition: 'cpu > 90', action: 'cpu -= 20' },
          { name: 'background-load', condition: 'cpu < 50', action: 'cpu += 30' },
        ],
      };

      const result = await twin.runSimulation(config);

      // step 1: cpu=10 (<50) -> cpu+=30 => cpu=40
      expect(result.steps[0].state.cpu).toBe(40);
      // step 2: cpu=40 (<50) -> cpu+=30 => cpu=70
      expect(result.steps[1].state.cpu).toBe(70);
      // step 3: cpu=70 (>=70) -> throttled+=1 => throttled=1; cpu not >90 so no cool-down
      expect(result.steps[2].state.throttled).toBe(1);
      // step 4: cpu=70 (>=70): throttled+=1 => 2
      expect(result.steps[3].state.throttled).toBe(2);
    });
  });
});
