/**
 * Policy — Configuration and options interface.
 */
export interface Policy {
  id: string;
  name: string;
  description: string;
  rules: string[];
  version: string;
  status: 'active' | 'draft' | 'deprecated';
  createdAt: string;
}

/**
 * PolicyEngine — Provides create, get, list, activate, ... operations.
 */
export class PolicyEngine {
  private policies = new Map<string, Policy>();

  create(policy: Omit<Policy, 'createdAt'>): void {
    const newPolicy: Policy = {
      ...policy,
      createdAt: new Date().toISOString(),
    };
    this.policies.set(policy.id, newPolicy);
  }

  get(id: string): Policy | undefined {
    return this.policies.get(id);
  }

  list(): Policy[] {
    return Array.from(this.policies.values());
  }

  activate(id: string): void {
    const policy = this.policies.get(id);
    if (!policy) throw new Error(`Policy '${id}' not found`);
    policy.status = 'active';
  }

  deprecate(id: string): void {
    const policy = this.policies.get(id);
    if (!policy) throw new Error(`Policy '${id}' not found`);
    policy.status = 'deprecated';
  }

  getActive(): Policy[] {
    return this.list().filter((p) => p.status === 'active');
  }
}
