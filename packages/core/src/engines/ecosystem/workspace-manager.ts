import { randomUUID } from 'node:crypto';
import type { TenantManager } from './tenant-manager';

/**
 * Workspace — Configuration and options interface.
 */
export interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  members: string[];
  config: Record<string, unknown>;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/**
 * WorkspaceManager — workspace manager.
 *
 * Methods: create, get, getByTenant, update, addMember, removeMember, setConfig, getConfig, +1 more.
 */
export class WorkspaceManager {
  private workspaces = new Map<string, Workspace>();
  private tenantManager: TenantManager;

  constructor(tenantManager: TenantManager) {
    this.tenantManager = tenantManager;
  }

  create(
    tenantId: string,
    data: Omit<Workspace, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Workspace | undefined {
    if (!this.tenantManager.get(tenantId)) return undefined;
    const now = new Date().toISOString();
    const workspace: Workspace = {
      ...data,
      id: randomUUID(),
      tenantId,
      createdAt: now,
      updatedAt: now,
    };
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  get(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  getByTenant(tenantId: string): Workspace[] {
    return Array.from(this.workspaces.values()).filter((w) => w.tenantId === tenantId);
  }

  update(
    id: string,
    data: Partial<Omit<Workspace, 'id' | 'tenantId' | 'createdAt'>>,
  ): Workspace | undefined {
    const existing = this.workspaces.get(id);
    if (!existing) return undefined;
    const updated: Workspace = {
      ...existing,
      ...data,
      id: existing.id,
      tenantId: existing.tenantId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.workspaces.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.workspaces.delete(id);
  }

  addMember(workspaceId: string, memberId: string): boolean {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return false;
    if (ws.members.includes(memberId)) return false;
    ws.members.push(memberId);
    ws.updatedAt = new Date().toISOString();
    return true;
  }

  removeMember(workspaceId: string, memberId: string): boolean {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return false;
    const idx = ws.members.indexOf(memberId);
    if (idx === -1) return false;
    ws.members.splice(idx, 1);
    ws.updatedAt = new Date().toISOString();
    return true;
  }

  setConfig(workspaceId: string, config: Record<string, unknown>): void {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) throw new Error(`Workspace ${workspaceId} not found`);
    ws.config = { ...config };
    ws.updatedAt = new Date().toISOString();
  }

  getConfig(workspaceId: string): Record<string, unknown> {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) throw new Error(`Workspace ${workspaceId} not found`);
    return { ...ws.config };
  }

  archive(workspaceId: string): void {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) throw new Error(`Workspace ${workspaceId} not found`);
    ws.status = 'archived';
    ws.updatedAt = new Date().toISOString();
  }
}
