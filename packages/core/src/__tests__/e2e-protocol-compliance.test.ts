import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ProtocolStateTracker } from '../engines/protocol-engine';

function findWorkspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'opencode.json'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const _ROOT = findWorkspaceRoot();

describe('T11: E2E Protocol Compliance', () => {
  const TEST_DIR = join(tmpdir(), `bos-e2e-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test('T11.1: full 7-step protocol completes successfully', () => {
    const tracker = new ProtocolStateTracker();
    const statePath = join(TEST_DIR, '.agent_state.json');

    // Step 1: Select DNA
    expect(tracker.isDnaSelected()).toBe(false);
    tracker.markDnaSelected();
    expect(tracker.isDnaSelected()).toBe(true);

    // Step 2: Display DNA (behavioral — skip in tests)

    // Step 3: Resolve Truth
    tracker.markTruthResolved();
    expect(tracker.isTruthResolved()).toBe(true);

    // Step 4: Create Mission
    tracker.markMissionCreated();
    expect(tracker.isMissionCreated()).toBe(true);

    // Step 5: Delegate (behavioral — skip in tests)

    // Step 6: Run Audit
    tracker.markAuditDone();
    expect(tracker.isAuditDone()).toBe(true);

    // Step 7: Record Learning
    tracker.markLearningRecorded();
    expect(tracker.isLearningRecorded()).toBe(true);

    // Verify all steps completed
    const status = tracker.getStatus();
    expect(status.valid).toBe(true);
    expect(status.stepsCompleted).toContain('Select DNA');
    expect(status.stepsCompleted).toContain('Resolve Truth');
    expect(status.stepsCompleted).toContain('Create Mission');
    expect(status.stepsCompleted).toContain('Run Audit');
    expect(status.stepsCompleted).toContain('Record Learning');
    expect(status.stepsMissing).toHaveLength(0);

    // Persist and verify
    tracker.save(statePath);
    const raw = JSON.parse(readFileSync(statePath, 'utf-8'));
    expect(raw.protocol.dnaSelected).toBe(true);
    expect(raw.protocol.learningRecorded).toBe(true);
  });

  test('T11.2: step 6 blocked if step 1 skipped', () => {
    const tracker = new ProtocolStateTracker();

    // Try to validate before audit without DNA selection
    const validation = tracker.validateBeforeAudit();
    expect(validation.valid).toBe(false);
    expect(validation.missing).toContain('Select DNA');
  });

  test('T11.3: step 4 blocked if step 3 skipped', () => {
    const tracker = new ProtocolStateTracker();

    // Mark DNA but skip Truth
    tracker.markDnaSelected();

    // Try to validate delegation (requires Truth + Mission)
    const validation = tracker.validateBeforeDelegation();
    expect(validation.valid).toBe(false);
    expect(validation.missing).toContain('Resolve Truth');
  });

  test('T11.4: state survives simulated session restart', () => {
    const statePath = join(TEST_DIR, '.agent_state.json');

    // Session 1: complete steps 1-3
    const tracker1 = new ProtocolStateTracker();
    tracker1.markDnaSelected();
    tracker1.markTruthResolved();
    tracker1.markMissionCreated();
    tracker1.save(statePath);

    // Session 2: "restart" new tracker, load state
    const tracker2 = new ProtocolStateTracker();
    const loaded = tracker2.load(statePath);
    expect(loaded).toBe(true);
    expect(tracker2.isDnaSelected()).toBe(true);
    expect(tracker2.isTruthResolved()).toBe(true);
    expect(tracker2.isMissionCreated()).toBe(true);
    expect(tracker2.getCurrentStep()).toBe(3);
  });

  test('T11.5: protocol enforces ordering violations', () => {
    const tracker = new ProtocolStateTracker();

    // Try to create mission before resolving truth
    // This creates an ordering violation
    tracker.markDnaSelected();
    tracker.markTruthResolved();
    tracker.markMissionCreated();

    // Create a violation: mark audit without truth
    const tracker2 = new ProtocolStateTracker();
    tracker2.markDnaSelected();
    tracker2.markMissionCreated();
    // Truth was NOT resolved

    const status = tracker2.getStatus();
    const hasOrderViolation = status.orderViolations.some(
      (v) => v.step === 'Create Mission' || v.step === 'Run Audit',
    );
    expect(hasOrderViolation).toBe(true);
  });
});
