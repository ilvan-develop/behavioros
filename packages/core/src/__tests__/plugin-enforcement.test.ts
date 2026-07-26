import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

interface ProtocolState {
  protocol: {
    dnaSelected: boolean;
    truthResolved: boolean;
    missionCreated: boolean;
    auditDone: boolean;
    learningRecorded: boolean;
    lastStep: number | null;
    lastUpdated: string | null;
  };
}

function defaultState(): ProtocolState {
  return {
    protocol: {
      dnaSelected: false,
      truthResolved: false,
      missionCreated: false,
      auditDone: false,
      learningRecorded: false,
      lastStep: null,
      lastUpdated: null,
    },
  };
}

function updateState(state: ProtocolState, toolName: string): void {
  switch (toolName) {
    case 'bos_select_dna':
      state.protocol.dnaSelected = true;
      state.protocol.lastStep = 1;
      break;
    case 'bos_resolve_truth':
      state.protocol.truthResolved = true;
      state.protocol.lastStep = 2;
      break;
    case 'create-mission':
      state.protocol.missionCreated = true;
      state.protocol.lastStep = 3;
      break;
    case 'bos_run_audit':
      state.protocol.auditDone = true;
      state.protocol.lastStep = 4;
      break;
    case 'record-learning':
      state.protocol.learningRecorded = true;
      state.protocol.lastStep = 5;
      break;
    case 'bos_reset_protocol':
      state.protocol.dnaSelected = false;
      state.protocol.truthResolved = false;
      state.protocol.missionCreated = false;
      state.protocol.auditDone = false;
      state.protocol.learningRecorded = false;
      state.protocol.lastStep = null;
      break;
  }
}

function detectOrderViolations(state: ProtocolState): string[] {
  const violations: string[] = [];
  if (state.protocol.truthResolved && !state.protocol.dnaSelected) {
    violations.push('bos_select_dna must be called before bos_resolve_truth');
  }
  if (state.protocol.missionCreated && !state.protocol.truthResolved) {
    violations.push('bos_resolve_truth must be called before create-mission');
  }
  if (state.protocol.auditDone && !state.protocol.missionCreated) {
    violations.push('create-mission must be called before bos_run_audit');
  }
  if (state.protocol.learningRecorded && !state.protocol.auditDone) {
    violations.push('bos_run_audit must be called before record-learning');
  }
  return violations;
}

function saveState(projectPath: string, state: ProtocolState): void {
  state.protocol.lastUpdated = new Date().toISOString();
  writeFileSync(join(projectPath, '.agent_state.json'), JSON.stringify(state, null, 2), 'utf-8');
}

function loadState(projectPath: string): ProtocolState {
  const path = join(projectPath, '.agent_state.json');
  if (!existsSync(path)) return defaultState();
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as ProtocolState;
}

describe('Plugin Enforcement Logic', () => {
  const TEST_DIR = join(tmpdir(), `bos-plugin-enforcement-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test('defaultState returns all false/null', () => {
    const state = defaultState();
    expect(state.protocol.dnaSelected).toBe(false);
    expect(state.protocol.truthResolved).toBe(false);
    expect(state.protocol.missionCreated).toBe(false);
    expect(state.protocol.auditDone).toBe(false);
    expect(state.protocol.learningRecorded).toBe(false);
    expect(state.protocol.lastStep).toBeNull();
    expect(state.protocol.lastUpdated).toBeNull();
  });

  test('updateState with bos_select_dna sets dnaSelected=true, lastStep=1', () => {
    const state = defaultState();
    updateState(state, 'bos_select_dna');
    expect(state.protocol.dnaSelected).toBe(true);
    expect(state.protocol.lastStep).toBe(1);
  });

  test('updateState with bos_resolve_truth sets truthResolved=true, lastStep=2', () => {
    const state = defaultState();
    updateState(state, 'bos_resolve_truth');
    expect(state.protocol.truthResolved).toBe(true);
    expect(state.protocol.lastStep).toBe(2);
  });

  test('updateState with create-mission sets missionCreated=true, lastStep=3', () => {
    const state = defaultState();
    updateState(state, 'create-mission');
    expect(state.protocol.missionCreated).toBe(true);
    expect(state.protocol.lastStep).toBe(3);
  });

  test('updateState with bos_run_audit sets auditDone=true, lastStep=4', () => {
    const state = defaultState();
    updateState(state, 'bos_run_audit');
    expect(state.protocol.auditDone).toBe(true);
    expect(state.protocol.lastStep).toBe(4);
  });

  test('updateState with record-learning sets learningRecorded=true, lastStep=5', () => {
    const state = defaultState();
    updateState(state, 'record-learning');
    expect(state.protocol.learningRecorded).toBe(true);
    expect(state.protocol.lastStep).toBe(5);
  });

  test('updateState with bos_reset_protocol resets all to false/null', () => {
    const state = defaultState();
    updateState(state, 'bos_select_dna');
    updateState(state, 'bos_resolve_truth');
    updateState(state, 'create-mission');
    updateState(state, 'bos_run_audit');
    updateState(state, 'record-learning');
    updateState(state, 'bos_reset_protocol');
    expect(state.protocol.dnaSelected).toBe(false);
    expect(state.protocol.truthResolved).toBe(false);
    expect(state.protocol.missionCreated).toBe(false);
    expect(state.protocol.auditDone).toBe(false);
    expect(state.protocol.learningRecorded).toBe(false);
    expect(state.protocol.lastStep).toBeNull();
  });

  test('order violation: truthResolved=true but dnaSelected=false', () => {
    const state = defaultState();
    state.protocol.truthResolved = true;
    state.protocol.dnaSelected = false;
    const violations = detectOrderViolations(state);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('bos_select_dna must be called before bos_resolve_truth');
  });

  test('order violation: missionCreated=true but truthResolved=false', () => {
    const state = defaultState();
    state.protocol.missionCreated = true;
    state.protocol.truthResolved = false;
    const violations = detectOrderViolations(state);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('bos_resolve_truth must be called before create-mission');
  });

  test('order violation: auditDone=true but missionCreated=false', () => {
    const state = defaultState();
    state.protocol.auditDone = true;
    state.protocol.missionCreated = false;
    const violations = detectOrderViolations(state);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('create-mission must be called before bos_run_audit');
  });

  test('order violation: learningRecorded=true but auditDone=false', () => {
    const state = defaultState();
    state.protocol.learningRecorded = true;
    state.protocol.auditDone = false;
    const violations = detectOrderViolations(state);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('bos_run_audit must be called before record-learning');
  });

  test('no violations when all steps completed in order', () => {
    const state = defaultState();
    updateState(state, 'bos_select_dna');
    updateState(state, 'bos_resolve_truth');
    updateState(state, 'create-mission');
    updateState(state, 'bos_run_audit');
    updateState(state, 'record-learning');
    const violations = detectOrderViolations(state);
    expect(violations.length).toBe(0);
  });

  test('state persistence: save then load returns same state', () => {
    const state = defaultState();
    updateState(state, 'bos_select_dna');
    updateState(state, 'bos_resolve_truth');
    updateState(state, 'create-mission');
    saveState(TEST_DIR, state);

    const loaded = loadState(TEST_DIR);
    expect(loaded.protocol.dnaSelected).toBe(true);
    expect(loaded.protocol.truthResolved).toBe(true);
    expect(loaded.protocol.missionCreated).toBe(true);
    expect(loaded.protocol.auditDone).toBe(false);
    expect(loaded.protocol.learningRecorded).toBe(false);
    expect(loaded.protocol.lastStep).toBe(3);
    expect(loaded.protocol.lastUpdated).not.toBeNull();
  });

  test('multiple violations detected simultaneously', () => {
    const state = defaultState();
    state.protocol.dnaSelected = false;
    state.protocol.truthResolved = true;
    state.protocol.missionCreated = false;
    state.protocol.auditDone = false;
    state.protocol.learningRecorded = true;
    const violations = detectOrderViolations(state);
    expect(violations.length).toBe(2);
    expect(
      violations.some((v) => v.includes('bos_select_dna must be called before bos_resolve_truth')),
    ).toBe(true);
    expect(
      violations.some((v) => v.includes('bos_run_audit must be called before record-learning')),
    ).toBe(true);
  });
});
