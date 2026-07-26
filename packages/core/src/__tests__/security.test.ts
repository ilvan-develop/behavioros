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

describe('T10: Security', () => {
  test('T10.1: Mission Controller has restricted bash', () => {
    const agent = readFileSync(join(ROOT, '.opencode/agents/mission-controller.md'), 'utf-8');
    expect(agent).toContain('"*": deny');
    expect(agent).toContain('bash');
    expect(agent).not.toMatch(/^\s+bash:\s+allow\s*$/m);
  });

  test('T10.2: Orchestrator has bash: deny', () => {
    const agent = readFileSync(join(ROOT, '.opencode/agents/orchestrator.md'), 'utf-8');
    expect(agent).toContain('bash');
    expect(agent).toContain('"*": deny');
  });

  test('T10.3: opencode.json has orchestrator with edit: deny', () => {
    const config = JSON.parse(readFileSync(join(ROOT, 'opencode.json'), 'utf-8'));
    expect(config.agent.orchestrator.permission.edit).toBe('deny');
  });
});
