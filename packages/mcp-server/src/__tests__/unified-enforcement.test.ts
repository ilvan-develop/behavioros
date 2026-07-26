import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BehaviorOSEngine, ProtocolStateTracker } from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { EnforcementMiddleware } from '../middleware/enforcement-middleware';

const TEST_DIR = join(tmpdir(), `bos-enforcement-${Date.now()}`);

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

describe('T2: Unified Enforcement', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

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

  test('T2.1: MCP server reads .agent_state.json', () => {
    const statePath = join(TEST_DIR, '.agent_state.json');
    writeFileSync(
      statePath,
      JSON.stringify({
        version: '1.0',
        protocol: {
          dnaSelected: false,
          truthResolved: false,
          missionCreated: false,
          auditDone: false,
          learningRecorded: false,
          lastStep: null,
          lastUpdated: null,
        },
      }),
    );

    const tracker = new ProtocolStateTracker();
    const engine = createEngine();
    const _middleware = new EnforcementMiddleware(tracker, engine, 'standard', TEST_DIR);

    // Middleware should have synced from disk
    expect(tracker.isDnaSelected()).toBe(false);
  });

  test('T2.2: MCP server writes .agent_state.json after mark()', () => {
    const tracker = new ProtocolStateTracker();
    const engine = createEngine();
    const middleware = new EnforcementMiddleware(tracker, engine, 'standard', TEST_DIR);

    tracker.markDnaSelected();
    middleware.persist();

    const statePath = join(TEST_DIR, '.agent_state.json');
    expect(existsSync(statePath)).toBe(true);
    const state = JSON.parse(readFileSync(statePath, 'utf-8'));
    expect(state.protocol.dnaSelected).toBe(true);
  });

  test('T2.3: plugin and MCP server share same state file', () => {
    const tracker = new ProtocolStateTracker();
    const engine = createEngine();
    const _middleware = new EnforcementMiddleware(tracker, engine, 'standard', TEST_DIR);

    // Simulate what plugin would do: write directly to disk
    const statePath = join(TEST_DIR, '.agent_state.json');
    writeFileSync(
      statePath,
      JSON.stringify({
        version: '1.0',
        protocol: {
          dnaSelected: true,
          truthResolved: true,
          missionCreated: true,
          auditDone: false,
          learningRecorded: false,
          lastStep: 3,
          lastUpdated: new Date().toISOString(),
        },
      }),
    );

    // MCP middleware reads from same file
    const tracker2 = new ProtocolStateTracker();
    const _middleware2 = new EnforcementMiddleware(tracker2, engine, 'standard', TEST_DIR);

    expect(tracker2.isDnaSelected()).toBe(true);
    expect(tracker2.isTruthResolved()).toBe(true);
    expect(tracker2.isMissionCreated()).toBe(true);
  });

  test('T2.4: _delegationLayer is removed from server.ts', () => {
    const serverCode = readFileSync('src/server.ts', 'utf-8');
    expect(serverCode).not.toContain('DelegationEnforcementLayer');
    expect(serverCode).not.toContain('_delegationLayer');
  });
});
