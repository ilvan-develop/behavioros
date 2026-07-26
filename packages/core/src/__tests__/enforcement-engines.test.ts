import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditChain } from '../engines/behavioral/audit-chain';
import { AuditChainVerifier } from '../engines/behavioral/audit-chain/audit-chain-verifier';
import { HashChain } from '../engines/behavioral/audit-chain/hash-chain';
import { ContextManager } from '../engines/behavioral/dna-isolation/context-manager';
import { CrossDNAGuard } from '../engines/behavioral/dna-isolation/cross-dna-guard';

const mockExecSync = vi.fn();
vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

describe('HashChain', () => {
  it('should create a genesis entry', () => {
    const chain = new HashChain();
    const genesis = chain.createGenesis('agent-1', 'init', { version: '1.0.0' });

    expect(genesis.agentId).toBe('agent-1');
    expect(genesis.action).toBe('init');
    expect(genesis.previousHash).toBe('');
    expect(genesis.hash).toBeTruthy();
    expect(genesis.id).toBeTruthy();
    expect(chain.length).toBe(1);
  });

  it('should append entries to the chain', () => {
    const chain = new HashChain();
    const genesis = chain.createGenesis('agent-1', 'init');
    const entry = chain.append('agent-2', 'deploy', { env: 'prod' });

    expect(entry.agentId).toBe('agent-2');
    expect(entry.action).toBe('deploy');
    expect(entry.previousHash).toBe(genesis.hash);
    expect(chain.length).toBe(2);
  });

  it('should throw when creating genesis on non-empty chain', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');

    expect(() => chain.createGenesis('agent-2', 'dup')).toThrow('already has entries');
  });

  it('should throw when appending to empty chain', () => {
    const chain = new HashChain();

    expect(() => chain.append('agent-1', 'deploy')).toThrow('call createGenesis');
  });

  it('should return entries as a readonly copy', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');

    const entries = chain.getEntries();
    expect(entries).toHaveLength(1);
  });

  it('should return undefined getLastEntry on empty chain', () => {
    const chain = new HashChain();
    expect(chain.getLastEntry()).toBeUndefined();
  });

  it('should verify a valid entry', () => {
    const chain = new HashChain();
    const genesis = chain.createGenesis('agent-1', 'init');

    expect(HashChain.verifyEntry(genesis)).toBe(true);
  });

  it('should detect tampered entry', () => {
    const chain = new HashChain();
    const genesis = chain.createGenesis('agent-1', 'init');

    const tampered = { ...genesis, action: 'hacked' };
    expect(HashChain.verifyEntry(tampered)).toBe(false);
  });

  it('should verify HMAC signature when signing key is provided', () => {
    const chain = new HashChain('secret-key');
    const genesis = chain.createGenesis('agent-1', 'init');

    expect(genesis.signature).toBeTruthy();
    expect(HashChain.verifyEntry(genesis, 'secret-key')).toBe(true);
  });

  it('should reject HMAC signature with wrong key', () => {
    const chain = new HashChain('secret-key');
    const genesis = chain.createGenesis('agent-1', 'init');

    expect(HashChain.verifyEntry(genesis, 'wrong-key')).toBe(false);
  });

  it('should load entries from a serialised array', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');
    chain.append('agent-2', 'deploy');

    const saved = chain.getEntries();
    const newChain = new HashChain();
    newChain.loadFrom([...saved]);

    expect(newChain.length).toBe(2);
    expect(newChain.getEntries()[0].id).toBe(saved[0].id);
  });

  it('should maintain hash chain integrity across multiple entries', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');

    for (let i = 0; i < 5; i++) {
      chain.append('agent-1', `step-${i}`);
    }

    expect(chain.length).toBe(6);

    for (let i = 0; i < chain.length; i++) {
      expect(HashChain.verifyEntry(chain.getEntries()[i])).toBe(true);
    }
  });
});

describe('AuditChainVerifier', () => {
  it('should verify an intact chain', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');
    chain.append('agent-2', 'deploy');

    const verifier = new AuditChainVerifier(chain);
    const result = verifier.verify();

    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(2);
    expect(result.verifiedEntries).toBe(2);
    expect(result.brokenLinks).toHaveLength(0);
    expect(result.tamperedEntries).toHaveLength(0);
  });

  it('should detect a tampered entry', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');
    chain.append('agent-2', 'deploy');

    const entries = chain.getEntries();
    const tampered = { ...entries[1], action: 'hacked' };
    const originalEntries = [entries[0], tampered];

    const newChain = new HashChain();
    newChain.loadFrom(originalEntries);

    const verifier = new AuditChainVerifier(newChain);
    const result = verifier.verify();

    expect(result.tamperedEntries).toHaveLength(1);
  });

  it('should verify last N entries', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');
    chain.append('agent-2', 'step-1');
    chain.append('agent-2', 'step-2');
    chain.append('agent-2', 'step-3');

    const verifier = new AuditChainVerifier(chain);
    const result = verifier.verifyLast(2);

    expect(result.totalEntries).toBe(2);
    expect(result.valid).toBe(true);
  });

  it('should verify entry at a specific index', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');
    chain.append('agent-2', 'deploy');

    const verifier = new AuditChainVerifier(chain);
    expect(verifier.verifyEntryAt(0)).toBe(true);
    expect(verifier.verifyEntryAt(1)).toBe(true);
  });

  it('should return false for out-of-bounds index', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');

    const verifier = new AuditChainVerifier(chain);
    expect(verifier.verifyEntryAt(5)).toBe(false);
    expect(verifier.verifyEntryAt(-1)).toBe(false);
  });

  it('should generate a verification report', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');

    const verifier = new AuditChainVerifier(chain);
    const result = verifier.verify();
    const report = verifier.report(result);

    expect(report).toContain('Audit Chain Verification Report');
    expect(report).toContain('YES');
  });

  it('should get tampered indices', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');
    chain.append('agent-2', 'deploy');

    const verifier = new AuditChainVerifier(chain);
    expect(verifier.getTamperedIndices()).toHaveLength(0);
  });

  it('should get broken link indices', () => {
    const chain = new HashChain();
    chain.createGenesis('agent-1', 'init');
    chain.append('agent-2', 'deploy');

    const verifier = new AuditChainVerifier(chain);
    expect(verifier.getBrokenLinkIndices()).toHaveLength(0);
  });
});

describe('ContextManager', () => {
  it('should create and retrieve a DNA context', () => {
    const manager = new ContextManager();
    const ctx = manager.createDNAContext('dna-1');

    expect(ctx).toBeDefined();
    expect(ctx.getDnaId()).toBe('dna-1');
    expect(manager.getDNAContext('dna-1')).toBe(ctx);
  });

  it('should return existing DNA context on duplicate create', () => {
    const manager = new ContextManager();
    const ctx1 = manager.createDNAContext('dna-1');
    const ctx2 = manager.createDNAContext('dna-1');

    expect(ctx1).toBe(ctx2);
  });

  it('should create and retrieve an agent context', () => {
    const manager = new ContextManager();
    const ctx = manager.createAgentContext('agent-1', 'senior');

    expect(ctx).toBeDefined();
    expect(ctx.getAgentId()).toBe('agent-1');
    expect(ctx.getAuthority()).toBe('senior');
    expect(manager.getAgentContext('agent-1')).toBe(ctx);
  });

  it('should return existing agent context on duplicate create', () => {
    const manager = new ContextManager();
    const ctx1 = manager.createAgentContext('agent-1', 'senior');
    const ctx2 = manager.createAgentContext('agent-1', 'senior');

    expect(ctx1).toBe(ctx2);
  });

  it('should return undefined for unknown contexts', () => {
    const manager = new ContextManager();

    expect(manager.getDNAContext('unknown')).toBeUndefined();
    expect(manager.getAgentContext('unknown')).toBeUndefined();
  });

  it('should validate cross-DNA access — same DNA passes', () => {
    const manager = new ContextManager();

    expect(manager.validateCrossDNAAccess('dna-1', 'dna-1', 'read')).toBe(true);
  });

  it('should reject cross-DNA access between different DNAs', () => {
    const manager = new ContextManager();

    expect(manager.validateCrossDNAAccess('dna-1', 'dna-2', 'read')).toBe(false);
  });

  it('should clear all contexts', () => {
    const manager = new ContextManager();
    manager.createDNAContext('dna-1');
    manager.createAgentContext('agent-1', 'senior');

    manager.clear();

    expect(manager.getDNAContext('dna-1')).toBeUndefined();
    expect(manager.getAgentContext('agent-1')).toBeUndefined();
  });
});

describe('CrossDNAGuard', () => {
  it('should allow same-DNA access', () => {
    const guard = new CrossDNAGuard();
    const result = guard.validate({
      sourceDnaId: 'dna-1',
      targetDnaId: 'dna-1',
      action: 'read',
      agentId: 'agent-1',
      payload: {},
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toContain('Same-DNA');
    expect(result.requiresApproval).toBe(false);
  });

  it('should allow cross-DNA access when registered in permission matrix', () => {
    const guard = new CrossDNAGuard();
    guard.getPermissionMatrix().registerCrossDNAPermission('dna-1', 'dna-2', 'read', true);

    const result = guard.validate({
      sourceDnaId: 'dna-1',
      targetDnaId: 'dna-2',
      action: 'read',
      agentId: 'agent-1',
      payload: {},
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toContain('permission matrix');
  });

  it('should require approval for unregistered cross-DNA access with agent context', () => {
    const guard = new CrossDNAGuard();
    guard.getContextManager().createAgentContext('agent-1', 'senior');

    const result = guard.validate({
      sourceDnaId: 'dna-1',
      targetDnaId: 'dna-2',
      action: 'write',
      agentId: 'agent-1',
      payload: {},
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.reason).toContain('not in permission matrix');
  });

  it('should block when agent context is not found', () => {
    const guard = new CrossDNAGuard();

    const result = guard.validate({
      sourceDnaId: 'dna-1',
      targetDnaId: 'dna-2',
      action: 'write',
      agentId: 'unknown-agent',
      payload: {},
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(false);
    expect(result.reason).toContain('Agent context not found');
  });

  it('should return context manager and permission matrix', () => {
    const guard = new CrossDNAGuard();

    expect(guard.getContextManager()).toBeInstanceOf(ContextManager);
    expect(guard.getPermissionMatrix()).toBeDefined();
  });
});

describe('AuditChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecSync.mockReturnValue(Buffer.from('passed'));
  });

  it('should load default steps on construction', () => {
    const chain = new AuditChain('/fake/project');
    const steps = chain.listSteps();

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some((s) => s.name === 'lint')).toBe(true);
    expect(steps.some((s) => s.name === 'typecheck')).toBe(true);
  });

  it('should add a custom step', () => {
    const chain = new AuditChain('/fake/project');
    chain.addStep({
      name: 'custom-check',
      trigger: 'commit',
      tool: 'custom',
      command: 'echo ok',
      gate: 'pass',
    });

    expect(chain.listSteps().some((s) => s.name === 'custom-check')).toBe(true);
  });

  it('should remove a step by name', () => {
    const chain = new AuditChain('/fake/project');
    chain.removeStep('lint');

    expect(chain.listSteps().some((s) => s.name === 'lint')).toBe(false);
  });

  it('should get steps for a specific trigger', () => {
    const chain = new AuditChain('/fake/project');
    const commitSteps = chain.getStepsForTrigger('commit');

    expect(commitSteps.every((s) => s.trigger === 'commit')).toBe(true);
  });

  it('should execute commit trigger steps', async () => {
    const chain = new AuditChain('/fake/project');
    const report = await chain.execute('commit');

    expect(report.trigger).toBe('commit');
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.overallStatus).toBeDefined();
    expect(report.totalDuration).toBeGreaterThanOrEqual(0);
  });
});
