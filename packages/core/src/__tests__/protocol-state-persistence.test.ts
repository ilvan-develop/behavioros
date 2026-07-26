import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ProtocolStateTracker } from '../engines/protocol-engine';

/** Find the workspace root by looking for opencode.json */
function findWorkspaceRoot(): string {
  let dir = process.cwd();
  // Walk up until we find opencode.json or reach the drive root
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'opencode.json'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const WORKSPACE_ROOT = findWorkspaceRoot();

describe('T1: Protocol State Persistence', () => {
  const TEST_DIR = join(tmpdir(), `bos-test-state-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test('T1.1: creates default state file when none exists', () => {
    const tracker = new ProtocolStateTracker();
    const statePath = join(TEST_DIR, '.agent_state.json');
    tracker.save(statePath);
    expect(existsSync(statePath)).toBe(true);
    const state = JSON.parse(readFileSync(statePath, 'utf-8'));
    expect(state.protocol.dnaSelected).toBe(false);
    expect(state.protocol.truthResolved).toBe(false);
    expect(state.protocol.missionCreated).toBe(false);
    expect(state.protocol.auditDone).toBe(false);
    expect(state.protocol.learningRecorded).toBe(false);
  });

  test('T1.2: loads existing state from disk', () => {
    const statePath = join(TEST_DIR, '.agent_state.json');
    writeFileSync(
      statePath,
      JSON.stringify({
        version: '1.0',
        protocol: {
          dnaSelected: true,
          truthResolved: true,
          missionCreated: false,
          auditDone: false,
          learningRecorded: false,
          lastStep: 2,
          lastUpdated: new Date().toISOString(),
        },
      }),
    );
    const tracker = new ProtocolStateTracker();
    const loaded = tracker.load(statePath);
    expect(loaded).toBe(true);
    expect(tracker.isDnaSelected()).toBe(true);
    expect(tracker.isTruthResolved()).toBe(true);
    expect(tracker.isMissionCreated()).toBe(false);
  });

  test('T1.3: saves state to disk', () => {
    const tracker = new ProtocolStateTracker();
    const statePath = join(TEST_DIR, '.agent_state.json');

    tracker.markDnaSelected();
    tracker.markTruthResolved();
    tracker.save(statePath);

    const raw = readFileSync(statePath, 'utf-8');
    const state = JSON.parse(raw);
    expect(state.protocol.dnaSelected).toBe(true);
    expect(state.protocol.truthResolved).toBe(true);
  });

  test('T1.4: preserves state across load-save cycles', () => {
    const statePath = join(TEST_DIR, '.agent_state.json');

    const tracker1 = new ProtocolStateTracker();
    tracker1.markDnaSelected();
    tracker1.markTruthResolved();
    tracker1.markMissionCreated();
    tracker1.save(statePath);

    const tracker2 = new ProtocolStateTracker();
    const loaded = tracker2.load(statePath);
    expect(loaded).toBe(true);
    expect(tracker2.isDnaSelected()).toBe(true);
    expect(tracker2.isTruthResolved()).toBe(true);
    expect(tracker2.isMissionCreated()).toBe(true);
    expect(tracker2.isAuditDone()).toBe(false);
  });

  test('T1.5: handles corrupted state file gracefully', () => {
    const statePath = join(TEST_DIR, '.agent_state.json');
    writeFileSync(statePath, 'not-json');

    const tracker = new ProtocolStateTracker();
    const loaded = tracker.load(statePath);
    expect(loaded).toBe(false);
    expect(tracker.isDnaSelected()).toBe(false);
  });

  test('T1.6: state file is in .gitignore', () => {
    const gitignore = readFileSync(join(WORKSPACE_ROOT, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.agent_state.json');
  });

  test('T1.7: example state file exists for reference', () => {
    expect(existsSync(join(WORKSPACE_ROOT, '.agent_state.example.json'))).toBe(true);
  });
});
