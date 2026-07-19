import { describe, expect, it } from 'vitest';
import { PerActionPolicy } from '../resilience/rate-limiter/policies/per-action';
import { PerDNAPolicy } from '../resilience/rate-limiter/policies/per-dna';

describe('PerDNAPolicy', () => {
  describe('default limits', () => {
    it('should return conversational limits', () => {
      const policy = new PerDNAPolicy();
      const limit = policy.getLimitForDNA('any-dna', 'conversational');
      expect(limit.maxRequests).toBe(60);
      expect(limit.windowMs).toBe(60_000);
      expect(limit.mode).toBe('conversational');
    });

    it('should return transactional limits', () => {
      const policy = new PerDNAPolicy();
      const limit = policy.getLimitForDNA('any-dna', 'transactional');
      expect(limit.maxRequests).toBe(20);
      expect(limit.windowMs).toBe(60_000);
      expect(limit.mode).toBe('transactional');
    });

    it('should return hybrid limits', () => {
      const policy = new PerDNAPolicy();
      const limit = policy.getLimitForDNA('any-dna', 'hybrid');
      expect(limit.maxRequests).toBe(40);
      expect(limit.windowMs).toBe(60_000);
      expect(limit.mode).toBe('hybrid');
    });
  });

  describe('DNA overrides', () => {
    it('should override with DNA-specific limits', () => {
      const policy = new PerDNAPolicy();
      policy.setDNAOverride('payment-dna', {
        dnaId: 'payment-dna',
        maxRequests: 10,
        windowMs: 30_000,
        mode: 'transactional',
      });
      const limit = policy.getLimitForDNA('payment-dna', 'conversational');
      expect(limit.maxRequests).toBe(10);
      expect(limit.windowMs).toBe(30_000);
    });

    it('should return default when no override', () => {
      const policy = new PerDNAPolicy();
      const limit = policy.getLimitForDNA('unknown-dna', 'conversational');
      expect(limit.maxRequests).toBe(60);
    });

    it('should remove DNA override', () => {
      const policy = new PerDNAPolicy();
      policy.setDNAOverride('dna-1', {
        dnaId: 'dna-1',
        maxRequests: 5,
        windowMs: 10_000,
        mode: 'transactional',
      });
      const removed = policy.removeDNAOverride('dna-1');
      expect(removed).toBe(true);
      const limit = policy.getLimitForDNA('dna-1', 'transactional');
      expect(limit.maxRequests).toBe(20);
    });

    it('should return false when removing non-existent override', () => {
      const policy = new PerDNAPolicy();
      expect(policy.removeDNAOverride('nonexistent')).toBe(false);
    });
  });

  describe('mode limits', () => {
    it('should update mode limits', () => {
      const policy = new PerDNAPolicy();
      policy.updateModeLimit('conversational', {
        dnaId: '*',
        maxRequests: 200,
        windowMs: 60_000,
        mode: 'conversational',
      });
      const limit = policy.getLimitForDNA('any', 'conversational');
      expect(limit.maxRequests).toBe(200);
    });

    it('should get all mode limits', () => {
      const policy = new PerDNAPolicy();
      const limits = policy.getModeLimits();
      expect(limits.conversational.maxRequests).toBe(60);
      expect(limits.transactional.maxRequests).toBe(20);
      expect(limits.hybrid.maxRequests).toBe(40);
    });

    it('should return a copy of mode limits', () => {
      const policy = new PerDNAPolicy();
      const limits1 = policy.getModeLimits();
      const limits2 = policy.getModeLimits();
      expect(limits1).not.toBe(limits2);
    });
  });

  describe('DNA overrides management', () => {
    it('should get all DNA overrides', () => {
      const policy = new PerDNAPolicy();
      policy.setDNAOverride('dna-1', {
        dnaId: 'dna-1',
        maxRequests: 5,
        windowMs: 10_000,
        mode: 'transactional',
      });
      const overrides = policy.getDNAOverrides();
      expect(overrides.size).toBe(1);
      expect(overrides.get('dna-1')!.maxRequests).toBe(5);
    });

    it('should return a copy of DNA overrides', () => {
      const policy = new PerDNAPolicy();
      policy.setDNAOverride('dna-1', {
        dnaId: 'dna-1',
        maxRequests: 5,
        windowMs: 10_000,
        mode: 'transactional',
      });
      const overrides1 = policy.getDNAOverrides();
      const overrides2 = policy.getDNAOverrides();
      expect(overrides1).not.toBe(overrides2);
    });

    it('should return immutable limit objects', () => {
      const policy = new PerDNAPolicy();
      const limit1 = policy.getLimitForDNA('any', 'conversational');
      const limit2 = policy.getLimitForDNA('any', 'conversational');
      expect(limit1).not.toBe(limit2);
      expect(limit1).toEqual(limit2);
    });
  });
});

describe('PerActionPolicy', () => {
  describe('default limits', () => {
    it('should return read limits for read actions', () => {
      const policy = new PerActionPolicy();
      const limit = policy.getLimitForAction('read');
      expect(limit.maxRequests).toBe(100);
      expect(limit.windowMs).toBe(60_000);
      expect(limit.burstCapacity).toBe(150);
    });

    it('should return write limits', () => {
      const policy = new PerActionPolicy();
      const limit = policy.getLimitForAction('write');
      expect(limit.maxRequests).toBe(30);
      expect(limit.burstCapacity).toBe(40);
    });

    it('should return api limits', () => {
      const policy = new PerActionPolicy();
      const limit = policy.getLimitForAction('api');
      expect(limit.maxRequests).toBe(50);
      expect(limit.burstCapacity).toBe(60);
    });

    it('should return deploy limits', () => {
      const policy = new PerActionPolicy();
      const limit = policy.getLimitForAction('deploy');
      expect(limit.maxRequests).toBe(5);
      expect(limit.windowMs).toBe(300_000);
    });

    it('should return governance limits', () => {
      const policy = new PerActionPolicy();
      const limit = policy.getLimitForAction('governance');
      expect(limit.maxRequests).toBe(20);
    });

    it('should return audit limits', () => {
      const policy = new PerActionPolicy();
      const limit = policy.getLimitForAction('audit');
      expect(limit.maxRequests).toBe(10);
    });
  });

  describe('resolveActionType', () => {
    it('should resolve read-like actions', () => {
      const policy = new PerActionPolicy();
      expect(policy.resolveActionType('getUser')).toBe('read');
      expect(policy.resolveActionType('listOrders')).toBe('read');
      expect(policy.resolveActionType('readData')).toBe('read');
    });

    it('should resolve write-like actions', () => {
      const policy = new PerActionPolicy();
      expect(policy.resolveActionType('createUser')).toBe('write');
      expect(policy.resolveActionType('updateProfile')).toBe('write');
      expect(policy.resolveActionType('deleteItem')).toBe('write');
      expect(policy.resolveActionType('writeLog')).toBe('write');
    });

    it('should resolve deploy-like actions', () => {
      const policy = new PerActionPolicy();
      expect(policy.resolveActionType('deployService')).toBe('deploy');
      expect(policy.resolveActionType('releaseVersion')).toBe('deploy');
    });

    it('should resolve governance-like actions', () => {
      const policy = new PerActionPolicy();
      expect(policy.resolveActionType('approvePR')).toBe('governance');
      expect(policy.resolveActionType('escalateIssue')).toBe('governance');
      expect(policy.resolveActionType('governanceCheck')).toBe('governance');
    });

    it('should resolve audit-like actions', () => {
      const policy = new PerActionPolicy();
      expect(policy.resolveActionType('auditCode')).toBe('audit');
      expect(policy.resolveActionType('reviewPR')).toBe('audit');
      expect(policy.resolveActionType('validateInput')).toBe('audit');
    });

    it('should resolve api-like actions', () => {
      const policy = new PerActionPolicy();
      expect(policy.resolveActionType('callExternal')).toBe('api');
      expect(policy.resolveActionType('apiRequest')).toBe('api');
    });

    it('should default to read for unknown actions', () => {
      const policy = new PerActionPolicy();
      expect(policy.resolveActionType('doSomething')).toBe('read');
    });

    it('should be case insensitive', () => {
      const policy = new PerActionPolicy();
      expect(policy.resolveActionType('GETUSER')).toBe('read');
      expect(policy.resolveActionType('CreateUser')).toBe('write');
    });
  });

  describe('aliases', () => {
    it('should use alias to resolve action type', () => {
      const policy = new PerActionPolicy();
      policy.setActionAlias('fetchData', 'read');
      expect(policy.resolveActionType('fetchData')).toBe('read');
    });

    it('should prioritize alias over keyword matching', () => {
      const policy = new PerActionPolicy();
      policy.setActionAlias('getUser', 'write');
      expect(policy.resolveActionType('getUser')).toBe('write');
    });

    it('should remove alias', () => {
      const policy = new PerActionPolicy();
      policy.setActionAlias('customAction', 'deploy');
      const removed = policy.removeActionAlias('customAction');
      expect(removed).toBe(true);
      expect(policy.resolveActionType('customAction')).not.toBe('deploy');
    });

    it('should return false when removing non-existent alias', () => {
      const policy = new PerActionPolicy();
      expect(policy.removeActionAlias('nonexistent')).toBe(false);
    });
  });

  describe('updateActionLimit', () => {
    it('should update limits for an action type', () => {
      const policy = new PerActionPolicy();
      policy.updateActionLimit('read', {
        actionType: 'read',
        maxRequests: 500,
        windowMs: 120_000,
        burstCapacity: 600,
      });
      const limit = policy.getLimitForAction('read');
      expect(limit.maxRequests).toBe(500);
      expect(limit.windowMs).toBe(120_000);
    });
  });

  describe('getActionLimits', () => {
    it('should return all action limits', () => {
      const policy = new PerActionPolicy();
      const limits = policy.getActionLimits();
      expect(limits.read.maxRequests).toBe(100);
      expect(limits.write.maxRequests).toBe(30);
      expect(limits.deploy.maxRequests).toBe(5);
    });

    it('should return a copy', () => {
      const policy = new PerActionPolicy();
      const limits1 = policy.getActionLimits();
      const limits2 = policy.getActionLimits();
      expect(limits1).not.toBe(limits2);
    });
  });

  describe('getLimitForAction returns immutable copies', () => {
    it('should return distinct objects on each call', () => {
      const policy = new PerActionPolicy();
      const limit1 = policy.getLimitForAction('read');
      const limit2 = policy.getLimitForAction('read');
      expect(limit1).not.toBe(limit2);
      expect(limit1).toEqual(limit2);
    });
  });
});
