import { EcosystemRegistry, HandoffProtocol, SkillEngine } from '@behavioros/core';
import { Command } from 'commander';
import { beforeEach, describe, expect, it } from 'vitest';
import { autonomousCommand } from '../commands/autonomous.js';

describe('Autonomous Command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program.name('behavioros-test').version('0.1.0-test');
    autonomousCommand(program);
  });

  it('should register autonomous command', () => {
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('autonomous');
  });

  it('should register subcommands', () => {
    const autonomous = program.commands.find((c) => c.name() === 'autonomous');
    expect(autonomous).toBeDefined();

    const subCommands = autonomous!.commands.map((c) => c.name());
    expect(subCommands).toContain('run');
    expect(subCommands).toContain('status');
    expect(subCommands).toContain('handoffs');
  });

  it('should require --title for run subcommand', () => {
    const autonomous = program.commands.find((c) => c.name() === 'autonomous');
    const run = autonomous!.commands.find((c) => c.name() === 'run');
    expect(run).toBeDefined();

    const titleOption = run!.options.find((o) => o.long === '--title');
    expect(titleOption).toBeDefined();
    expect(titleOption!.required).toBe(true);
  });

  it('should accept --type option for run', () => {
    const autonomous = program.commands.find((c) => c.name() === 'autonomous');
    const run = autonomous!.commands.find((c) => c.name() === 'run');
    const typeOption = run!.options.find((o) => o.long === '--type');
    expect(typeOption).toBeDefined();
  });

  it('should accept --priority option for run', () => {
    const autonomous = program.commands.find((c) => c.name() === 'autonomous');
    const run = autonomous!.commands.find((c) => c.name() === 'run');
    const priorityOption = run!.options.find((o) => o.long === '--priority');
    expect(priorityOption).toBeDefined();
  });

  it('should manage handoffs via HandoffProtocol', async () => {
    const protocol = new HandoffProtocol(10);
    const result = await protocol.request('orchestrator', 'backend-agent', {
      subtask: {
        id: 'sub-1',
        title: 'Implement API',
        type: 'implementation' as const,
        status: 'pending' as const,
        requiredSkill: 'backend',
      },
      missionId: 'mission-1',
    });

    expect(result.handoffId).toBeDefined();
    expect(result.status).toBe('pending');

    // Accept
    await protocol.accept(result.handoffId);

    // List active
    const active = await protocol.listActive();
    expect(active).toHaveLength(1);
    expect(active[0].handoffId).toBe(result.handoffId);
  });

  it('should complete handoffs successfully', async () => {
    const protocol = new HandoffProtocol(10);
    const { handoffId } = await protocol.request('agent-a', 'agent-b', {
      subtask: {
        id: 'sub-2',
        title: 'Test',
        type: 'testing' as const,
        status: 'pending' as const,
        requiredSkill: 'testing',
      },
      missionId: 'mission-2',
    });

    await protocol.accept(handoffId);
    await protocol.complete(handoffId, { result: 'done' });

    const record = await protocol.get(handoffId);
    expect(record).toBeDefined();
    expect(record!.status).toBe('completed');
    expect(record!.output).toEqual({ result: 'done' });
    expect(record!.completedAt).toBeDefined();
  });

  it('should reject handoffs with proper reasons', async () => {
    const protocol = new HandoffProtocol(10);
    const { handoffId } = await protocol.request('agent-a', 'agent-b', {
      subtask: {
        id: 'sub-3',
        title: 'Duplicate',
        type: 'implementation' as const,
        status: 'pending' as const,
        requiredSkill: 'testing',
      },
      missionId: 'mission-3',
    });

    await protocol.reject(handoffId, {
      code: 'SKILL_MISMATCH' as const,
      details: 'Agent does not have the required skill',
    });

    const record = await protocol.get(handoffId);
    expect(record!.status).toBe('rejected');
    expect(record!.rejectionReason?.code).toBe('SKILL_MISMATCH');
  });

  it('should show SkillEngine status', async () => {
    const engine = new SkillEngine();
    const status = await engine.status();
    expect(status.agents).toEqual([]);
    expect(status.skills).toEqual([]);
    expect(status.mcps).toEqual([]);
    expect(status.dnas).toEqual([]);
  });

  it('should return ecosystem report via EcosystemRegistry', async () => {
    const engine = new SkillEngine();
    const registry = new EcosystemRegistry({ skillEngine: engine });
    const report = await registry.generateReport();
    expect(report.project).toBeDefined();
    expect(report.timestamp).toBeDefined();
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.skills)).toBe(true);
  });
});
