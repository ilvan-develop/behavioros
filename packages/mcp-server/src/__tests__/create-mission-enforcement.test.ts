import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BehaviorOSEngine, ProtocolStateTracker } from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { EnforcementMiddleware } from '../middleware/enforcement-middleware';

function createMinimalDNA(): DNAPackage {
  return {
    id: 'test-dna',
    name: 'Test DNA',
    version: '1.0.0',
    personas: [],
    governance: [],
    quality: [],
    patterns: [],
    workflows: [],
  };
}

function createEngine(): BehaviorOSEngine {
  const dna = createMinimalDNA();
  return new BehaviorOSEngine({
    dna,
    governance: { enabled: true, level: 'standard', requireApproval: false, maxAgents: 5 },
    quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
    learning: { enabled: true, autoApply: false },
    audit: { enabled: true },
  });
}

describe('create-mission Enforcement', () => {
  let TEST_DIR: string;

  beforeEach(() => {
    TEST_DIR = join(tmpdir(), `bos-create-mission-${Date.now()}`);
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test('create-mission blocked when DNA not selected', async () => {
    const tracker = new ProtocolStateTracker();
    const engine = createEngine();
    const middleware = new EnforcementMiddleware(tracker, engine, 'strict', TEST_DIR);

    const result = await middleware.enforce({
      requiredSteps: ['dna', 'truth'],
      evaluateGovernance: false,
      toolName: 'create-mission',
    });

    expect(result.allowed).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('Select DNA');
  });

  test('create-mission blocked when Truth not resolved', async () => {
    const tracker = new ProtocolStateTracker();
    const engine = createEngine();
    const middleware = new EnforcementMiddleware(tracker, engine, 'strict', TEST_DIR);

    tracker.markDnaSelected();

    const result = await middleware.enforce({
      requiredSteps: ['dna', 'truth'],
      evaluateGovernance: false,
      toolName: 'create-mission',
    });

    expect(result.allowed).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('Resolve Truth');
  });

  test('create-mission allowed when DNA + Truth are resolved', async () => {
    const tracker = new ProtocolStateTracker();
    const engine = createEngine();
    const middleware = new EnforcementMiddleware(tracker, engine, 'strict', TEST_DIR);

    tracker.markDnaSelected();
    tracker.markTruthResolved();

    const result = await middleware.enforce({
      requiredSteps: ['dna', 'truth'],
      evaluateGovernance: false,
      toolName: 'create-mission',
    });

    expect(result.allowed).toBe(true);
    expect(result.blocked).toBe(false);
  });

  test('create-mission does NOT require audit or learning steps', async () => {
    const tracker = new ProtocolStateTracker();
    const engine = createEngine();
    const middleware = new EnforcementMiddleware(tracker, engine, 'strict', TEST_DIR);

    tracker.markDnaSelected();
    tracker.markTruthResolved();

    const result = await middleware.enforce({
      requiredSteps: ['dna', 'truth'],
      evaluateGovernance: false,
      toolName: 'create-mission',
    });

    expect(result.allowed).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeUndefined();
  });
});
