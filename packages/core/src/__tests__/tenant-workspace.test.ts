import { beforeEach, describe, expect, it } from 'vitest';
import { TenantManager } from '../engines/ecosystem/tenant-manager';
import { WorkspaceManager } from '../engines/ecosystem/workspace-manager';

describe('TenantManager', () => {
  let tm: TenantManager;

  beforeEach(() => {
    tm = new TenantManager();
  });

  it('should create a tenant', () => {
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: {},
      metadata: { region: 'us-east' },
    });
    expect(t.id).toBeDefined();
    expect(t.name).toBe('Acme Corp');
    expect(t.slug).toBe('acme');
    expect(t.status).toBe('active');
    expect(t.createdAt).toBeDefined();
    expect(t.updatedAt).toBeDefined();
    expect(t.usage).toEqual({});
  });

  it('should get a tenant by id', () => {
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: {},
    });
    expect(tm.get(t.id)).toBe(t);
  });

  it('should return undefined for unknown tenant', () => {
    expect(tm.get('nonexistent')).toBeUndefined();
  });

  it('should update a tenant', () => {
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: {},
    });
    const updated = tm.update(t.id, { name: 'Acme Updated', plan: 'premium' });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe('Acme Updated');
    expect(updated!.plan).toBe('premium');
    expect(updated!.id).toBe(t.id);
  });

  it('should return undefined when updating unknown tenant', () => {
    expect(tm.update('nonexistent', { name: 'x' })).toBeUndefined();
  });

  it('should delete a tenant and return true', () => {
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: {},
    });
    expect(tm.delete(t.id)).toBe(true);
    expect(tm.get(t.id)).toBeUndefined();
  });

  it('should return false when deleting unknown tenant', () => {
    expect(tm.delete('nonexistent')).toBe(false);
  });

  it('should list all tenants', () => {
    tm.create({ name: 'A', slug: 'a', plan: 'free', status: 'active', quotas: {} });
    tm.create({ name: 'B', slug: 'b', plan: 'pro', status: 'active', quotas: {} });
    expect(tm.list()).toHaveLength(2);
  });

  it('should set a quota on a tenant', () => {
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: {},
    });
    tm.setQuota(t.id, 'seats', 10);
    expect(t.quotas.seats).toBe(10);
  });

  it('should throw when setting quota on unknown tenant', () => {
    expect(() => tm.setQuota('bad', 'seats', 5)).toThrow('Tenant bad not found');
  });

  it('should checkQuota return true when no limit set', () => {
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: {},
    });
    expect(tm.checkQuota(t.id, 'seats')).toBe(true);
  });

  it('should checkQuota return false when limit exceeded', () => {
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: { seats: 5 },
    });
    tm.recordUsage(t.id, 'seats', 5);
    expect(tm.checkQuota(t.id, 'seats')).toBe(false);
  });

  it('should checkQuota return true when within limit', () => {
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: { seats: 10 },
    });
    tm.recordUsage(t.id, 'seats', 3);
    expect(tm.checkQuota(t.id, 'seats', 5)).toBe(true);
  });

  it('should record usage and return true', () => {
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: { api_calls: 100 },
    });
    expect(tm.recordUsage(t.id, 'api_calls', 10)).toBe(true);
    expect(t.usage.api_calls).toBe(10);
  });

  it('should return false when recording usage exceeds quota', () => {
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: { api_calls: 5 },
    });
    tm.recordUsage(t.id, 'api_calls', 5);
    expect(tm.recordUsage(t.id, 'api_calls', 1)).toBe(false);
    expect(t.usage.api_calls).toBe(5);
  });

  it('should getUsage return a copy of usage', () => {
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: { tokens: 1000 },
    });
    tm.recordUsage(t.id, 'tokens', 250);
    expect(tm.getUsage(t.id)).toEqual({ tokens: 250 });
  });
});

describe('WorkspaceManager', () => {
  let tm: TenantManager;
  let wm: WorkspaceManager;
  let tenantId: string;

  beforeEach(() => {
    tm = new TenantManager();
    wm = new WorkspaceManager(tm);
    const t = tm.create({
      name: 'Acme Corp',
      slug: 'acme',
      plan: 'enterprise',
      status: 'active',
      quotas: {},
    });
    tenantId = t.id;
  });

  it('should create a workspace for an existing tenant', () => {
    const ws = wm.create(tenantId, {
      name: 'Production',
      slug: 'prod',
      members: [],
      config: {},
      status: 'active',
    });
    expect(ws).toBeDefined();
    expect(ws!.name).toBe('Production');
    expect(ws!.tenantId).toBe(tenantId);
  });

  it('should return undefined when creating workspace for unknown tenant', () => {
    const ws = wm.create('nonexistent', {
      name: 'Prod',
      slug: 'prod',
      members: [],
      config: {},
      status: 'active',
    });
    expect(ws).toBeUndefined();
  });

  it('should get a workspace by id', () => {
    const ws = wm.create(tenantId, {
      name: 'Production',
      slug: 'prod',
      members: [],
      config: {},
      status: 'active',
    })!;
    expect(wm.get(ws.id)).toBe(ws);
  });

  it('should get workspaces by tenant', () => {
    wm.create(tenantId, {
      name: 'Prod',
      slug: 'prod',
      members: [],
      config: {},
      status: 'active',
    });
    wm.create(tenantId, {
      name: 'Staging',
      slug: 'staging',
      members: [],
      config: {},
      status: 'active',
    });
    expect(wm.getByTenant(tenantId)).toHaveLength(2);
  });

  it('should not include workspaces from other tenants in getByTenant', () => {
    const t2 = tm.create({
      name: 'Other Inc',
      slug: 'other',
      plan: 'free',
      status: 'active',
      quotas: {},
    });
    wm.create(tenantId, {
      name: 'Prod',
      slug: 'prod',
      members: [],
      config: {},
      status: 'active',
    });
    wm.create(t2.id, {
      name: 'Other Prod',
      slug: 'other-prod',
      members: [],
      config: {},
      status: 'active',
    });
    expect(wm.getByTenant(tenantId)).toHaveLength(1);
    expect(wm.getByTenant(t2.id)).toHaveLength(1);
  });

  it('should update a workspace', () => {
    const ws = wm.create(tenantId, {
      name: 'Prod',
      slug: 'prod',
      members: [],
      config: {},
      status: 'active',
    })!;
    const updated = wm.update(ws.id, { name: 'Production Env', slug: 'production' });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe('Production Env');
    expect(updated!.tenantId).toBe(tenantId);
  });

  it('should delete a workspace', () => {
    const ws = wm.create(tenantId, {
      name: 'Prod',
      slug: 'prod',
      members: [],
      config: {},
      status: 'active',
    })!;
    expect(wm.delete(ws.id)).toBe(true);
    expect(wm.get(ws.id)).toBeUndefined();
  });

  it('should add a member to a workspace', () => {
    const ws = wm.create(tenantId, {
      name: 'Prod',
      slug: 'prod',
      members: [],
      config: {},
      status: 'active',
    })!;
    expect(wm.addMember(ws.id, 'user-1')).toBe(true);
    expect(ws.members).toContain('user-1');
  });

  it('should return false when adding duplicate member', () => {
    const ws = wm.create(tenantId, {
      name: 'Prod',
      slug: 'prod',
      members: ['user-1'],
      config: {},
      status: 'active',
    })!;
    expect(wm.addMember(ws.id, 'user-1')).toBe(false);
  });

  it('should remove a member from a workspace', () => {
    const ws = wm.create(tenantId, {
      name: 'Prod',
      slug: 'prod',
      members: ['user-1', 'user-2'],
      config: {},
      status: 'active',
    })!;
    expect(wm.removeMember(ws.id, 'user-1')).toBe(true);
    expect(ws.members).toEqual(['user-2']);
  });

  it('should return false when removing non-existent member', () => {
    const ws = wm.create(tenantId, {
      name: 'Prod',
      slug: 'prod',
      members: [],
      config: {},
      status: 'active',
    })!;
    expect(wm.removeMember(ws.id, 'user-1')).toBe(false);
  });

  it('should set and get config', () => {
    const ws = wm.create(tenantId, {
      name: 'Prod',
      slug: 'prod',
      members: [],
      config: {},
      status: 'active',
    })!;
    wm.setConfig(ws.id, { theme: 'dark', region: 'us-east' });
    expect(wm.getConfig(ws.id)).toEqual({ theme: 'dark', region: 'us-east' });
  });

  it('should archive a workspace', () => {
    const ws = wm.create(tenantId, {
      name: 'Prod',
      slug: 'prod',
      members: [],
      config: {},
      status: 'active',
    })!;
    wm.archive(ws.id);
    expect(ws.status).toBe('archived');
  });
});
