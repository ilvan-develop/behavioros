import { describe, expect, it } from 'vitest';
import type { User } from '../engines/security/identity-engine';
import { IdentityEngine } from '../engines/security/identity-engine';
import { AccessControl } from '../engines/security/rbac-abac';

describe('IdentityEngine', () => {
  it('should create a user', () => {
    const engine = new IdentityEngine();
    const user = engine.createUser('alice', ['admin'], { department: 'engineering' });
    expect(user.id).toBeDefined();
    expect(user.username).toBe('alice');
    expect(user.roles).toEqual(['admin']);
    expect(user.attributes).toEqual({ department: 'engineering' });
    expect(user.enabled).toBe(true);
    expect(user.createdAt).toBeDefined();
  });

  it('should get a user by id', () => {
    const engine = new IdentityEngine();
    const created = engine.createUser('bob');
    const found = engine.getUser(created.id);
    expect(found).toBeDefined();
    expect(found!.username).toBe('bob');
  });

  it('should return undefined for nonexistent user', () => {
    const engine = new IdentityEngine();
    expect(engine.getUser('nonexistent')).toBeUndefined();
  });

  it('should find a user by username', () => {
    const engine = new IdentityEngine();
    engine.createUser('alice');
    const found = engine.findByUsername('alice');
    expect(found).toBeDefined();
    expect(found!.username).toBe('alice');
  });

  it('should return undefined for nonexistent username', () => {
    const engine = new IdentityEngine();
    expect(engine.findByUsername('nobody')).toBeUndefined();
  });

  it('should throw on duplicate username', () => {
    const engine = new IdentityEngine();
    engine.createUser('alice');
    expect(() => engine.createUser('alice')).toThrow('User already exists');
  });

  it('should authenticate with valid credentials', () => {
    const engine = new IdentityEngine();
    const user = engine.createUser('alice');
    // Set password via internal map (simulating registration)
    (engine as unknown as { passwords: Map<string, string> }).passwords.set(user.id, 'secret');
    const session = engine.authenticate('alice', 'secret');
    expect(session).toBeDefined();
    expect(session.userId).toBe(user.id);
    expect(session.token).toBeDefined();
    expect(session.expiresAt).toBeDefined();
  });

  it('should throw on invalid credentials', () => {
    const engine = new IdentityEngine();
    engine.createUser('alice');
    expect(() => engine.authenticate('alice', 'wrong')).toThrow('Invalid credentials');
  });

  it('should throw on nonexistent user', () => {
    const engine = new IdentityEngine();
    expect(() => engine.authenticate('nobody', 'pwd')).toThrow('Invalid credentials');
  });

  it('should throw on disabled user', () => {
    const engine = new IdentityEngine();
    const user = engine.createUser('alice');
    engine.disableUser(user.id);
    expect(() => engine.authenticate('alice', 'pwd')).toThrow('User is disabled');
  });

  it('should validate a valid session', () => {
    const engine = new IdentityEngine();
    const user = engine.createUser('alice');
    (engine as unknown as { passwords: Map<string, string> }).passwords.set(user.id, 'secret');
    const session = engine.authenticate('alice', 'secret');
    const validated = engine.validateSession(session.token);
    expect(validated).not.toBeNull();
    expect(validated!.userId).toBe(user.id);
  });

  it('should return null for invalid session token', () => {
    const engine = new IdentityEngine();
    expect(engine.validateSession('invalid-token')).toBeNull();
  });

  it('should revoke a session', () => {
    const engine = new IdentityEngine();
    const user = engine.createUser('alice');
    (engine as unknown as { passwords: Map<string, string> }).passwords.set(user.id, 'secret');
    const session = engine.authenticate('alice', 'secret');
    engine.revokeSession(session.token);
    expect(engine.validateSession(session.token)).toBeNull();
  });

  it('should disable a user', () => {
    const engine = new IdentityEngine();
    const user = engine.createUser('alice');
    engine.disableUser(user.id);
    expect(engine.getUser(user.id)!.enabled).toBe(false);
  });

  it('should list all users', () => {
    const engine = new IdentityEngine();
    engine.createUser('alice');
    engine.createUser('bob');
    expect(engine.listUsers()).toHaveLength(2);
  });
});

describe('AccessControl', () => {
  it('should define a role', () => {
    const ac = new AccessControl();
    const role = ac.defineRole('admin', ['read', 'write', 'delete']);
    expect(role.id).toBeDefined();
    expect(role.name).toBe('admin');
    expect(role.permissions).toEqual(['read', 'write', 'delete']);
  });

  it('should get a role by id', () => {
    const ac = new AccessControl();
    const role = ac.defineRole('admin', ['read']);
    expect(ac.getRole(role.id)).toBeDefined();
    expect(ac.getRole('nonexistent')).toBeUndefined();
  });

  it('should resolve user permissions from roles', () => {
    const ac = new AccessControl();
    const role = ac.defineRole('admin', ['read', 'write', 'delete']);
    const user: User = {
      id: 'u1',
      username: 'admin',
      roles: [role.id],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    const perms = ac.getUserPermissions(user);
    expect(perms).toContain('read');
    expect(perms).toContain('write');
    expect(perms).toContain('delete');
  });

  it('should resolve inherited permissions', () => {
    const ac = new AccessControl();
    const base = ac.defineRole('base', ['read']);
    const admin = ac.defineRole('admin', ['write', 'delete'], base.id);
    const user: User = {
      id: 'u1',
      username: 'admin',
      roles: [admin.id],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    const perms = ac.getUserPermissions(user);
    expect(perms).toContain('read');
    expect(perms).toContain('write');
    expect(perms).toContain('delete');
  });

  it('should handle role hierarchy without circular loops', () => {
    const ac = new AccessControl();
    const viewer = ac.defineRole('viewer', ['read']);
    const editor = ac.defineRole('editor', ['write'], viewer.id);
    const admin = ac.defineRole('admin', ['delete'], editor.id);
    const user: User = {
      id: 'u1',
      username: 'admin',
      roles: [admin.id],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    const perms = ac.getUserPermissions(user);
    expect(perms).toContain('read');
    expect(perms).toContain('write');
    expect(perms).toContain('delete');
  });

  it('should check RBAC access', () => {
    const ac = new AccessControl();
    const role = ac.defineRole('admin', ['read', 'write']);
    const user: User = {
      id: 'u1',
      username: 'admin',
      roles: [role.id],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    expect(ac.checkAccess(user, 'read')).toBe(true);
    expect(ac.checkAccess(user, 'delete')).toBe(false);
  });

  it('should add and evaluate ABAC policies', () => {
    const ac = new AccessControl();
    ac.addPolicy({
      id: 'p1',
      name: 'Allow EU region',
      effect: 'allow',
      conditions: [{ attribute: 'region', operator: 'eq', value: 'EU' }],
    });
    ac.addPolicy({
      id: 'p2',
      name: 'Deny sensitive data',
      effect: 'deny',
      conditions: [{ attribute: 'classification', operator: 'eq', value: 'top-secret' }],
    });
    const user: User = {
      id: 'u1',
      username: 'analyst',
      roles: [],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    expect(ac.checkAccess(user, 'read', { region: 'EU' })).toBe(true);
    expect(ac.checkAccess(user, 'read', { region: 'US' })).toBe(false);
  });

  it('should deny access when ABAC deny policy matches', () => {
    const ac = new AccessControl();
    const role = ac.defineRole('admin', ['read']);
    ac.addPolicy({
      id: 'p1',
      name: 'Deny top-secret',
      effect: 'deny',
      conditions: [{ attribute: 'classification', operator: 'eq', value: 'top-secret' }],
    });
    const user: User = {
      id: 'u1',
      username: 'admin',
      roles: [role.id],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    expect(ac.checkAccess(user, 'read', { classification: 'top-secret' })).toBe(false);
  });

  it('should allow access when ABAC allow policy matches', () => {
    const ac = new AccessControl();
    ac.addPolicy({
      id: 'p1',
      name: 'Allow EU region',
      effect: 'allow',
      conditions: [{ attribute: 'region', operator: 'eq', value: 'EU' }],
    });
    const user: User = {
      id: 'u1',
      username: 'analyst',
      roles: [],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    expect(ac.checkAccess(user, 'read', { region: 'EU' })).toBe(true);
  });

  it('should deny access when deny policy overrides allow', () => {
    const ac = new AccessControl();
    ac.addPolicy({
      id: 'p1',
      name: 'Allow EU',
      effect: 'allow',
      conditions: [{ attribute: 'region', operator: 'eq', value: 'EU' }],
    });
    ac.addPolicy({
      id: 'p2',
      name: 'Deny top-secret',
      effect: 'deny',
      conditions: [{ attribute: 'classification', operator: 'eq', value: 'top-secret' }],
    });
    const user: User = {
      id: 'u1',
      username: 'analyst',
      roles: [],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    expect(ac.checkAccess(user, 'read', { region: 'EU', classification: 'top-secret' })).toBe(
      false,
    );
  });

  it('should handle neq operator in ABAC', () => {
    const ac = new AccessControl();
    ac.addPolicy({
      id: 'p1',
      name: 'Deny non-EU',
      effect: 'deny',
      conditions: [{ attribute: 'region', operator: 'neq', value: 'EU' }],
    });
    const user: User = {
      id: 'u1',
      username: 'analyst',
      roles: [],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    expect(ac.checkAccess(user, 'read', { region: 'US' })).toBe(false);
    // When region is EU, the neq condition is false, so deny doesn't apply
    // and no allow policy exists, so falls through to RBAC (no perms) = false
    expect(ac.checkAccess(user, 'read', { region: 'EU' })).toBe(false);
  });

  it('should handle in operator in ABAC', () => {
    const ac = new AccessControl();
    ac.addPolicy({
      id: 'p1',
      name: 'Allow EU regions',
      effect: 'allow',
      conditions: [{ attribute: 'region', operator: 'in', value: ['EU', 'UK'] }],
    });
    const user: User = {
      id: 'u1',
      username: 'analyst',
      roles: [],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    expect(ac.checkAccess(user, 'read', { region: 'EU' })).toBe(true);
    expect(ac.checkAccess(user, 'read', { region: 'US' })).toBe(false);
  });

  it('should handle contains operator in ABAC', () => {
    const ac = new AccessControl();
    ac.addPolicy({
      id: 'p1',
      name: 'Allow *.example.com',
      effect: 'allow',
      conditions: [{ attribute: 'domain', operator: 'contains', value: '.example.com' }],
    });
    const user: User = {
      id: 'u1',
      username: 'user',
      roles: [],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    expect(ac.checkAccess(user, 'read', { domain: 'app.example.com' })).toBe(true);
    expect(ac.checkAccess(user, 'read', { domain: 'evil.com' })).toBe(false);
  });

  it('should return empty permissions for user with no roles', () => {
    const ac = new AccessControl();
    const user: User = {
      id: 'u1',
      username: 'nobody',
      roles: [],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    expect(ac.getUserPermissions(user)).toEqual([]);
  });

  it('should handle circular role references gracefully', () => {
    const ac = new AccessControl();
    const roleA = ac.defineRole('roleA', ['perm-a']);
    const roleB = ac.defineRole('roleB', ['perm-b'], roleA.id);
    // Create circular reference by updating roleA's parent to roleB
    const roleAObj = ac.getRole(roleA.id);
    if (roleAObj) roleAObj.parentId = roleB.id;
    const user: User = {
      id: 'u1',
      username: 'test',
      roles: [roleA.id],
      attributes: {},
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    const perms = ac.getUserPermissions(user);
    expect(perms).toContain('perm-a');
    expect(perms).toContain('perm-b');
  });
});
