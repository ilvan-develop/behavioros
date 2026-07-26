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

describe('T8: Documentation Completeness', () => {
  test('T8.1: README.md exists and has BehaviorOS content', () => {
    expect(existsSync(join(ROOT, 'README.md'))).toBe(true);
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf-8');
    expect(readme).toContain('BehaviorOS');
  });

  test('T8.2: AGENTS.md exists', () => {
    expect(existsSync(join(ROOT, 'AGENTS.md'))).toBe(true);
  });

  test('T8.3: CLAUDE.md exists', () => {
    expect(existsSync(join(ROOT, 'CLAUDE.md'))).toBe(true);
  });

  test('T8.4: .windsurfrules exists', () => {
    expect(existsSync(join(ROOT, '.windsurfrules'))).toBe(true);
  });

  test('T8.5: .rules (for Zed) exists', () => {
    expect(existsSync(join(ROOT, '.rules'))).toBe(true);
  });

  test('T8.6: docs/PROTOCOL.md is source of truth', () => {
    expect(existsSync(join(ROOT, 'docs/PROTOCOL.md'))).toBe(true);
  });
});
