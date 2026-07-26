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

describe('T9: CI Workflows', () => {
  test('T9.1: merge-gate uses pnpm v11', () => {
    const workflow = readFileSync(
      join(ROOT, '.github/workflows/behavioros-merge-gate.yml'),
      'utf-8',
    );
    expect(workflow).toContain('version: 11');
  });

  test('T9.2: merge-gate builds CLI before validate', () => {
    const workflow = readFileSync(
      join(ROOT, '.github/workflows/behavioros-merge-gate.yml'),
      'utf-8',
    );
    expect(workflow).toContain('pnpm --filter @behavioros/cli build');
  });

  test('T9.3: quality-gate does not reference eaarg', () => {
    const workflow = readFileSync(
      join(ROOT, '.github/workflows/behavioros-quality-gate.yml'),
      'utf-8',
    );
    expect(workflow).not.toContain('eaarg');
  });

  test('T9.4: quality-gate uses pnpm v11', () => {
    const workflow = readFileSync(
      join(ROOT, '.github/workflows/behavioros-quality-gate.yml'),
      'utf-8',
    );
    expect(workflow).toContain('version: 11');
  });

  test('T9.5: security.yml targets master branch', () => {
    const workflow = readFileSync(join(ROOT, '.github/workflows/security.yml'), 'utf-8');
    expect(workflow).toContain('master');
    expect(workflow).not.toMatch(/branches: \[main\]/);
  });

  test('T9.6: publish.yml uses --frozen-lockfile', () => {
    const workflow = readFileSync(join(ROOT, '.github/workflows/publish.yml'), 'utf-8');
    expect(workflow).toContain('--frozen-lockfile');
  });
});
