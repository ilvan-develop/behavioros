/**
 * CustomResourceDefinition — Configuration and options interface.
 */
export interface CustomResourceDefinition {
  apiVersion: string;
  kind: string;
  plural: string;
  singular: string;
  scope: 'Namespaced' | 'Cluster';
  versions: { name: string; served: boolean; storage: boolean }[];
  schema: Record<string, unknown>;
}

/**
 * CustomResource — Configuration and options interface.
 */
export interface CustomResource {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace: string; uid: string; labels?: Record<string, string> };
  spec: Record<string, unknown>;
  status?: Record<string, unknown>;
}

/**
 * ReconciliationResult — Configuration and options interface.
 */
export interface ReconciliationResult {
  resource: string;
  action: 'created' | 'updated' | 'deleted' | 'noop';
  success: boolean;
  error?: string;
  duration: number;
}

/**
 * K8sOperator — k8s operator.
 *
 * Methods: registerCRD, reconcile, watch, stopWatching, clearInterval, getState.
 */
export class K8sOperator {
  private crds = new Map<string, CustomResourceDefinition>();
  private resources = new Map<string, Map<string, CustomResource>>();
  private watchers = new Map<string, ReturnType<typeof setInterval>>();
  private name: string;

  private namespace: string;

  constructor(name: string, namespace?: string) {
    this.name = name;
    this.namespace = namespace ?? 'default';
  }

  registerCRD(crd: CustomResourceDefinition): void {
    this.crds.set(crd.kind, crd);
    if (!this.resources.has(crd.kind)) {
      this.resources.set(crd.kind, new Map());
    }
  }

  async reconcile(resource: CustomResource): Promise<ReconciliationResult> {
    const start = Date.now();
    const kind = resource.kind;
    const uid = resource.metadata.uid;

    const crd = this.crds.get(kind);
    if (!crd) {
      return {
        resource: `${kind}/${resource.metadata.name}`,
        action: 'noop',
        success: false,
        error: `No CRD registered for kind: ${kind}`,
        duration: Date.now() - start,
      };
    }

    const kindResources = this.resources.get(kind)!;
    const existing = kindResources.get(uid);

    if (!existing) {
      kindResources.set(uid, resource);
      return {
        resource: `${kind}/${resource.metadata.name}`,
        action: 'created',
        success: true,
        duration: Date.now() - start,
      };
    }

    const specChanged = JSON.stringify(existing.spec) !== JSON.stringify(resource.spec);
    const statusChanged = JSON.stringify(existing.status) !== JSON.stringify(resource.status);

    if (!specChanged && !statusChanged) {
      return {
        resource: `${kind}/${resource.metadata.name}`,
        action: 'noop',
        success: true,
        duration: Date.now() - start,
      };
    }

    kindResources.set(uid, resource);
    return {
      resource: `${kind}/${resource.metadata.name}`,
      action: 'updated',
      success: true,
      duration: Date.now() - start,
    };
  }

  watch(kind: string, intervalMs = 5000): void {
    if (this.watchers.has(kind)) return;
    const crd = this.crds.get(kind);
    if (!crd) {
      throw new Error(`Cannot watch unregistered CRD kind: ${kind}`);
    }
    const id = setInterval(() => {
      // Simulated reconciliation loop
    }, intervalMs);
    this.watchers.set(kind, id);
  }

  stopWatching(kind?: string): void {
    if (kind) {
      const id = this.watchers.get(kind);
      if (id) {
        clearInterval(id);
        this.watchers.delete(kind);
      }
    } else {
      for (const [, id] of this.watchers) {
        clearInterval(id);
      }
      this.watchers.clear();
    }
  }

  getState(namespace?: string): Record<string, CustomResource[]> {
    const targetNs = namespace ?? this.namespace;
    const state: Record<string, CustomResource[]> = {};
    for (const [kind, kindResources] of this.resources) {
      const all = Array.from(kindResources.values());
      state[kind] = targetNs ? all.filter((r) => r.metadata.namespace === targetNs) : all;
    }
    return state;
  }
}
