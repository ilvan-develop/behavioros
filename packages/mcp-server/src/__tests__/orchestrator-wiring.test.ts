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

describe('T5: Orchestrator Wiring', () => {
  test('T5.1: bos-autonomous-task.ts exists in tools directory', () => {
    expect(existsSync(join(ROOT, 'packages/mcp-server/src/tools/bos-autonomous-task.ts'))).toBe(
      true,
    );
  });

  test('T5.2: bos-autonomous-task is registered in server.ts', () => {
    const serverCode = readFileSync(join(ROOT, 'packages/mcp-server/src/server.ts'), 'utf-8');
    expect(serverCode).toContain('bos-autonomous-task');
    expect(serverCode).toContain('bosAutonomousTask');
  });

  test('T5.3: bos-autonomous-task calls orchestrator.processTask()', () => {
    const toolCode = readFileSync(
      join(ROOT, 'packages/mcp-server/src/tools/bos-autonomous-task.ts'),
      'utf-8',
    );
    expect(toolCode).toContain('processTask');
  });

  test('T5.4: server.ts imports bosAutonomousTask from bos-autonomous-task.js', () => {
    const serverCode = readFileSync(join(ROOT, 'packages/mcp-server/src/server.ts'), 'utf-8');
    expect(serverCode).toContain('bos-autonomous-task.js');
  });
});
