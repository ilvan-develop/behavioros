import { beforeEach, describe, expect, it } from 'vitest';
import { PermissionMatrixManager } from '../engines/behavioral/dna-isolation/permission-matrix';

// ============================================================
// Permission Matrix Tests
// ============================================================

describe('PermissionMatrixManager', () => {
  let manager: PermissionMatrixManager;

  beforeEach(() => {
    manager = new PermissionMatrixManager();
  });

  describe('conversational mode', () => {
    it('should allow read actions', () => {
      const perm = manager.getPermission('conversational', 'read');
      expect(perm.allowed).toBe(true);
      expect(perm.scope).toBe('local');
    });

    it('should deny write actions', () => {
      const perm = manager.getPermission('conversational', 'write');
      expect(perm.allowed).toBe(false);
      expect(perm.scope).toBe('local');
    });

    it('should deny api actions', () => {
      const perm = manager.getPermission('conversational', 'api');
      expect(perm.allowed).toBe(false);
      expect(perm.scope).toBe('local');
    });

    it('should deny state actions', () => {
      const perm = manager.getPermission('conversational', 'state');
      expect(perm.allowed).toBe(false);
      expect(perm.scope).toBe('local');
    });

    it('should not require approval for any conversational action', () => {
      const actions = ['read', 'write', 'api', 'state'] as const;
      for (const action of actions) {
        const perm = manager.getPermission('conversational', action);
        expect(perm.requiresApproval).toBeUndefined();
      }
    });
  });

  describe('transactional mode', () => {
    it('should allow read actions with global scope', () => {
      const perm = manager.getPermission('transactional', 'read');
      expect(perm.allowed).toBe(true);
      expect(perm.scope).toBe('global');
    });

    it('should allow write actions with approval requirement', () => {
      const perm = manager.getPermission('transactional', 'write');
      expect(perm.allowed).toBe(true);
      expect(perm.scope).toBe('local');
      expect(perm.requiresApproval).toBe(true);
    });

    it('should allow api actions with rate limit', () => {
      const perm = manager.getPermission('transactional', 'api');
      expect(perm.allowed).toBe(true);
      expect(perm.scope).toBe('global');
      expect(perm.rateLimit).toBe('100/min');
    });

    it('should allow state actions with audit enabled', () => {
      const perm = manager.getPermission('transactional', 'state');
      expect(perm.allowed).toBe(true);
      expect(perm.scope).toBe('global');
      expect(perm.audit).toBe(true);
    });
  });

  describe('hybrid mode', () => {
    it('should allow read actions with global scope', () => {
      const perm = manager.getPermission('hybrid', 'read');
      expect(perm.allowed).toBe(true);
      expect(perm.scope).toBe('global');
    });

    it('should allow write actions with governance and dna-bound scope', () => {
      const perm = manager.getPermission('hybrid', 'write');
      expect(perm.allowed).toBe(true);
      expect(perm.scope).toBe('dna-bound');
      expect(perm.governance).toBe(true);
    });

    it('should allow api actions with approval and mixed scope', () => {
      const perm = manager.getPermission('hybrid', 'api');
      expect(perm.allowed).toBe(true);
      expect(perm.scope).toBe('mixed');
      expect(perm.requiresApproval).toBe(true);
    });

    it('should allow state actions with audit and mixed scope', () => {
      const perm = manager.getPermission('hybrid', 'state');
      expect(perm.allowed).toBe(true);
      expect(perm.scope).toBe('mixed');
      expect(perm.audit).toBe(true);
    });
  });

  describe('validateAction', () => {
    it('should return true for allowed actions', () => {
      expect(manager.validateAction('conversational', 'read')).toBe(true);
      expect(manager.validateAction('transactional', 'read')).toBe(true);
      expect(manager.validateAction('transactional', 'write')).toBe(true);
      expect(manager.validateAction('hybrid', 'write')).toBe(true);
    });

    it('should return false for denied actions', () => {
      expect(manager.validateAction('conversational', 'write')).toBe(false);
      expect(manager.validateAction('conversational', 'api')).toBe(false);
      expect(manager.validateAction('conversational', 'state')).toBe(false);
    });

    it('should return false for invalid mode', () => {
      expect(manager.validateAction('invalid', 'read')).toBe(false);
    });

    it('should return false for invalid action', () => {
      expect(manager.validateAction('conversational', 'delete')).toBe(false);
    });

    it('should return false for both invalid mode and action', () => {
      expect(manager.validateAction('invalid', 'delete')).toBe(false);
    });
  });

  describe('requiresApproval', () => {
    it('should return false for conversational actions', () => {
      expect(manager.requiresApproval('conversational', 'read')).toBe(false);
      expect(manager.requiresApproval('conversational', 'write')).toBe(false);
    });

    it('should return true for transactional write', () => {
      expect(manager.requiresApproval('transactional', 'write')).toBe(true);
    });

    it('should return false for transactional read', () => {
      expect(manager.requiresApproval('transactional', 'read')).toBe(false);
    });

    it('should return true for hybrid api', () => {
      expect(manager.requiresApproval('hybrid', 'api')).toBe(true);
    });

    it('should return false for invalid mode/action', () => {
      expect(manager.requiresApproval('invalid', 'delete')).toBe(false);
    });
  });

  describe('getMatrix', () => {
    it('should return a deep clone of the matrix', () => {
      const matrix = manager.getMatrix();
      matrix.conversational.read.allowed = false;
      expect(manager.getPermission('conversational', 'read').allowed).toBe(true);
    });

    it('should contain all three modes', () => {
      const matrix = manager.getMatrix();
      expect(matrix).toHaveProperty('conversational');
      expect(matrix).toHaveProperty('transactional');
      expect(matrix).toHaveProperty('hybrid');
    });

    it('should contain all four actions per mode', () => {
      const matrix = manager.getMatrix();
      const actions = ['read', 'write', 'api', 'state'] as const;
      for (const mode of ['conversational', 'transactional', 'hybrid'] as const) {
        for (const action of actions) {
          expect(matrix[mode]).toHaveProperty(action);
        }
      }
    });
  });
});
