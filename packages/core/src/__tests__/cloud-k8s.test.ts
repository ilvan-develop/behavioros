import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelmChart } from '../engines/cloud/helm-chart';
import {
  type CustomResource,
  type CustomResourceDefinition,
  K8sOperator,
} from '../engines/cloud/k8s-operator';

// ─── Helpers ────────────────────────────────────────────────────
const sampleCRD = (overrides?: Partial<CustomResourceDefinition>): CustomResourceDefinition => ({
  apiVersion: 'example.io/v1',
  kind: 'Example',
  plural: 'examples',
  singular: 'example',
  scope: 'Namespaced',
  versions: [{ name: 'v1', served: true, storage: true }],
  schema: { type: 'object', properties: {} },
  ...overrides,
});

const sampleResource = (overrides?: Partial<CustomResource>): CustomResource => ({
  apiVersion: 'example.io/v1',
  kind: 'Example',
  metadata: { name: 'my-resource', namespace: 'default', uid: 'uid-001' },
  spec: { key: 'value' },
  status: { phase: 'Running' },
  ...overrides,
});

// ─── K8sOperator Tests ─────────────────────────────────────────
describe('K8sOperator', () => {
  let _operator: K8sOperator;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates operator with default namespace', () => {
      const op = new K8sOperator('test-operator');
      expect(op).toBeInstanceOf(K8sOperator);
    });

    it('creates operator with custom namespace', () => {
      const op = new K8sOperator('test-operator', 'custom-ns');
      expect(op).toBeInstanceOf(K8sOperator);
    });
  });

  describe('registerCRD', () => {
    it('registers a CRD', () => {
      const op = new K8sOperator('test');
      op.registerCRD(sampleCRD());
      const state = op.getState();
      expect(state).toHaveProperty('Example');
      expect(state.Example).toEqual([]);
    });

    it('registers multiple CRDs', () => {
      const op = new K8sOperator('test');
      op.registerCRD(sampleCRD({ kind: 'Foo', plural: 'foos' }));
      op.registerCRD(sampleCRD({ kind: 'Bar', plural: 'bars' }));
      const state = op.getState();
      expect(Object.keys(state)).toEqual(['Foo', 'Bar']);
    });
  });

  describe('reconcile', () => {
    it('creates a resource when no existing resource exists', async () => {
      const op = new K8sOperator('test');
      op.registerCRD(sampleCRD());
      const result = await op.reconcile(sampleResource());
      expect(result.action).toBe('created');
      expect(result.success).toBe(true);
      expect(result.resource).toBe('Example/my-resource');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('returns noop when spec and status are unchanged', async () => {
      const op = new K8sOperator('test');
      op.registerCRD(sampleCRD());
      await op.reconcile(sampleResource());
      const result = await op.reconcile(sampleResource());
      expect(result.action).toBe('noop');
      expect(result.success).toBe(true);
    });

    it('returns updated when spec changes', async () => {
      const op = new K8sOperator('test');
      op.registerCRD(sampleCRD());
      await op.reconcile(sampleResource());
      const updated = sampleResource({ spec: { key: 'new-value' } });
      const result = await op.reconcile(updated);
      expect(result.action).toBe('updated');
      expect(result.success).toBe(true);
    });

    it('returns updated when status changes', async () => {
      const op = new K8sOperator('test');
      op.registerCRD(sampleCRD());
      await op.reconcile(sampleResource());
      const updated = sampleResource({ status: { phase: 'Failed' } });
      const result = await op.reconcile(updated);
      expect(result.action).toBe('updated');
      expect(result.success).toBe(true);
    });

    it('fails when CRD is not registered', async () => {
      const op = new K8sOperator('test');
      const result = await op.reconcile(sampleResource({ kind: 'Unknown' }));
      expect(result.action).toBe('noop');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No CRD registered');
    });
  });

  describe('watch / stopWatching', () => {
    it('starts watching a registered CRD kind', () => {
      const op = new K8sOperator('test');
      op.registerCRD(sampleCRD());
      expect(() => op.watch('Example', 1000)).not.toThrow();
    });

    it('throws when watching unregistered CRD kind', () => {
      const op = new K8sOperator('test');
      expect(() => op.watch('Unknown')).toThrow('Cannot watch unregistered');
    });

    it('stops watching a specific kind', () => {
      const op = new K8sOperator('test');
      op.registerCRD(sampleCRD());
      op.watch('Example', 1000);
      expect(() => op.stopWatching('Example')).not.toThrow();
    });

    it('stops all watches', () => {
      const op = new K8sOperator('test');
      op.registerCRD(sampleCRD({ kind: 'Foo', plural: 'foos' }));
      op.registerCRD(sampleCRD({ kind: 'Bar', plural: 'bars' }));
      op.watch('Foo', 1000);
      op.watch('Bar', 1000);
      expect(() => op.stopWatching()).not.toThrow();
    });
  });

  describe('getState', () => {
    it('returns empty state when no CRDs registered', () => {
      const op = new K8sOperator('test');
      expect(op.getState()).toEqual({});
    });

    it('returns resources by kind', async () => {
      const op = new K8sOperator('test');
      op.registerCRD(sampleCRD());
      await op.reconcile(sampleResource());
      await op.reconcile(
        sampleResource({
          metadata: { name: 'second', namespace: 'default', uid: 'uid-002' },
        }),
      );
      const state = op.getState();
      expect(state.Example).toHaveLength(2);
    });
  });
});

// ─── HelmChart Tests ────────────────────────────────────────────
describe('HelmChart', () => {
  describe('constructor', () => {
    it('creates a chart with default namespace', () => {
      const chart = new HelmChart('my-app');
      expect(chart).toBeInstanceOf(HelmChart);
    });

    it('creates a chart with custom namespace', () => {
      const chart = new HelmChart('my-app', 'production');
      expect(chart).toBeInstanceOf(HelmChart);
    });
  });

  describe('setValues / getValues', () => {
    it('uses default values', () => {
      const chart = new HelmChart('my-app');
      const values = chart.getValues();
      expect(values.replicaCount).toBe(1);
      expect(values.image.repository).toBe('nginx');
      expect(values.service.type).toBe('ClusterIP');
      expect(values.ingress.enabled).toBe(false);
    });

    it('overrides specific values', () => {
      const chart = new HelmChart('my-app');
      chart.setValues({ replicaCount: 3, service: { type: 'LoadBalancer', port: 8080 } });
      const values = chart.getValues();
      expect(values.replicaCount).toBe(3);
      expect(values.service.type).toBe('LoadBalancer');
      expect(values.service.port).toBe(8080);
    });

    it('preserves unset defaults', () => {
      const chart = new HelmChart('my-app');
      chart.setValues({ replicaCount: 5 });
      const values = chart.getValues();
      expect(values.image.repository).toBe('nginx');
      expect(values.persistence.enabled).toBe(false);
    });
  });

  describe('generate', () => {
    it('returns YAML string with chart metadata', () => {
      const chart = new HelmChart('my-app');
      const yaml = chart.generate();
      expect(yaml).toContain('apiVersion: v2');
      expect(yaml).toContain('name: my-app');
      expect(yaml).toContain('type: application');
    });

    it('includes default values in YAML', () => {
      const chart = new HelmChart('my-app');
      const yaml = chart.generate();
      expect(yaml).toContain('replicaCount: 1');
      expect(yaml).toContain('repository: nginx');
      expect(yaml).toContain('pullPolicy: IfNotPresent');
    });

    it('reflects overridden values in YAML', () => {
      const chart = new HelmChart('my-app');
      chart.setValues({ replicaCount: 3, ingress: { enabled: true, host: 'example.com' } });
      const yaml = chart.generate();
      expect(yaml).toContain('replicaCount: 3');
      expect(yaml).toContain('host: example.com');
    });

    it('includes dependencies section when added', () => {
      const chart = new HelmChart('my-app');
      chart.addDependency('redis', 'redis', '17.x', 'cache');
      const yaml = chart.generate();
      expect(yaml).toContain('dependencies:');
      expect(yaml).toContain('- name: redis');
      expect(yaml).toContain('alias: cache');
    });
  });

  describe('addDependency / getDependencies', () => {
    it('adds and returns dependencies', () => {
      const chart = new HelmChart('my-app');
      chart.addDependency('redis', 'redis', '17.x');
      chart.addDependency('postgresql', 'postgresql', '14.x', 'db');
      const deps = chart.getDependencies();
      expect(deps).toHaveLength(2);
      expect(deps[0]).toEqual({ name: 'redis', chart: 'redis', version: '17.x' });
      expect(deps[1]).toEqual({
        name: 'postgresql',
        chart: 'postgresql',
        version: '14.x',
        alias: 'db',
      });
    });

    it('returns copy of dependencies array', () => {
      const chart = new HelmChart('my-app');
      chart.addDependency('redis', 'redis', '17.x');
      const deps = chart.getDependencies();
      deps.push({ name: 'fake', chart: 'fake', version: '1.0' });
      expect(chart.getDependencies()).toHaveLength(1);
    });
  });
});
