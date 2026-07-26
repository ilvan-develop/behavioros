import { SkillEngine } from '@behavioros/core';
import { Command } from 'commander';
import { beforeEach, describe, expect, it } from 'vitest';
import { agentCommand } from '../commands/agent.js';

describe('Agent Command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program.name('behavioros-test').version('0.1.0-test');
    agentCommand(program);
  });

  it('should register agent command', () => {
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('agent');
  });

  it('should register subcommands', () => {
    const agent = program.commands.find((c) => c.name() === 'agent');
    expect(agent).toBeDefined();

    const subCommands = agent!.commands.map((c) => c.name());
    expect(subCommands).toContain('list');
    expect(subCommands).toContain('skills');
    expect(subCommands).toContain('validate');
  });

  it('should require --id for skills subcommand', () => {
    const agent = program.commands.find((c) => c.name() === 'agent');
    const skills = agent!.commands.find((c) => c.name() === 'skills');
    expect(skills).toBeDefined();

    const idOption = skills!.options.find((o) => o.long === '--id');
    expect(idOption).toBeDefined();
    expect(idOption!.required).toBe(true);
  });

  it('should require --id and --skills for validate subcommand', () => {
    const agent = program.commands.find((c) => c.name() === 'agent');
    const validate = agent!.commands.find((c) => c.name() === 'validate');
    expect(validate).toBeDefined();

    const idOption = validate!.options.find((o) => o.long === '--id');
    expect(idOption).toBeDefined();
    expect(idOption!.required).toBe(true);

    const skillsOption = validate!.options.find((o) => o.long === '--skills');
    expect(skillsOption).toBeDefined();
    expect(skillsOption!.required).toBe(true);
  });

  it('should return status with agents from SkillEngine', async () => {
    const engine = new SkillEngine();
    const status = await engine.status();
    expect(status).toBeDefined();
    expect(Array.isArray(status.agents)).toBe(true);
    expect(Array.isArray(status.skills)).toBe(true);
    expect(Array.isArray(status.mcps)).toBe(true);
    expect(Array.isArray(status.dnas)).toBe(true);
  });

  it('should validate delegation via SkillEngine', async () => {
    const engine = new SkillEngine();
    const result = await engine.validateDelegation('orchestrator', 'agent-x', [
      'skill-a',
      'skill-b',
    ]);
    expect(result).toBeDefined();
    // Agent has no skills registered, so it should be missing
    expect(result.allowed).toBe(false);
    expect(result.missingSkills).toContain('skill-a');
    expect(result.missingSkills).toContain('skill-b');
  });

  it('should update agent skills after syncFromDNA', async () => {
    const engine = new SkillEngine();
    await engine.syncFromDNA({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      personas: [
        {
          role: 'engineer',
          authority: 'senior',
          skills: ['code-review', 'typescript'],
        },
      ],
    });

    const status = await engine.status();
    expect(status.agents).toHaveLength(1);
    expect(status.agents[0].id).toBe('engineer');
    expect(status.agents[0].skills).toContain('code-review');
    expect(status.agents[0].skills).toContain('typescript');
  });
});
