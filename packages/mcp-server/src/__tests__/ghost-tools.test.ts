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

describe('T3: Ghost Tools Registration', () => {
  test('T3.1: bos_validate_protocol tool is registered in server.ts', () => {
    const serverCode = readFileSync(join(ROOT, 'packages/mcp-server/src/server.ts'), 'utf-8');
    expect(serverCode).toContain('bos_validate_protocol');
    expect(serverCode).toContain('bosValidateProtocol');
  });

  test('T3.2: bos_reset_protocol tool is registered in server.ts', () => {
    const serverCode = readFileSync(join(ROOT, 'packages/mcp-server/src/server.ts'), 'utf-8');
    expect(serverCode).toContain('bos_reset_protocol');
    expect(serverCode).toContain('bosResetProtocol');
  });

  test('T3.3: bos-validate-protocol.ts exists in tools directory', () => {
    expect(existsSync(join(ROOT, 'packages/mcp-server/src/tools/bos-validate-protocol.ts'))).toBe(
      true,
    );
  });

  test('T3.4: bos-reset-protocol.ts exists in tools directory', () => {
    expect(existsSync(join(ROOT, 'packages/mcp-server/src/tools/bos-reset-protocol.ts'))).toBe(
      true,
    );
  });

  test('T3.5: server.ts imports both ghost tool files', () => {
    const serverCode = readFileSync(join(ROOT, 'packages/mcp-server/src/server.ts'), 'utf-8');
    expect(serverCode).toContain('bos-validate-protocol.js');
    expect(serverCode).toContain('bos-reset-protocol.js');
  });
});
