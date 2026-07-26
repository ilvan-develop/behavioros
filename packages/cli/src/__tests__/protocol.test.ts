import { PROTOCOL_STEPS, ProtocolStateTracker } from '@behavioros/core';
import { Command } from 'commander';
import { beforeEach, describe, expect, it } from 'vitest';
import { protocolCommand } from '../commands/protocol.js';

describe('Protocol Command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program.name('behavioros-test').version('0.1.0-test');
    protocolCommand(program);
  });

  it('should register protocol command', () => {
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('protocol');
  });

  it('should register subcommands', () => {
    const protocol = program.commands.find((c) => c.name() === 'protocol');
    expect(protocol).toBeDefined();

    const subCommands = protocol!.commands.map((c) => c.name());
    expect(subCommands).toContain('check');
    expect(subCommands).toContain('enforce');
    expect(subCommands).toContain('status');
  });

  it('should require --level for enforce subcommand', () => {
    const protocol = program.commands.find((c) => c.name() === 'protocol');
    const enforce = protocol!.commands.find((c) => c.name() === 'enforce');
    expect(enforce).toBeDefined();

    const levelOption = enforce!.options.find((o) => o.long === '--level');
    expect(levelOption).toBeDefined();
    expect(levelOption!.required).toBe(true);
  });

  it('should return initial status with all steps missing from ProtocolStateTracker', () => {
    const tracker = new ProtocolStateTracker();
    const status = tracker.getStatus();
    expect(status).toBeDefined();
    expect(status.valid).toBe(false);
    expect(status.stepsCompleted).toEqual([]);
    expect(status.stepsMissing).toHaveLength(5);
    expect(status.stepsMissing).toContain('Select DNA');
    expect(status.stepsMissing).toContain('Resolve Truth');
    expect(status.stepsMissing).toContain('Create Mission');
  });

  it('should have 5 protocol step constants defined', () => {
    expect(PROTOCOL_STEPS.DNA_SELECTED).toBe(1);
    expect(PROTOCOL_STEPS.TRUTH_RESOLVED).toBe(2);
    expect(PROTOCOL_STEPS.MISSION_CREATED).toBe(3);
    expect(PROTOCOL_STEPS.AUDIT_DONE).toBe(4);
    expect(PROTOCOL_STEPS.LEARNING_RECORDED).toBe(5);
  });

  it('should track completed steps correctly', () => {
    const tracker = new ProtocolStateTracker();

    // Initially all missing
    expect(tracker.getStatus().stepsCompleted).toHaveLength(0);

    // Mark DNA selected
    tracker.markDnaSelected();
    expect(tracker.getStatus().stepsCompleted).toContain('Select DNA');
    expect(tracker.getStatus().currentStep).toBe(1);

    // Mark truth resolved
    tracker.markTruthResolved();
    expect(tracker.getStatus().stepsCompleted).toContain('Resolve Truth');
    expect(tracker.getStatus().currentStep).toBe(2);

    // Mark mission created
    tracker.markMissionCreated();
    expect(tracker.getStatus().stepsCompleted).toContain('Create Mission');
    expect(tracker.getStatus().currentStep).toBe(3);
  });

  it('should validate before action correctly', () => {
    const tracker = new ProtocolStateTracker();

    // Without DNA selected, should fail
    let validation = tracker.validateBeforeAction();
    expect(validation.valid).toBe(false);
    expect(validation.missing).toContain('Select DNA');

    // After DNA selected, should pass
    tracker.markDnaSelected();
    validation = tracker.validateBeforeAction();
    expect(validation.valid).toBe(true);
    expect(validation.missing).toHaveLength(0);
  });

  it('should detect order violations', () => {
    const tracker = new ProtocolStateTracker();

    // Audit without DNA selected, truth resolved, or mission created
    tracker.markAuditDone();
    const status = tracker.getStatus();
    expect(status.orderViolations.length).toBeGreaterThan(0);
    expect(status.orderViolations.some((v) => v.step === 'Run Audit')).toBe(true);
  });

  it('should reset state correctly', () => {
    const tracker = new ProtocolStateTracker();
    tracker.markDnaSelected();
    tracker.markTruthResolved();
    tracker.markMissionCreated();
    expect(tracker.getStatus().stepsCompleted).toHaveLength(3);

    tracker.reset();
    expect(tracker.getStatus().stepsCompleted).toHaveLength(0);
    expect(tracker.getStatus().currentStep).toBe(0);
  });
});
