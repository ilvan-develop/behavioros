import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { UIUXProMaxAdapter } from '../engines/adapters/ui-ux-adapter';

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

describe('T4: Ecosystem Adapters', () => {
  test('T4.1: AITMPL adapter is instantiated in core-engine', () => {
    const coreCode = readFileSync(join(ROOT, 'packages/core/src/engines/core-engine.ts'), 'utf-8');
    expect(coreCode).toContain('AITMPLAdapter');
    expect(coreCode).toContain('new AITMPLAdapter');
  });

  test('T4.2: Open Design adapter is instantiated in core-engine', () => {
    const coreCode = readFileSync(join(ROOT, 'packages/core/src/engines/core-engine.ts'), 'utf-8');
    expect(coreCode).toContain('OpenDesignAdapter');
    expect(coreCode).toContain('new OpenDesignAdapter');
  });

  test('T4.3: UI-UX adapter is instantiated in core-engine', () => {
    const coreCode = readFileSync(join(ROOT, 'packages/core/src/engines/core-engine.ts'), 'utf-8');
    expect(coreCode).toContain('UIUXProMaxAdapter');
    expect(coreCode).toContain('new UIUXProMaxAdapter');
  });

  test('T4.4: UI-UX adapter reads CSV files correctly', async () => {
    const skillDir = join(tmpdir(), `uiux-test-${Date.now()}`);
    const dataDir = join(skillDir, 'data');
    mkdirSync(dataDir, { recursive: true });

    writeFileSync(
      join(dataDir, 'palettes.csv'),
      'name,colors,category\n' +
        'sunset,#FF6B35;#F7C59F;#EFEFD0,modern\n' +
        'ocean,#0077B6;#00B4D8;#90E0EF,nature\n',
    );

    const adapter = new UIUXProMaxAdapter();
    (adapter as any).skillPath = skillDir;

    const palettes = await adapter.getPalettes();
    expect(palettes.length).toBeGreaterThan(0);
    expect(palettes[0].name).toBe('sunset');
    expect(palettes[0].colors).toContain('#FF6B35');

    rmSync(skillDir, { recursive: true, force: true });
  });

  test('T4.5: Open Design adapter uses `od` CLI', () => {
    const odCode = readFileSync(
      join(ROOT, 'packages/core/src/engines/adapters/open-design-adapter.ts'),
      'utf-8',
    );
    expect(odCode).toContain('execSync');
    expect(odCode).toContain("'od'");
  });

  test('T4.6: EcosystemRegistry receives all 3 adapters', () => {
    const coreCode = readFileSync(join(ROOT, 'packages/core/src/engines/core-engine.ts'), 'utf-8');
    expect(coreCode).toContain('aitmpl: aitmplAdapter');
    expect(coreCode).toContain('openDesign: openDesignAdapter');
    expect(coreCode).toContain('uiUx: uiuxAdapter');
  });

  test('T4.7: Open Design adapter uses `od mcp install` pattern', () => {
    const odCode = readFileSync(
      join(ROOT, 'packages/core/src/engines/adapters/open-design-adapter.ts'),
      'utf-8',
    );
    expect(odCode).toContain('mcp install');
    expect(odCode).toContain('mcp install');
  });
});
