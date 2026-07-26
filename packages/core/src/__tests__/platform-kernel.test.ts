import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

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

const ROOT = findWorkspaceRoot();

describe('T6: Platform Kernel Enforcement', () => {
  test('T6.1: opencode.json has instructions array', () => {
    const config = JSON.parse(readFileSync(join(ROOT, 'opencode.json'), 'utf-8'));
    expect(config.instructions).toContain('docs/PROTOCOL.md');
    expect(config.instructions).toContain('AGENTS.md');
  });

  test('T6.2: opencode.json has plugin array with protocol-enforcer', () => {
    const config = JSON.parse(readFileSync(join(ROOT, 'opencode.json'), 'utf-8'));
    expect(config.plugin).toContain('./.opencode/plugins/protocol-enforcer.ts');
  });

  test('T6.3: opencode.json has orchestrator permissions (edit: deny)', () => {
    const config = JSON.parse(readFileSync(join(ROOT, 'opencode.json'), 'utf-8'));
    expect(config.agent.orchestrator.permission.edit).toBe('deny');
  });

  test('T6.4: protocol-enforcer plugin reads .agent_state.json', () => {
    const pluginCode = readFileSync(join(ROOT, '.opencode/plugins/protocol-enforcer.ts'), 'utf-8');
    expect(pluginCode).toContain('.agent_state.json');
    expect(pluginCode).toContain('readFileSync');
  });

  test('T6.5: protocol-enforcer plugin has tool.execute.before hook', () => {
    const pluginCode = readFileSync(join(ROOT, '.opencode/plugins/protocol-enforcer.ts'), 'utf-8');
    expect(pluginCode).toContain('tool.execute.before');
  });

  test('T6.6: .claude/hooks.json exists with PreToolUse', () => {
    const filePath = join(ROOT, '.claude/hooks.json');
    expect(existsSync(filePath)).toBe(true);
    const hooks = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(hooks.hooks.PreToolUse).toBeDefined();
    expect(hooks.hooks.PreToolUse.length).toBeGreaterThan(0);
  });

  test('T6.7: CLAUDE.md contains BehaviorOS kernel instructions', () => {
    const claudeMd = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('BehaviorOS');
    expect(claudeMd).toContain('.agent_state.json');
    expect(claudeMd).toContain('bos_select_dna');
  });

  test('T6.8: .cursor/hooks.json exists with hooks', () => {
    const filePath = join(ROOT, '.cursor/hooks.json');
    expect(existsSync(filePath)).toBe(true);
    const hooks = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(hooks.hooks.sessionStart).toBeDefined();
    expect(hooks.hooks.beforeMCPExecution).toBeDefined();
  });

  test('T6.9: .cursor/rules/behavioros-protocol.mdc exists and references .agent_state.json', () => {
    const filePath = join(ROOT, '.cursor/rules/behavioros-protocol.mdc');
    expect(existsSync(filePath)).toBe(true);
    const rules = readFileSync(filePath, 'utf-8');
    expect(rules).toContain('.agent_state.json');
  });

  test('T6.10: .windsurfrules contains BehaviorOS and .agent_state.json', () => {
    const rules = readFileSync(join(ROOT, '.windsurfrules'), 'utf-8');
    expect(rules).toContain('BehaviorOS');
    expect(rules).toContain('.agent_state.json');
  });

  test('T6.11: .roo/rules/behavioros.md exists', () => {
    const filePath = join(ROOT, '.roo/rules/behavioros.md');
    expect(existsSync(filePath)).toBe(true);
    const rules = readFileSync(filePath, 'utf-8');
    expect(rules).toContain('.agent_state.json');
  });

  test('T6.12: .rules exists with BehaviorOS kernel', () => {
    const filePath = join(ROOT, '.rules');
    expect(existsSync(filePath)).toBe(true);
    const rules = readFileSync(filePath, 'utf-8');
    expect(rules).toContain('BehaviorOS');
    expect(rules).toContain('.agent_state.json');
  });

  test('T6.13: scripts/validate-protocol.js exists', () => {
    expect(existsSync(join(ROOT, 'scripts/validate-protocol.js'))).toBe(true);
  });

  test('T6.14: scripts/read-agent-state.js exists', () => {
    expect(existsSync(join(ROOT, 'scripts/read-agent-state.js'))).toBe(true);
  });

  test('T6.15: scripts/validate-dna.js exists', () => {
    expect(existsSync(join(ROOT, 'scripts/validate-dna.js'))).toBe(true);
  });
});
