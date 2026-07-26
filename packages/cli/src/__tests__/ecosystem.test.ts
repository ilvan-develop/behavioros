import { EcosystemRegistry, SkillEngine } from '@behavioros/core';
import { Command } from 'commander';
import { beforeEach, describe, expect, it } from 'vitest';
import { ecosystemCommand } from '../commands/ecosystem.js';

describe('Ecosystem Command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program.name('behavioros-test').version('0.1.0-test');
    ecosystemCommand(program);
  });

  it('should register ecosystem command', () => {
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('ecosystem');
  });

  it('should register subcommands', () => {
    const ecosystem = program.commands.find((c) => c.name() === 'ecosystem');
    expect(ecosystem).toBeDefined();

    const subCommands = ecosystem!.commands.map((c) => c.name());
    expect(subCommands).toContain('status');
    expect(subCommands).toContain('install');
    expect(subCommands).toContain('uninstall');
    expect(subCommands).toContain('sync');
    expect(subCommands).toContain('doctor');
    expect(subCommands).toContain('report');
    expect(subCommands).toContain('stack');
  });

  it('should register stack subcommands', () => {
    const ecosystem = program.commands.find((c) => c.name() === 'ecosystem');
    const stack = ecosystem!.commands.find((c) => c.name() === 'stack');
    expect(stack).toBeDefined();

    const stackCommands = stack!.commands.map((c) => c.name());
    expect(stackCommands).toContain('init');
    expect(stackCommands).toContain('apply');
  });

  it('should require --type for install subcommand', () => {
    const ecosystem = program.commands.find((c) => c.name() === 'ecosystem');
    const install = ecosystem!.commands.find((c) => c.name() === 'install');
    expect(install).toBeDefined();

    const typeOption = install!.options.find((o) => o.long === '--type');
    expect(typeOption).toBeDefined();
    expect(typeOption!.required).toBe(true);
  });

  it('should require --id for install subcommand', () => {
    const ecosystem = program.commands.find((c) => c.name() === 'ecosystem');
    const install = ecosystem!.commands.find((c) => c.name() === 'install');
    const idOption = install!.options.find((o) => o.long === '--id');
    expect(idOption).toBeDefined();
    expect(idOption!.required).toBe(true);
  });

  it('should accept --source option for install', () => {
    const ecosystem = program.commands.find((c) => c.name() === 'ecosystem');
    const install = ecosystem!.commands.find((c) => c.name() === 'install');
    const sourceOption = install!.options.find((o) => o.long === '--source');
    expect(sourceOption).toBeDefined();
  });

  it('should require --id for uninstall subcommand', () => {
    const ecosystem = program.commands.find((c) => c.name() === 'ecosystem');
    const uninstall = ecosystem!.commands.find((c) => c.name() === 'uninstall');
    expect(uninstall).toBeDefined();
    const idOption = uninstall!.options.find((o) => o.long === '--id');
    expect(idOption).toBeDefined();
    expect(idOption!.required).toBe(true);
  });

  it('should accept --source option for sync', () => {
    const ecosystem = program.commands.find((c) => c.name() === 'ecosystem');
    const sync = ecosystem!.commands.find((c) => c.name() === 'sync');
    const sourceOption = sync!.options.find((o) => o.long === '--source');
    expect(sourceOption).toBeDefined();
  });

  it('should accept --format option for report', () => {
    const ecosystem = program.commands.find((c) => c.name() === 'ecosystem');
    const report = ecosystem!.commands.find((c) => c.name() === 'report');
    const formatOption = report!.options.find((o) => o.long === '--format');
    expect(formatOption).toBeDefined();
  });

  it('should require --file for stack apply', () => {
    const ecosystem = program.commands.find((c) => c.name() === 'ecosystem');
    const stack = ecosystem!.commands.find((c) => c.name() === 'stack');
    const apply = stack!.commands.find((c) => c.name() === 'apply');
    const fileOption = apply!.options.find((o) => o.long === '--file');
    expect(fileOption).toBeDefined();
    expect(fileOption!.required).toBe(true);
  });

  it('should generate report via EcosystemRegistry', async () => {
    const registry = new EcosystemRegistry();
    const report = await registry.generateReport();
    expect(report).toBeDefined();
    expect(report.project).toBeDefined();
    expect(report.timestamp).toBeDefined();
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.skills)).toBe(true);
    expect(Array.isArray(report.mcps)).toBe(true);
    expect(Array.isArray(report.dnas)).toBe(true);
  });

  it('should run doctor diagnostics via EcosystemRegistry', async () => {
    const engine = new SkillEngine();
    const registry = new EcosystemRegistry({ skillEngine: engine });
    const result = await registry.doctor();
    expect(result).toBeDefined();
    expect(typeof result.healthy).toBe('boolean');
    expect(result.engines).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(typeof result.stats.totalComponents).toBe('number');
  });

  it('should handle install errors gracefully', async () => {
    const registry = new EcosystemRegistry();
    const result = await registry.install('skill', 'test-skill', 'unknown-source');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown source');
  });
});
