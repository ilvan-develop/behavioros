import { randomUUID } from 'node:crypto';
import type { User } from './identity-engine';

/**
 * Role — Configuration and options interface.
 */
export interface Role {
  id: string;
  name: string;
  parentId?: string;
  permissions: string[];
}

/**
 * ABACPolicy — Configuration and options interface.
 */
export interface ABACPolicy {
  id: string;
  name: string;
  effect: 'allow' | 'deny';
  conditions: { attribute: string; operator: 'eq' | 'neq' | 'in' | 'contains'; value: unknown }[];
}

/**
 * AccessControl — access control.
 *
 * Methods: defineRole, getRole, getUserPermissions, resolveRole, addPolicy, checkAccess.
 */
export class AccessControl {
  private roles: Map<string, Role> = new Map();
  private policies: ABACPolicy[] = [];

  defineRole(name: string, permissions: string[], parentId?: string): Role {
    const role: Role = {
      id: randomUUID(),
      name,
      parentId,
      permissions,
    };
    this.roles.set(role.id, role);
    return role;
  }

  getRole(id: string): Role | undefined {
    return this.roles.get(id);
  }

  getUserPermissions(user: User): string[] {
    const resolved = new Set<string>();
    const visited = new Set<string>();

    const resolveRole = (roleId: string) => {
      if (visited.has(roleId)) return;
      visited.add(roleId);
      const role = this.roles.get(roleId);
      if (!role) return;
      for (const perm of role.permissions) {
        resolved.add(perm);
      }
      if (role.parentId) {
        resolveRole(role.parentId);
      }
    };

    for (const roleId of user.roles) {
      resolveRole(roleId);
    }

    return Array.from(resolved);
  }

  addPolicy(policy: ABACPolicy): void {
    this.policies.push(policy);
  }

  checkAccess(user: User, requiredPermission: string, resource?: Record<string, unknown>): boolean {
    const userPerms = this.getUserPermissions(user);

    // First check ABAC policies if resource is provided
    if (resource) {
      let abacResult: boolean | null = null;
      for (const policy of this.policies) {
        if (this.evaluatePolicy(policy, resource)) {
          if (policy.effect === 'deny') return false;
          if (policy.effect === 'allow') abacResult = true;
        }
      }
      if (abacResult !== null) return abacResult;
    }

    // Fall back to RBAC
    return userPerms.includes(requiredPermission);
  }

  private evaluatePolicy(policy: ABACPolicy, resource: Record<string, unknown>): boolean {
    return policy.conditions.every((cond) => {
      const resourceValue = resource[cond.attribute];
      switch (cond.operator) {
        case 'eq':
          return resourceValue === cond.value;
        case 'neq':
          return resourceValue !== cond.value;
        case 'in':
          return Array.isArray(cond.value) && cond.value.includes(resourceValue);
        case 'contains':
          return (
            typeof resourceValue === 'string' &&
            typeof cond.value === 'string' &&
            resourceValue.includes(cond.value)
          );
        default:
          return false;
      }
    });
  }
}
