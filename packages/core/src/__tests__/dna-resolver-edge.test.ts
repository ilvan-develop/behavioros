import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { DnaResolver } from '../engines/behavioral/dna-resolver';

vi.mock('node:fs');
vi.mock('yaml');

describe('DnaResolver — edge branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupCatalogMock(catalogData: Record<string, Record<string, unknown>>) {
    const mockedReadFileSync = vi.mocked(readFileSync);
    const mockedParse = vi.mocked(parseYaml);

    mockedReadFileSync.mockImplementation((path: unknown) => {
      const fileName = String(path).split(/[/\\]/).pop() ?? '';
      const name = fileName.replace('.yaml', '');
      if (catalogData[name]) {
        return JSON.stringify(catalogData[name]);
      }
      throw new Error(`ENOENT: ${path}`);
    });

    mockedParse.mockImplementation((content: unknown) => {
      try {
        return JSON.parse(String(content));
      } catch {
        return {};
      }
    });
  }

  function makeBaseDna(): Record<string, unknown> {
    return {
      identity: {
        name: 'Base',
        description: 'Base DNA',
        archetype: 'worker',
        category: 'execution',
      },
      personality: { precision: 'high' },
      principles: [{ id: 'p1', statement: 'Do good', priority: 'high', rationale: 'Quality' }],
      forbidden: [{ id: 'f1', action: 'Skip tests', consequence: 'block', severity: 'critical' }],
      decision_model: {},
      communication: {},
      autonomy: { level: 'low', never_do: ['delete_prod'] },
      risk_tolerance: 'low',
      parallelism: {},
      quality_gates: {},
      learning: {},
    };
  }

  it('should throw when primary DNA not found', () => {
    setupCatalogMock({});
    const resolver = new DnaResolver('/fake');
    expect(() => resolver.resolve({ primary: 'nonexistent' }, { id: 'agent-1' })).toThrow(
      'DNA pattern not found: nonexistent',
    );
  });

  it('should blend secondary DNA into sources list', () => {
    const data = { manufacturing: makeBaseDna(), 'immune-system': makeBaseDna() };
    setupCatalogMock(data);
    const resolver = new DnaResolver('/fake');
    const resolved = resolver.resolve(
      {
        primary: 'manufacturing',
        secondary: 'immune-system',
        blend: { primary: 70, secondary: 30 },
      },
      { id: 'agent-1' },
    );
    const secondarySource = resolved._sources.find((s) => s.includes('immune-system'));
    expect(secondarySource).toContain('30%');
  });

  it('should warn on agent overrides of forbidden entries', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setupCatalogMock({ manufacturing: makeBaseDna() });
    const resolver = new DnaResolver('/fake');
    resolver.resolve(
      { primary: 'manufacturing' },
      {
        id: 'agent-1',
        dnaOverrides: {
          forbidden: [{ id: 'f2', action: 'new', consequence: 'warn', severity: 'medium' }],
        },
      },
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('additive'));
    warnSpy.mockRestore();
  });

  it('should remove autonomy.never_do override and warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setupCatalogMock({ manufacturing: makeBaseDna() });
    const resolver = new DnaResolver('/fake');
    const _resolved = resolver.resolve(
      { primary: 'manufacturing' },
      { id: 'agent-1', dnaOverrides: { autonomy: { never_do: ['override'] } } },
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ignoring'));
    warnSpy.mockRestore();
  });

  it('should list catalog DNAs', () => {
    setupCatalogMock({ manufacturing: makeBaseDna() });
    const resolver = new DnaResolver('/fake');
    const list = resolver.listCatalogDnas();
    expect(list).toContain('manufacturing');
  });

  it('should get a single catalog DNA', () => {
    setupCatalogMock({ manufacturing: makeBaseDna() });
    const resolver = new DnaResolver('/fake');
    const dna = resolver.getCatalogDna('manufacturing');
    expect(dna).toBeDefined();
  });

  it('should return undefined for unknown catalog DNA', () => {
    setupCatalogMock({});
    const resolver = new DnaResolver('/fake');
    expect(resolver.getCatalogDna('nonexistent')).toBeUndefined();
  });

  it('should merge deep with non-object values', () => {
    setupCatalogMock({ manufacturing: makeBaseDna() });
    const resolver = new DnaResolver('/fake');
    const resolved = resolver.resolve(
      { primary: 'manufacturing' },
      { id: 'agent-1', dnaOverrides: { personality: null as any } },
    );
    expect(resolved.personality).toBeDefined();
  });

  it('should use defaults for missing identity fields', () => {
    const minimalDna: Record<string, unknown> = { identity: {} };
    setupCatalogMock({ manufacturing: minimalDna });
    const resolver = new DnaResolver('/fake');
    const resolved = resolver.resolve({ primary: 'manufacturing' }, { id: 'agent-1' });
    expect(resolved.identity.name).toBe('manufacturing');
    expect(resolved.identity.category).toBe('execution');
  });
});
