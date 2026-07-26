import { BehaviorOSEngine, ProtocolStateTracker } from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { EnforcementMiddleware } from '../middleware/enforcement-middleware';
import { bosResetProtocol, bosResetProtocolInput } from '../tools/bos-reset-protocol';
import { bosValidateProtocol } from '../tools/bos-validate-protocol';

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

describe('T6: Protocol Enforcement — DelegationEnforcementLayer', () => {
  let tracker: ProtocolStateTracker;
  let engine: BehaviorOSEngine;
  let middleware: EnforcementMiddleware;

  beforeEach(() => {
    tracker = new ProtocolStateTracker();
    engine = createEngine();
    middleware = new EnforcementMiddleware(tracker, engine, 'strict');
  });

  describe('T6.1: validateBeforeAction — blocks non-workflow tools when DNA not selected', () => {
    test('blocks action tools when bos_select_dna not called', () => {
      const result = tracker.validateBeforeAction();
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('Select DNA');
      expect(result.message).toContain('bos_select_dna must be called');
    });

    test('allows action tools after DNA selected', () => {
      tracker.markDnaSelected();
      const result = tracker.validateBeforeAction();
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });
  });

  describe('T6.2: validateBeforeDelegation — blocks delegation when prerequisites missing', () => {
    test('blocks delegation when only DNA selected', () => {
      tracker.markDnaSelected();
      const result = tracker.validateBeforeDelegation();
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['Resolve Truth', 'Create Mission']);
    });

    test('blocks delegation when DNA + Truth resolved but no mission', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      const result = tracker.validateBeforeDelegation();
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['Create Mission']);
    });

    test('allows delegation when all prerequisites done', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      const result = tracker.validateBeforeDelegation();
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });
  });

  describe('T6.3: validateBeforeAudit — blocks audit when prerequisites missing', () => {
    test('blocks audit with empty state', () => {
      const result = tracker.validateBeforeAudit();
      expect(result.valid).toBe(false);
      expect(result.missing).toHaveLength(3);
    });

    test('blocks audit when only DNA done', () => {
      tracker.markDnaSelected();
      const result = tracker.validateBeforeAudit();
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['Resolve Truth', 'Create Mission']);
    });

    test('allows audit after DNA + Truth + Mission', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      const result = tracker.validateBeforeAudit();
      expect(result.valid).toBe(true);
    });
  });

  describe('T6.4: validateBeforeComplete — blocks mission completion without audit', () => {
    test('blocks complete when audit not done', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      const result = tracker.validateBeforeComplete();
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['Run Audit']);
    });

    test('allows complete when all steps done', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markAuditDone();
      const result = tracker.validateBeforeComplete();
      expect(result.valid).toBe(true);
    });

    test('blocks complete when multiple steps missing', () => {
      const result = tracker.validateBeforeComplete();
      expect(result.valid).toBe(false);
      expect(result.missing).toHaveLength(4);
    });
  });

  describe('T6.5: EnforcementMiddleware.enforce() blocks with correct step combos', () => {
    test('blocks tool requiring audit when audit not done', async () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();

      const result = await middleware.enforce({
        requiredSteps: ['audit'],
        evaluateGovernance: false,
        toolName: 'run-audit',
      });

      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('Run Audit');
    });

    test('blocks tool requiring learning when learning not recorded', async () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markAuditDone();

      const result = await middleware.enforce({
        requiredSteps: ['learning'],
        evaluateGovernance: false,
        toolName: 'record-learning',
      });

      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('Record Learning');
    });

    test('allows tool with all requirements met', async () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markAuditDone();
      tracker.markLearningRecorded();

      const result = await middleware.enforce({
        requiredSteps: ['dna', 'truth', 'mission', 'audit', 'learning'],
        evaluateGovernance: false,
        toolName: 'full-pipeline',
      });

      expect(result.allowed).toBe(true);
      expect(result.blocked).toBe(false);
    });
  });

  describe('T6.6: Enforcement levels handle edge cases', () => {
    test('audit level returns blocked=false even with missing steps', async () => {
      const auditMiddleware = new EnforcementMiddleware(tracker, engine, 'audit');
      const result = await auditMiddleware.enforce({
        requiredSteps: ['dna', 'truth'],
        evaluateGovernance: false,
        toolName: 'audit-tool',
      });

      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(false);
      expect(result.reason).toContain('prerequisite steps missing');
    });

    test('standard level blocks by default', async () => {
      const standardMiddleware = new EnforcementMiddleware(tracker, engine, 'standard');
      const result = await standardMiddleware.enforce({
        requiredSteps: ['dna'],
        evaluateGovernance: false,
        toolName: 'any-tool',
      });

      expect(result.allowed).toBe(false);
      expect(result.blocked).toBe(true);
    });

    test('empty requiredSteps always passes', async () => {
      const result = await middleware.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'no-requirements',
      });

      expect(result.allowed).toBe(true);
      expect(result.blocked).toBe(false);
    });
  });

  describe('T6.7: Order violations detection', () => {
    test('detects truth resolved before DNA', () => {
      tracker.markTruthResolved();
      const status = tracker.getStatus();
      expect(status.orderViolations).toHaveLength(1);
      expect(status.orderViolations[0].step).toBe('Resolve Truth');
      expect(status.orderViolations[0].expected).toBe('Select DNA first');
    });

    test('detects mission created before truth', () => {
      tracker.markDnaSelected();
      tracker.markMissionCreated();
      const status = tracker.getStatus();
      expect(status.orderViolations).toHaveLength(1);
      expect(status.orderViolations[0].step).toBe('Create Mission');
    });

    test('detects learning recorded before audit', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markLearningRecorded();
      const status = tracker.getStatus();
      expect(status.orderViolations).toHaveLength(1);
      expect(status.orderViolations[0].step).toBe('Record Learning');
    });

    test('no violations for correct order', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markAuditDone();
      tracker.markLearningRecorded();
      const status = tracker.getStatus();
      expect(status.orderViolations).toHaveLength(0);
    });
  });

  describe('T6.8: getNextRequiredStep returns correct guidance', () => {
    test('returns Step 1 when nothing done', () => {
      expect(tracker.getNextRequiredStep()).toContain('Select DNA');
    });

    test('returns Step 3 when only DNA done', () => {
      tracker.markDnaSelected();
      expect(tracker.getNextRequiredStep()).toContain('Resolve Truth');
    });

    test('returns Step 4 when Truth done', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      expect(tracker.getNextRequiredStep()).toContain('Create Mission');
    });

    test('returns Step 6 when Mission done', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      expect(tracker.getNextRequiredStep()).toContain('Run Audit');
    });

    test('returns Step 7 when Audit done', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markAuditDone();
      expect(tracker.getNextRequiredStep()).toContain('Record Learning');
    });

    test('returns all complete when all steps done', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markAuditDone();
      tracker.markLearningRecorded();
      expect(tracker.getNextRequiredStep()).toBe('All protocol steps completed.');
    });
  });

  describe('T6.9: getStatus returns accurate state snapshot', () => {
    test('empty tracker has all steps missing', () => {
      const status = tracker.getStatus();
      expect(status.valid).toBe(false);
      expect(status.stepsCompleted).toHaveLength(0);
      expect(status.stepsMissing).toHaveLength(5);
      expect(status.currentStep).toBe(0);
    });

    test('partially completed tracker shows correct completed/missing', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      const status = tracker.getStatus();
      expect(status.stepsCompleted).toEqual(['Select DNA', 'Resolve Truth']);
      expect(status.stepsMissing).toEqual(['Create Mission', 'Run Audit', 'Record Learning']);
      expect(status.currentStep).toBe(2);
    });

    test('full protocol shows valid=true', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markAuditDone();
      tracker.markLearningRecorded();
      const status = tracker.getStatus();
      expect(status.valid).toBe(true);
      expect(status.stepsCompleted).toHaveLength(5);
      expect(status.stepsMissing).toHaveLength(0);
    });

    test('getStatus includes timestamps for completed steps', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      const status = tracker.getStatus();
      expect(status.lastActionTimestamps).toHaveLength(2);
      expect(status.lastActionTimestamps[0].step).toBe('Select DNA');
      expect(status.lastActionTimestamps[0].timestamp).toBeDefined();
    });
  });

  describe('T6.10: bosResetProtocol tool handles edge cases', () => {
    test('reset returns false when confirm=false', async () => {
      const result = await bosResetProtocol(tracker, { confirm: false });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.reset).toBe(false);
      expect(parsed.reason).toContain('not confirmed');
    });

    test('reset works when confirm=true', async () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      const result = await bosResetProtocol(tracker, { confirm: true, reason: 'testing' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.reset).toBe(true);
      expect(parsed.reason).toBe('testing');
      expect(parsed.previousState.stepsCompleted).toHaveLength(2);
      expect(tracker.isDnaSelected()).toBe(false);
    });

    test('bosResetProtocolInput validates confirm boolean', () => {
      const valid = bosResetProtocolInput.parse({ confirm: true });
      expect(valid.confirm).toBe(true);
    });
  });

  describe('T6.11: bosValidateProtocol returns correct status', () => {
    test('returns valid=false with empty tracker', async () => {
      const result = await bosValidateProtocol(tracker);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.valid).toBe(false);
      expect(parsed.currentStep).toBe(0);
      expect(parsed.currentStepName).toBe('none');
      expect(parsed.stepsMissing).toHaveLength(5);
    });

    test('returns valid=true with full tracker', async () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markAuditDone();
      tracker.markLearningRecorded();
      const result = await bosValidateProtocol(tracker);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.valid).toBe(true);
      expect(parsed.currentStepName).toBe('Record Learning');
      expect(parsed.stepsCompleted).toHaveLength(5);
      expect(parsed.stepsMissing).toHaveLength(0);
    });

    test('includes orderViolations in output', async () => {
      tracker.markMissionCreated();
      const result = await bosValidateProtocol(tracker);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.orderViolations.length).toBeGreaterThan(0);
    });
  });

  describe('T6.12: getState returns correct step values', () => {
    test('getCurrentStep returns 0 initially', () => {
      expect(tracker.getCurrentStep()).toBe(0);
    });

    test('getCurrentStep returns 1 after DNA selected', () => {
      tracker.markDnaSelected();
      expect(tracker.getCurrentStep()).toBe(1);
    });

    test('getState returns a copy not a reference', () => {
      const state = tracker.getState();
      state.dnaSelected = true;
      expect(tracker.isDnaSelected()).toBe(false);
    });
  });
});
