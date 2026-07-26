import { randomUUID } from 'node:crypto';

/**
 * Tenant — Configuration and options interface.
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: 'active' | 'suspended' | 'cancelled';
  quotas: Record<string, number>;
  usage: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * TenantManager — tenant manager.
 *
 * Methods: create, get, update, list, setQuota, checkQuota, recordUsage, getUsage.
 */
export class TenantManager {
  private tenants = new Map<string, Tenant>();

  create(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt' | 'usage'>): Tenant {
    const now = new Date().toISOString();
    const tenant: Tenant = {
      ...data,
      id: randomUUID(),
      usage: {},
      createdAt: now,
      updatedAt: now,
    };
    this.tenants.set(tenant.id, tenant);
    return tenant;
  }

  get(id: string): Tenant | undefined {
    return this.tenants.get(id);
  }

  update(id: string, data: Partial<Omit<Tenant, 'id' | 'createdAt'>>): Tenant | undefined {
    const existing = this.tenants.get(id);
    if (!existing) return undefined;
    const updated: Tenant = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.tenants.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.tenants.delete(id);
  }

  list(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  setQuota(tenantId: string, resource: string, limit: number): void {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    tenant.quotas[resource] = limit;
    tenant.updatedAt = new Date().toISOString();
  }

  checkQuota(tenantId: string, resource: string, amount = 1): boolean {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    const limit = tenant.quotas[resource];
    if (limit === undefined) return true;
    const used = tenant.usage[resource] ?? 0;
    return used + amount <= limit;
  }

  recordUsage(tenantId: string, resource: string, amount: number): boolean {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    if (!this.checkQuota(tenantId, resource, amount)) return false;
    tenant.usage[resource] = (tenant.usage[resource] ?? 0) + amount;
    tenant.updatedAt = new Date().toISOString();
    return true;
  }

  getUsage(tenantId: string): Record<string, number> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    return { ...tenant.usage };
  }
}
