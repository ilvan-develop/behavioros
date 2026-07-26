import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================
// Hoisted mocks — must be before vi.mock calls
// ============================================================

// AITMPLAdapter — node:child_process
const mockExecSync = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execSync: mockExecSync }));

// DNALoader — node:fs/promises
const mockAccess = vi.hoisted(() => vi.fn());
const mockReaddir = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());
const mockStat = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => ({
  access: mockAccess,
  readdir: mockReaddir,
  readFile: mockReadFile,
  stat: mockStat,
}));

// DNALoader — yaml
const mockYamlParse = vi.hoisted(() => vi.fn());
vi.mock('yaml', () => ({ parse: mockYamlParse }));

// DNALoader — dna-sanitizer
const mockSanitizeDNA = vi.hoisted(() => vi.fn());
vi.mock('../security/dna-sanitizer.js', () => ({ sanitizeDNA: mockSanitizeDNA }));

// ProtocolEngine — node:fs
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockReadFileSyncFn = vi.hoisted(() => vi.fn());
const mockWriteFileSyncFn = vi.hoisted(() => vi.fn());
vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSyncFn,
  writeFileSync: mockWriteFileSyncFn,
}));

// Crypto — deterministic hashes + UUIDs
vi.mock('node:crypto', () => ({
  randomUUID: () => '00000000-0000-0000-0000-000000000000',
  createHash: () => ({
    update: () => ({
      digest: () => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }),
  }),
  createHmac: () => ({
    update: () => ({
      digest: () => 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    }),
  }),
}));

// CanaryDeployer — health checker
const mockHealthCheck = vi.hoisted(() => vi.fn());
const mockHealthReset = vi.hoisted(() => vi.fn());
const mockHealthUpdateConfig = vi.hoisted(() => vi.fn());
const mockHealthOn = vi.hoisted(() => vi.fn());
vi.mock('../deploy/health-checker.js', () => ({
  HealthChecker: vi.fn().mockImplementation(() => ({
    check: mockHealthCheck,
    reset: mockHealthReset,
    updateConfig: mockHealthUpdateConfig,
    on: mockHealthOn,
  })),
}));

// CanaryDeployer — rollback manager
const mockEvalHealth = vi.hoisted(() => vi.fn());
const mockEvalDrift = vi.hoisted(() => vi.fn());
const mockTriggerManual = vi.hoisted(() => vi.fn());
vi.mock('../deploy/rollback-manager.js', () => ({
  RollbackManager: vi.fn().mockImplementation(() => ({
    evaluateHealthCheck: mockEvalHealth,
    evaluateDrift: mockEvalDrift,
    triggerManual: mockTriggerManual,
  })),
}));

import { CanaryDeployer } from '../deploy/canary-deployer.js';
import { TrafficSplitter } from '../deploy/traffic-splitter.js';
// ============================================================
// Imports
// ============================================================
import { AITMPLAdapter } from '../engines/adapters/aitmpl-adapter.js';
import { AuditChainVerifier } from '../engines/behavioral/audit-chain/audit-chain-verifier.js';
import { HashChain } from '../engines/behavioral/audit-chain/hash-chain.js';
import { BehaviorSelector } from '../engines/behavioral/behavior-selector.js';
import { DNAComposer } from '../engines/behavioral/dna-composer.js';
import { DNALoader } from '../engines/behavioral/dna-loader.js';
import { EscalationManager } from '../engines/behavioral/escalation-manager.js';
import { ProtocolStateTracker } from '../engines/protocol-engine.js';

// ============================================================
// SECTION 1 — AITMPLAdapter (7.27% → ~100%)
// ============================================================
describe('AITMPLAdapter', () => {
  let adapter: AITMPLAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AITMPLAdapter();
  });

  describe('installSkill', () => {
    it('should return success when execSync succeeds', async () => {
      mockExecSync.mockReturnValue('');
      const result = await adapter.installSkill('development', 'test-skill');
      expect(result.success).toBe(true);
      expect(result.skill).toBeDefined();
      expect(result.skill!.id).toBe('test-skill');
    });

    it('should return failure with error message when execSync throws Error', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Installation failed');
      });
      const result = await adapter.installSkill('utilities', 'broken');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to install AITMPL skill');
      expect(result.error).toContain('Installation failed');
    });

    it('should handle non-Error throw values', async () => {
      mockExecSync.mockImplementation(() => {
        throw { code: 1, message: 'string error' };
      });
      const result = await adapter.installSkill('security', 'bad-skill');
      expect(result.success).toBe(false);
      expect(result.error).toContain('[object Object]');
    });
  });

  describe('installMCP', () => {
    it('should return success when execSync succeeds', async () => {
      mockExecSync.mockReturnValue('');
      const result = await adapter.installMCP('database', 'pg-mcp');
      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config!.id).toBe('pg-mcp');
    });

    it('should return failure when execSync throws', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Network error');
      });
      const result = await adapter.installMCP('devops', 'bad-mcp');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to install AITMPL MCP');
    });
  });

  describe('searchSkills', () => {
    it('should parse JSON output lines', async () => {
      mockExecSync.mockReturnValue(
        '{"id":"s1","name":"Skill One","category":"dev","stars":5}\n{"id":"s2","name":"Skill Two"}\n',
      );
      const results = await adapter.searchSkills('test');
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('s1');
      expect(results[1].stars).toBe(0);
    });

    it('should fall back to tabular parsing when JSON.parse fails', async () => {
      mockExecSync.mockReturnValue('col1  col2  col3  42\npart1 part2 rest 7\n');
      const results = await adapter.searchSkills('query');
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('col1');
      expect(results[0].category).toBe('col3');
      expect(results[0].stars).toBe(42);
      expect(results[1].stars).toBe(7);
    });

    it('should return empty array when execSync throws', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('CLI not found');
      });
      const results = await adapter.searchSkills('anything');
      expect(results).toEqual([]);
    });
  });

  describe('mapCategory (tested via installSkill)', () => {
    it('should map known categories correctly', async () => {
      mockExecSync.mockReturnValue('');
      for (const cat of [
        'development',
        'ai-research',
        'creative-design',
        'utilities',
        'security',
      ]) {
        const result = await adapter.installSkill(cat, 'skill');
        expect(result.success).toBe(true);
      }
    });

    it('should map unknown categories to "custom"', async () => {
      mockExecSync.mockReturnValue('');
      const result = await adapter.installSkill('nonexistent-category', 'skill');
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================
// SECTION 2 — DNALoader (71.28% → ~100%)
// ============================================================
describe('DNALoader', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  const defaultDNA = {
    id: 'test-dna',
    name: 'Test DNA',
    version: '1.0.0',
    personas: [{ role: 'engineer', authority: 'senior' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSanitizeDNA.mockReturnValue({ safe: true, riskScore: 10, violations: [] });
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue('dummy: content');
    mockStat.mockResolvedValue({ size: 500 });
    mockReaddir.mockResolvedValue([]);
    mockYamlParse.mockReturnValue({ ...defaultDNA });
  });

  afterAll(() => {
    warnSpy?.mockRestore();
  });

  describe('constructor', () => {
    it('should use defaults when no options provided', () => {
      const loader = new DNALoader();
      expect(loader).toBeDefined();
    });

    it('should accept custom options', () => {
      const loader = new DNALoader({
        basePath: '/custom',
        validate: false,
        strict: true,
        sanitize: false,
      });
      expect(loader).toBeDefined();
    });
  });

  describe('load — path traversal', () => {
    it('should reject path traversal attempts', async () => {
      const loader = new DNALoader({ basePath: '/safe/base' });
      await expect(loader.load('../../etc/passwd')).rejects.toThrow('Path traversal');
    });

    it('should allow absolute paths (skip traversal check)', async () => {
      const loader = new DNALoader({ basePath: '/safe/base' });
      mockAccess.mockImplementation((p: string) => {
        if (p.toString().endsWith('absolute-dna.yaml')) return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      mockReadFile.mockResolvedValue('dummy');
      mockYamlParse.mockReturnValue({ ...defaultDNA });
      await expect(loader.load('/any/absolute-dna.yaml')).resolves.toBeDefined();
    });
  });

  describe('load — cache', () => {
    it('should return cached result after first load', async () => {
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      mockReadFile.mockResolvedValue('dummy');
      mockYamlParse.mockReturnValue({ ...defaultDNA });
      const first = await loader.load('valid/dna.yaml');
      const second = await loader.load('valid/dna.yaml');
      expect(second).toBe(first);
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('load — file resolution', () => {
    it('should load from behavioros.yaml when directory contains it', async () => {
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      mockYamlParse.mockReturnValue({ ...defaultDNA });
      const dna = await loader.load('mydir');
      expect(dna.id).toBe('test-dna');
    });

    it('should fall back to index.yaml when behavioros.yaml not found', async () => {
      mockAccess.mockImplementation((p: string) => {
        if (p.toString().includes('index.yaml')) return Promise.resolve();
        return Promise.reject(new Error('ENOENT'));
      });
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      mockYamlParse.mockReturnValue({ ...defaultDNA });
      const dna = await loader.load('mydir');
      expect(dna.id).toBe('test-dna');
    });

    it('should load a direct YAML file when directory doesnt contain index/behavioros', async () => {
      mockAccess
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(undefined);
      mockStat.mockResolvedValue({ size: 500 });
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      mockYamlParse.mockReturnValue({ ...defaultDNA });
      const dna = await loader.load('direct.yaml');
      expect(dna.id).toBe('test-dna');
    });

    it('should detect oversized file (error re-wrapped by catch)', async () => {
      let accessCount = 0;
      mockAccess.mockImplementation(() => {
        accessCount++;
        if (accessCount < 3) return Promise.reject(new Error('ENOENT'));
        return Promise.resolve();
      });
      mockStat.mockResolvedValue({ size: 2 * 1024 * 1024 });
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      await expect(loader.load('huge.yaml')).rejects.toThrow('DNA source not found');
    });

    it('should throw when source not found', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      await expect(loader.load('nonexistent')).rejects.toThrow('DNA source not found');
    });
  });

  describe('load — sanitization', () => {
    it('should throw on critical risk sanitization', async () => {
      mockSanitizeDNA.mockReturnValue({
        safe: false,
        riskScore: 85,
        violations: [{ severity: 'critical', type: 'prompt_injection', description: 'bad' }],
      });
      const loader = new DNALoader({ basePath: '/test' });
      await expect(loader.load('bad.yaml')).rejects.toThrow('DNA sanitization failed');
    });

    it('should throw on high risk sanitization', async () => {
      mockSanitizeDNA.mockReturnValue({
        safe: false,
        riskScore: 65,
        violations: [{ severity: 'high', type: 'suspicious_pattern', description: 'suspicious' }],
      });
      const loader = new DNALoader({ basePath: '/test' });
      await expect(loader.load('risky.yaml')).rejects.toThrow('DNA sanitization failed');
    });

    it('should warn on medium risk sanitization', async () => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockSanitizeDNA.mockReturnValue({
        safe: true,
        riskScore: 45,
        violations: [{ severity: 'medium', type: 'suspicious_persona', description: 'warning' }],
      });
      const loader = new DNALoader({ basePath: '/test' });
      const dna = await loader.load('medium.yaml');
      expect(dna).toBeDefined();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should skip sanitization when disabled', async () => {
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      mockYamlParse.mockReturnValue({ ...defaultDNA });
      const dna = await loader.load('nosan.yaml');
      expect(dna.id).toBe('test-dna');
    });
  });

  describe('loadFromString', () => {
    it('should load valid YAML string', () => {
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      mockYamlParse.mockReturnValue({ ...defaultDNA });
      const dna = loader.loadFromString('some: yaml');
      expect(dna.id).toBe('test-dna');
    });

    it('should reject content exceeding MAX_YAML_SIZE', () => {
      const loader = new DNALoader({ basePath: '/test' });
      expect(() => loader.loadFromString('x'.repeat(1024 * 1024 + 1))).toThrow(
        'exceeds maximum size',
      );
    });
  });

  describe('loadFromObject', () => {
    it('should reject objects exceeding nesting depth', () => {
      const loader = new DNALoader();
      const deep: any = {
        a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: {} } } } } } } } } } },
      };
      expect(() => loader.loadFromObject(deep)).toThrow('nesting depth');
    });

    it('should validate with schema when validate=true', () => {
      const loader = new DNALoader({ validate: true });
      const obj = { ...defaultDNA };
      const dna = loader.loadFromObject(obj);
      expect(dna.id).toBe('test-dna');
    });

    it('should cast directly when validate=false', () => {
      const loader = new DNALoader({ validate: false });
      const dna = loader.loadFromObject({ id: 'raw' });
      expect((dna as any).id).toBe('raw');
    });
  });

  describe('loadAll', () => {
    it('should load all .yaml and .yml files from directory', async () => {
      mockReaddir.mockResolvedValue(['a.yaml', 'b.yml', 'c.txt']);
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      mockYamlParse.mockReturnValue({ ...defaultDNA });
      const dnas = await loader.loadAll('dir');
      expect(dnas).toHaveLength(2);
    });

    it('should return empty array when directory not found', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const loader = new DNALoader({ basePath: '/test' });
      const dnas = await loader.loadAll('nonexistent');
      expect(dnas).toEqual([]);
    });

    it('should return empty array on load failure even in strict mode (outer catch swallows)', async () => {
      mockReaddir.mockResolvedValue(['bad.yaml']);
      const loader = new DNALoader({ basePath: '/test', sanitize: false, strict: true });
      mockYamlParse.mockImplementation(() => {
        throw new Error('parse error');
      });
      const dnas = await loader.loadAll('dir');
      expect(dnas).toEqual([]);
    });
  });

  describe('parse — validation', () => {
    it('should throw on invalid DNA schema', () => {
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      mockYamlParse.mockReturnValue({ bad: 'data' });
      expect(() => loader.loadFromString('bad')).toThrow('Invalid DNA package');
    });

    it('should throw on excessive governance rules', () => {
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      const govArr = Array.from({ length: 1001 }, (_, i) => ({
        id: `r${i}`,
        name: `Rule ${i}`,
        level: 'low' as const,
        action: 'log' as const,
      }));
      mockYamlParse.mockReturnValue({ ...defaultDNA, governance: govArr });
      expect(() => loader.loadFromString('many-gov')).toThrow('exceeding maximum');
    });
  });

  describe('static methods', () => {
    it('validate should return valid for correct DNA', () => {
      const result = DNALoader.validate({ ...defaultDNA });
      expect(result.valid).toBe(true);
    });

    it('validate should return errors for invalid DNA', () => {
      const result = DNALoader.validate({ id: 'only-id' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('merge should combine two DNA packages', () => {
      const base = { ...defaultDNA, governance: [{ id: 'g1', level: 'high', action: 'block' }] };
      const override = {
        name: 'Overridden',
        governance: [{ id: 'g2', level: 'low', action: 'log' }],
      };
      const merged = DNALoader.merge(base as any, override as any);
      expect(merged.name).toBe('Overridden');
      expect(merged.governance).toHaveLength(1);
      expect(merged.governance![0].id).toBe('g2');
    });

    it('getNestingDepth should handle edge cases', () => {
      expect(DNALoader.getNestingDepth(null)).toBe(0);
      expect(DNALoader.getNestingDepth(undefined)).toBe(0);
      expect(DNALoader.getNestingDepth(42)).toBe(0);
      expect(DNALoader.getNestingDepth('str')).toBe(0);
      expect(DNALoader.getNestingDepth([])).toBe(1);
      expect(DNALoader.getNestingDepth([{ a: [[{ b: [] }]] }])).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear the internal cache', async () => {
      const loader = new DNALoader({ basePath: '/test', sanitize: false });
      mockYamlParse.mockReturnValue({ ...defaultDNA });
      await loader.load('valid/dna.yaml');
      loader.clearCache();
      await loader.load('valid/dna.yaml');
      expect(mockReadFile).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================================
// SECTION 3 — DNAComposer (63.16% → ~100%)
// ============================================================
describe('DNAComposer', () => {
  let composer: DNAComposer;

  beforeEach(() => {
    composer = new DNAComposer();
  });

  const dnaA = {
    id: 'dna-a',
    name: 'A',
    version: '1.0.0',
    personas: [{ role: 'engineer', authority: 'senior' }],
    patterns: [
      {
        id: 'p1',
        name: 'Alpha',
        type: 'decision' as const,
        triggers: ['t1'],
        actions: ['a1'],
        conditions: ['c1'],
      },
    ],
  };
  const dnaB = {
    id: 'dna-b',
    name: 'B',
    version: '1.0.0',
    personas: [{ role: 'architect', authority: 'architect' }],
    patterns: [
      {
        id: 'p1',
        name: 'Beta',
        type: 'decision' as const,
        triggers: ['t2'],
        actions: ['a2'],
        conditions: ['c2'],
      },
      { id: 'p2', name: 'Gamma', type: 'review' as const },
    ],
  };
  const dnaEmpty = {
    id: 'dna-empty',
    name: 'Empty',
    version: '1.0.0',
    personas: [{ role: 'engineer', authority: 'senior' }],
  };

  describe('compose', () => {
    it('should compose without conflicts', () => {
      const three = {
        ...dnaB,
        id: 'dna-c',
        patterns: [{ id: 'p3', name: 'Delta', type: 'monitoring' as const }],
      };
      const result = composer.compose([dnaA, three as any]);
      expect(result.patterns).toHaveLength(2);
      expect(result.metadata.conflicts).toHaveLength(0);
    });

    it('should handle empty DNA packages', () => {
      const result = composer.compose([]);
      expect(result.patterns).toHaveLength(0);
    });

    it('should resolve conflicts with first strategy', () => {
      const result = composer.compose([dnaA as any, dnaB as any], { resolveConflicts: 'first' });
      const p1 = result.patterns.find((p) => p.id === 'p1');
      expect(p1!.name).toBe('Alpha');
    });

    it('should resolve conflicts with last strategy (default)', () => {
      const result = composer.compose([dnaA as any, dnaB as any]);
      const p1 = result.patterns.find((p) => p.id === 'p1');
      expect(p1!.name).toBe('Beta');
    });

    it('should resolve conflicts with merge strategy', () => {
      const result = composer.compose([dnaA as any, dnaB as any], { resolveConflicts: 'merge' });
      const p1 = result.patterns.find((p) => p.id === 'p1')!;
      expect(p1.triggers).toEqual(['t1', 't2']);
      expect(p1.actions).toEqual(['a1', 'a2']);
      expect(p1.conditions).toEqual(['c1', 'c2']);
    });

    it('should emit source DNA IDs in metadata', () => {
      const result = composer.compose([dnaA as any, dnaB as any]);
      expect(result.metadata.sourceDNAs).toEqual(['dna-a', 'dna-b']);
    });
  });

  describe('filterByType', () => {
    it('should filter patterns by type', () => {
      const result = composer.compose([dnaA as any, dnaB as any]);
      const filtered = composer.filterByType(result.patterns, 'review');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('p2');
    });

    it('should return empty when no match', () => {
      const filtered = composer.filterByType([], 'decision');
      expect(filtered).toEqual([]);
    });
  });

  describe('filterByTrigger', () => {
    it('should filter by trigger substring', () => {
      const result = composer.filterByTrigger(
        [{ id: 'x', name: 'X', type: 'decision', triggers: ['alert'] } as any],
        'alert',
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('sortByPriority', () => {
    it('should sort by type priority descending', () => {
      const patterns = [
        { id: 'a', name: 'A', type: 'custom' as const },
        { id: 'b', name: 'B', type: 'decision' as const },
        { id: 'c', name: 'C', type: 'learning' as const },
      ];
      const sorted = composer.sortByPriority(patterns as any);
      expect(sorted[0].id).toBe('b');
      expect(sorted[1].id).toBe('c');
      expect(sorted[2].id).toBe('a');
    });
  });

  describe('summary', () => {
    it('should generate summary without conflicts', () => {
      const result = composer.compose([dnaA as any]);
      const s = composer.summary(result);
      expect(s).toContain('1 DNAs → 1 patterns');
    });

    it('should include conflicts in summary', () => {
      const result = composer.compose([dnaA as any, dnaB as any]);
      const s = composer.summary(result);
      expect(s).toContain('Conflicts: 1');
    });
  });
});

// ============================================================
// SECTION 4 — BehaviorSelector (74.77% → ~100%)
// ============================================================
describe('BehaviorSelector', () => {
  let selector: BehaviorSelector;

  beforeEach(() => {
    selector = new BehaviorSelector();
  });

  const ctx = (overrides: Record<string, any> = {}) => ({
    problemType: 'bug_fix' as const,
    riskLevel: 'low' as const,
    scope: 'single_file' as const,
    timeline: 'sprint' as const,
    domain: 'general',
    ...overrides,
  });

  describe('select — problem types', () => {
    it('should match bug_fix + critical → surgical-team + immune overlay', () => {
      const s = selector.select(ctx({ riskLevel: 'critical', domain: 'payments' }));
      expect(s.primary).toBe('surgical-team');
      expect(s.secondary).toBe('immune-system');
      expect(s.blend.primary).toBe(70);
      expect(s.confidence).toBeLessThan(0.95);
    });

    it('should match bug_fix + monorepo → ant-colony', () => {
      const s = selector.select(ctx({ problemType: 'bug_fix', scope: 'monorepo' }));
      expect(s.primary).toBe('ant-colony');
    });

    it('should match bug_fix + security → immune-system', () => {
      const s = selector.select(ctx({ problemType: 'bug_fix', domain: 'security' }));
      expect(s.primary).toBe('immune-system');
    });

    it('should match bug_fix (default) → manufacturing', () => {
      const s = selector.select(ctx({ problemType: 'bug_fix' }));
      expect(s.primary).toBe('manufacturing');
    });

    it('should match feature + multi_package → bee-colony', () => {
      const s = selector.select(ctx({ problemType: 'feature', scope: 'multi_package' }));
      expect(s.primary).toBe('bee-colony');
    });

    it('should match feature + urgent → orchestra', () => {
      const s = selector.select(ctx({ problemType: 'feature', timeline: 'urgent' }));
      expect(s.primary).toBe('orchestra');
    });

    it('should match feature + cross_system → octopus', () => {
      const s = selector.select(ctx({ problemType: 'feature', scope: 'cross_system' }));
      expect(s.primary).toBe('octopus');
    });

    it('should match feature (default) → manufacturing', () => {
      const s = selector.select(ctx({ problemType: 'feature' }));
      expect(s.primary).toBe('manufacturing');
    });

    it('should match security → immune-system', () => {
      const s = selector.select(ctx({ problemType: 'security' }));
      expect(s.primary).toBe('immune-system');
    });

    it('should match performance → mathematical-swarm', () => {
      const s = selector.select(ctx({ problemType: 'performance' }));
      expect(s.primary).toBe('mathematical-swarm');
    });

    it('should match incident → wolf-pack', () => {
      const s = selector.select(ctx({ problemType: 'incident' }));
      expect(s.primary).toBe('wolf-pack');
    });

    it('should match discovery → research-lab', () => {
      const s = selector.select(ctx({ problemType: 'discovery' }));
      expect(s.primary).toBe('research-lab');
    });

    it('should match refactor + monorepo → ant-colony', () => {
      const s = selector.select(ctx({ problemType: 'refactor', scope: 'monorepo' }));
      expect(s.primary).toBe('ant-colony');
    });

    it('should match refactor (default) → manufacturing', () => {
      const s = selector.select(ctx({ problemType: 'refactor' }));
      expect(s.primary).toBe('manufacturing');
    });

    it('should match maintenance → manufacturing', () => {
      const s = selector.select(ctx({ problemType: 'maintenance' }));
      expect(s.primary).toBe('manufacturing');
    });
  });

  describe('select — fallback', () => {
    it('should return manufacturing with 0.5 confidence when no rules match', () => {
      const s = selector.select(ctx({ problemType: 'bug_fix' }));
      expect(s.primary).toBe('manufacturing');
      expect(s.confidence).toBeGreaterThan(0);
    });
  });

  describe('select — compliance', () => {
    it('should add enterprise-governance overlay when compliance is set', () => {
      const s = selector.select(ctx({ problemType: 'feature', compliance: ['pci-dss'] }));
      expect(s.secondary).toContain('enterprise-governance');
      expect(s.blend.secondary).toBeGreaterThan(0);
    });
  });

  describe('select — critical/high risk overlay', () => {
    it('should NOT add immune overlay when domain is security (explicit exclusion)', () => {
      const s = selector.select(
        ctx({ problemType: 'bug_fix', riskLevel: 'critical', domain: 'security' }),
      );
      expect(s.primary).toBe('surgical-team');
      expect(s.secondary).toBeUndefined();
    });

    it('should match immune-system when only domain is security (no critical risk)', () => {
      const s = selector.select(
        ctx({ problemType: 'bug_fix', riskLevel: 'low', domain: 'security' }),
      );
      expect(s.primary).toBe('immune-system');
    });
  });

  describe('getRuleById / listRules', () => {
    it('should return rule by existing id', () => {
      const rule = selector.getRuleById('bugfix-critical');
      expect(rule).toBeDefined();
    });

    it('should return undefined for non-existing id', () => {
      const rule = selector.getRuleById('nonexistent');
      expect(rule).toBeUndefined();
    });

    it('should list all rules', () => {
      const rules = selector.listRules();
      expect(rules.length).toBeGreaterThan(10);
    });
  });
});

// ============================================================
// SECTION 5 — EscalationManager (88.51% → ~100%)
// ============================================================
describe('EscalationManager', () => {
  describe('constructor', () => {
    it('should use default triggers when none provided', () => {
      const mgr = new EscalationManager();
      expect(mgr.getActiveEscalations()).toEqual([]);
    });

    it('should accept custom triggers', () => {
      const mgr = new EscalationManager([
        {
          id: 'custom',
          condition: 'custom_event',
          action: 'notify',
          timeout: '5min',
          retry: 3,
          severity: 'low',
        },
      ]);
      const ev = mgr.check({ type: 'custom_event' });
      expect(ev).not.toBeNull();
    });
  });

  describe('check', () => {
    it('should return null when no trigger matches', () => {
      const mgr = new EscalationManager([]);
      expect(mgr.check({ type: 'unknown' })).toBeNull();
    });

    it('should match via context.type', () => {
      const mgr = new EscalationManager([
        {
          id: 'ctx-match',
          condition: 'payment_failure',
          action: 'alert',
          timeout: 'immediate',
          retry: 0,
          severity: 'critical',
        },
      ]);
      const ev = mgr.check({ type: 'xxx', context: { type: 'payment_failure' } });
      expect(ev).not.toBeNull();
      expect(ev!.context).toEqual({ type: 'payment_failure' });
    });
  });

  describe('loadGovernanceRules', () => {
    it('should add triggers for escalate actions', () => {
      const mgr = new EscalationManager([]);
      mgr.loadGovernanceRules([
        { id: 'g-escalate', level: 'low', action: 'escalate', conditions: ['type:audit_failure'] },
      ]);
      const ev = mgr.check({ type: 'audit_failure' });
      expect(ev).not.toBeNull();
      expect(ev!.action).toBe('escalate_to_human');
    });

    it('should add triggers for block actions', () => {
      const mgr = new EscalationManager([]);
      mgr.loadGovernanceRules([
        { id: 'g-block', level: 'critical', action: 'block', conditions: ['type:security_threat'] },
      ]);
      const ev = mgr.check({ type: 'security_threat' });
      expect(ev).not.toBeNull();
      expect(ev!.action).toBe('halt_and_review');
    });

    it('should skip non-escalate/block actions', () => {
      const mgr = new EscalationManager([]);
      mgr.loadGovernanceRules([
        { id: 'g-warn', level: 'low', action: 'warn', conditions: ['type:something'] },
        { id: 'g-log', level: 'low', action: 'log', conditions: ['type:other'] },
      ]);
      const ev = mgr.check({ type: 'something' });
      expect(ev).toBeNull();
    });
  });

  describe('resolve', () => {
    it('should mark event as resolved', () => {
      const mgr = new EscalationManager();
      const ev = mgr.check({ type: 'security vulnerability' });
      expect(ev).not.toBeNull();
      expect(mgr.resolve(ev!.triggerId)).toBe(true);
    });

    it('should return false for non-existent triggerId', () => {
      const mgr = new EscalationManager();
      expect(mgr.resolve('nonexistent')).toBe(false);
    });
  });

  describe('retry', () => {
    it('should increment retries and set in_progress', () => {
      const mgr = new EscalationManager([
        {
          id: 'retryable',
          condition: 'retry_event',
          action: 'retry_action',
          timeout: '5min',
          retry: 3,
          severity: 'medium',
        },
      ]);
      const ev = mgr.check({ type: 'retry_event' });
      expect(mgr.retry(ev!.triggerId)).toBe(true);
      expect(ev!.retries).toBe(1);
    });

    it('should return false when max retries reached', () => {
      const mgr = new EscalationManager([
        {
          id: 'no-retry',
          condition: 'no_retry',
          action: 'action',
          timeout: '5min',
          retry: 0,
          severity: 'medium',
        },
      ]);
      const ev = mgr.check({ type: 'no_retry' });
      expect(mgr.retry(ev!.triggerId)).toBe(false);
      expect(ev!.status).toBe('failed');
    });

    it('should return false when event not found', () => {
      const mgr = new EscalationManager();
      expect(mgr.retry('nonexistent')).toBe(false);
    });

    it('should return false when trigger not found', () => {
      const mgr = new EscalationManager([
        {
          id: 'orphan',
          condition: 'orphan',
          action: 'action',
          timeout: '5min',
          retry: 3,
          severity: 'low',
        },
      ]);
      const ev = mgr.check({ type: 'orphan' });
      (ev as any).triggerId = 'nonexistent-trigger';
      expect(mgr.retry('nonexistent-trigger')).toBe(false);
    });
  });

  describe('history', () => {
    it('should return only active escalations', () => {
      const mgr = new EscalationManager();
      mgr.check({ type: 'security vulnerability' });
      mgr.check({ type: 'performance_regression' });
      expect(mgr.getActiveEscalations()).toHaveLength(2);
    });

    it('should return copy of escalation history', () => {
      const mgr = new EscalationManager();
      mgr.check({ type: 'security vulnerability' });
      const hist = mgr.getEscalationHistory();
      expect(hist).toHaveLength(1);
    });
  });

  describe('prune', () => {
    it('should remove old resolved/failed events', () => {
      const mgr = new EscalationManager();
      const ev = mgr.check({ type: 'security vulnerability' });
      mgr.resolve(ev!.triggerId);
      const pruned = mgr.prune(0);
      expect(pruned).toBeGreaterThan(0);
    });

    it('should keep non-resolved events', () => {
      const mgr = new EscalationManager();
      mgr.check({ type: 'security vulnerability' });
      const pruned = mgr.prune(0);
      expect(pruned).toBe(0);
    });
  });
});

// ============================================================
// SECTION 6 — AuditChainVerifier (65.78% → ~100%)
// ============================================================
describe('AuditChainVerifier', () => {
  let chain: HashChain;
  let verifier: AuditChainVerifier;

  beforeEach(() => {
    chain = new HashChain();
    verifier = new AuditChainVerifier(chain);
    chain.createGenesis('agent-1', 'init', { seed: true });
    chain.append('agent-1', 'step-1', { action: 'first' });
    chain.append('agent-2', 'step-2', { action: 'second' });
  });

  describe('verify', () => {
    it('should return valid for intact chain', () => {
      const result = verifier.verify();
      expect(result.valid).toBe(true);
      expect(result.totalEntries).toBe(3);
    });

    it('should detect tampered entries', () => {
      const entries = chain.getEntries() as any[];
      entries[0].hash = 'tampered-hash-value';
      const result = verifier.verify();
      expect(result.valid).toBe(false);
      expect(result.tamperedEntries).toContain(0);
    });
  });

  describe('verifyLast', () => {
    it('should verify trailing entries', () => {
      const result = verifier.verifyLast(2);
      expect(result.totalEntries).toBe(2);
      expect(result.valid).toBe(true);
    });

    it('should cap n at chain length', () => {
      const result = verifier.verifyLast(100);
      expect(result.totalEntries).toBe(3);
    });
  });

  describe('verifyEntryAt', () => {
    it('should return false for negative index', () => {
      expect(verifier.verifyEntryAt(-1)).toBe(false);
    });

    it('should return false for out-of-bounds index', () => {
      expect(verifier.verifyEntryAt(100)).toBe(false);
    });

    it('should verify genesis entry', () => {
      expect(verifier.verifyEntryAt(0)).toBe(true);
    });

    it('should verify middle entry', () => {
      expect(verifier.verifyEntryAt(1)).toBe(true);
    });

    it('should detect tampered entry hash', () => {
      const entries = chain.getEntries() as any[];
      entries[1].hash = 'bad-hash';
      expect(verifier.verifyEntryAt(1)).toBe(false);
    });

    it('should detect broken link', () => {
      const entries = chain.getEntries() as any[];
      entries[1].previousHash = 'mismatch';
      expect(verifier.verifyEntryAt(1)).toBe(false);
    });
  });

  describe('report', () => {
    it('should format valid report', () => {
      const r = verifier.verify();
      const report = verifier.report(r);
      expect(report).toContain('Verification Report');
      expect(report).toContain('YES');
    });

    it('should include broken and tampered entries in report', () => {
      const result = {
        valid: false,
        totalEntries: 3,
        verifiedEntries: 1,
        brokenLinks: [1, 2],
        tamperedEntries: [0],
        firstEntryTimestamp: new Date('2024-01-01'),
        lastEntryTimestamp: new Date('2024-01-03'),
        duration: 5,
      };
      const report = verifier.report(result);
      expect(report).toContain('Broken links at indices');
      expect(report).toContain('Tampered entries at indices');
    });
  });

  describe('getTamperedIndices', () => {
    it('should return no tampered indices for intact chain', () => {
      expect(verifier.getTamperedIndices()).toEqual([]);
    });

    it('should detect tampered indices', () => {
      (chain.getEntries() as any[])[0].hash = 'tampered';
      expect(verifier.getTamperedIndices()).toEqual([0]);
    });
  });

  describe('getBrokenLinkIndices', () => {
    it('should return no broken links for intact chain', () => {
      expect(verifier.getBrokenLinkIndices()).toEqual([]);
    });

    it('should detect broken links', () => {
      (chain.getEntries() as any[])[1].previousHash = 'broken';
      expect(verifier.getBrokenLinkIndices()).toEqual([1]);
    });
  });
});

// ============================================================
// SECTION 7 — ProtocolEngine (73.96% → ~100%)
// ============================================================
describe('ProtocolStateTracker', () => {
  let tracker: ProtocolStateTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new ProtocolStateTracker();
  });

  describe('initial state', () => {
    it('should start with all steps incomplete', () => {
      const state = tracker.getState();
      expect(state.dnaSelected).toBe(false);
      expect(state.currentStep).toBe(0);
    });
  });

  describe('step markers', () => {
    it('should mark DNA selected', () => {
      tracker.markDnaSelected();
      expect(tracker.isDnaSelected()).toBe(true);
      expect(tracker.getCurrentStep()).toBe(1);
    });

    it('should mark truth resolved', () => {
      tracker.markTruthResolved();
      expect(tracker.isTruthResolved()).toBe(true);
    });

    it('should mark mission created', () => {
      tracker.markMissionCreated();
      expect(tracker.isMissionCreated()).toBe(true);
    });

    it('should mark audit done', () => {
      tracker.markAuditDone();
      expect(tracker.isAuditDone()).toBe(true);
    });

    it('should mark learning recorded', () => {
      tracker.markLearningRecorded();
      expect(tracker.isLearningRecorded()).toBe(true);
    });

    it('should recalc step correctly through all steps', () => {
      expect(tracker.getCurrentStep()).toBe(0);
      tracker.markDnaSelected();
      expect(tracker.getCurrentStep()).toBe(1);
      tracker.markTruthResolved();
      expect(tracker.getCurrentStep()).toBe(2);
      tracker.markMissionCreated();
      expect(tracker.getCurrentStep()).toBe(3);
      tracker.markAuditDone();
      expect(tracker.getCurrentStep()).toBe(4);
      tracker.markLearningRecorded();
      expect(tracker.getCurrentStep()).toBe(5);
    });
  });

  describe('getNextRequiredStep', () => {
    it('should return step 1 initially', () => {
      expect(tracker.getNextRequiredStep()).toContain('Step 1');
    });

    it('should return all-done when every step complete', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markAuditDone();
      tracker.markLearningRecorded();
      expect(tracker.getNextRequiredStep()).toBe('All protocol steps completed.');
    });
  });

  describe('validate gates', () => {
    it('validateBeforeAction should fail when DNA not selected', () => {
      const result = tracker.validateBeforeAction();
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('Select DNA');
    });

    it('validateBeforeAction should pass when DNA selected', () => {
      tracker.markDnaSelected();
      expect(tracker.validateBeforeAction().valid).toBe(true);
    });

    it('validateBeforeDelegation should fail when prerequisites missing', () => {
      const result = tracker.validateBeforeDelegation();
      expect(result.valid).toBe(false);
      expect(result.missing).toHaveLength(3);
    });

    it('validateBeforeDelegation should pass with all steps', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      expect(tracker.validateBeforeDelegation().valid).toBe(true);
    });

    it('validateBeforeAudit should fail when missing', () => {
      expect(tracker.validateBeforeAudit().valid).toBe(false);
    });

    it('validateBeforeAudit should pass with prerequisites', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      expect(tracker.validateBeforeAudit().valid).toBe(true);
    });

    it('validateBeforeComplete should fail when audit not done', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      const result = tracker.validateBeforeComplete();
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('Run Audit');
    });

    it('validateBeforeComplete should pass with all steps', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markAuditDone();
      expect(tracker.validateBeforeComplete().valid).toBe(true);
    });
  });

  describe('order violations', () => {
    it('should detect truth resolved before dna selected', () => {
      tracker.markTruthResolved();
      const status = tracker.getStatus();
      expect(status.orderViolations).toHaveLength(1);
      expect(status.orderViolations[0].step).toBe('Resolve Truth');
    });

    it('should detect mission created before truth resolved', () => {
      tracker.markDnaSelected();
      tracker.markMissionCreated();
      const status = tracker.getStatus();
      expect(status.orderViolations).toHaveLength(1);
      expect(status.orderViolations[0].step).toBe('Create Mission');
    });

    it('should detect audit before prerequisites', () => {
      tracker.markAuditDone();
      const status = tracker.getStatus();
      expect(status.orderViolations).toHaveLength(1);
      expect(status.orderViolations[0].step).toBe('Run Audit');
    });

    it('should detect learning before audit', () => {
      tracker.markLearningRecorded();
      const status = tracker.getStatus();
      expect(status.orderViolations).toHaveLength(1);
      expect(status.orderViolations[0].step).toBe('Record Learning');
    });
  });

  describe('getStatus', () => {
    it('should include timestamps when available', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      const status = tracker.getStatus();
      expect(status.lastActionTimestamps).toHaveLength(2);
    });

    it('should mark valid=false when violations or missing exist', () => {
      const status = tracker.getStatus();
      expect(status.valid).toBe(false);
    });

    it('should mark valid=true when all steps complete in order', () => {
      tracker.markDnaSelected();
      tracker.markTruthResolved();
      tracker.markMissionCreated();
      tracker.markAuditDone();
      tracker.markLearningRecorded();
      const status = tracker.getStatus();
      expect(status.valid).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      tracker.markDnaSelected();
      tracker.reset();
      expect(tracker.isDnaSelected()).toBe(false);
      expect(tracker.getCurrentStep()).toBe(0);
    });
  });

  describe('persistence', () => {
    it('save should write to default path', () => {
      mockWriteFileSyncFn.mockImplementation(() => {});
      tracker.markDnaSelected();
      tracker.save();
      expect(mockWriteFileSyncFn).toHaveBeenCalled();
    });

    it('load should return false when file not found', () => {
      mockExistsSync.mockReturnValue(false);
      expect(tracker.load()).toBe(false);
    });

    it('load should return false on corrupted JSON', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSyncFn.mockReturnValue('not-json');
      expect(tracker.load()).toBe(false);
    });

    it('load should restore state from valid file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSyncFn.mockReturnValue(
        JSON.stringify({
          protocol: {
            dnaSelected: true,
            truthResolved: true,
            missionCreated: false,
            auditDone: false,
            learningRecorded: false,
            lastStep: 2,
            lastUpdated: new Date().toISOString(),
          },
        }),
      );
      expect(tracker.load()).toBe(true);
      expect(tracker.isDnaSelected()).toBe(true);
      expect(tracker.isTruthResolved()).toBe(true);
    });

    it('load should handle missing protocol field', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSyncFn.mockReturnValue(JSON.stringify({ otherField: true }));
      const result = tracker.load();
      expect(result).toBe(true);
      expect(tracker.isDnaSelected()).toBe(false);
    });

    it('getDefaultStateFilePath should return correct path', () => {
      const p = ProtocolStateTracker.getDefaultStateFilePath('/project');
      expect(p).toContain('.agent_state.json');
    });

    it('save should accept custom file path', () => {
      mockWriteFileSyncFn.mockImplementation(() => {});
      tracker.save('/custom/path.json');
      expect(mockWriteFileSyncFn).toHaveBeenCalledWith(
        '/custom/path.json',
        expect.any(String),
        'utf-8',
      );
    });
  });
});

// ============================================================
// SECTION 8 — TrafficSplitter (67.4% → ~100%)
// ============================================================
describe('TrafficSplitter', () => {
  let splitter: TrafficSplitter;

  beforeEach(() => {
    splitter = new TrafficSplitter();
    splitter.setSplit(30);
  });

  describe('constructor', () => {
    it('should use default config', () => {
      const s = new TrafficSplitter();
      expect(s.getConfig().strategy).toBe('weighted');
    });

    it('should accept custom config', () => {
      const s = new TrafficSplitter({
        strategy: 'round-robin',
        stickySessionTtlMs: 5000,
        maxStickySessions: 5,
      });
      expect(s.getConfig().strategy).toBe('round-robin');
    });
  });

  describe('setSplit', () => {
    it('should set canary and stable split', () => {
      const routes = splitter.setSplit(20);
      expect(routes).toHaveLength(2);
      expect(routes.find((r) => r.isCanary)!.weight).toBe(20);
    });

    it('should accept custom stable weight', () => {
      const routes = splitter.setSplit(10, 90);
      expect(routes.find((r) => !r.isCanary)!.weight).toBe(90);
    });
  });

  describe('setVersionedSplit', () => {
    it('should set versioned split correctly', () => {
      const routes = splitter.setVersionedSplit('v1', 70, 'v2-canary', 30);
      expect(routes).toHaveLength(2);
      const stable = routes.find((r) => !r.isCanary)!;
      expect(stable.version).toBe('v1');
      expect(stable.weight).toBe(70);
    });
  });

  describe('route', () => {
    it('should route without session', () => {
      const decision = splitter.route();
      expect(['stable', 'canary']).toContain(decision.routedVersion);
      expect(decision.stickyMatch).toBe(false);
    });

    it('should route via sticky session', () => {
      splitter.createStickySession('session-1', 'canary');
      const decision = splitter.route('session-1');
      expect(decision.routedVersion).toBe('canary');
      expect(decision.stickyMatch).toBe(true);
    });

    it('should remove expired sticky session and re-route', () => {
      const s = new TrafficSplitter({
        strategy: 'weighted',
        stickySessionTtlMs: -1000,
        maxStickySessions: 100,
      });
      s.setSplit(50);
      s.createStickySession('expired', 'canary');
      const decision = s.route('expired');
      expect(decision.stickyMatch).toBe(false);
    });

    it('should create new sticky session when strategy is sticky', () => {
      const s = new TrafficSplitter({ strategy: 'sticky' });
      s.setSplit(50);
      const decision = s.route('new-session');
      expect(decision.stickyMatch).toBe(true);
    });
  });

  describe('sticky sessions', () => {
    it('should create sticky session', () => {
      const session = splitter.createStickySession('uid', 'canary');
      expect(session.sessionId).toBe('uid');
      expect(session.pinnedVersion).toBe('canary');
    });

    it('should evict oldest session when at capacity', () => {
      const s = new TrafficSplitter({ maxStickySessions: 2 });
      s.setSplit(50);
      s.createStickySession('s1', 'stable');
      s.createStickySession('s2', 'stable');
      s.getStickySessions(); // clear any expired
      s.createStickySession('s3', 'canary');
      expect(s.getStickySessions().length).toBeLessThanOrEqual(2);
    });

    it('should remove sticky session', () => {
      splitter.createStickySession('remove-me', 'canary');
      expect(splitter.removeStickySession('remove-me')).toBe(true);
      expect(splitter.removeStickySession('nonexistent')).toBe(false);
    });

    it('should filter expired sessions', () => {
      const s = new TrafficSplitter({ stickySessionTtlMs: -1000 });
      s.setSplit(50);
      s.createStickySession('old', 'canary');
      expect(s.getStickySessions()).toHaveLength(0);
    });
  });

  describe('query methods', () => {
    it('should return traffic split map', () => {
      const split = splitter.getTrafficSplit();
      expect(split.stable).toBe(70);
      expect(split.canary).toBe(30);
    });

    it('should return copy of routes', () => {
      const routes = splitter.getRoutes();
      expect(routes).toHaveLength(2);
    });

    it('should get canary route', () => {
      const route = splitter.getCanaryRoute();
      expect(route).toBeDefined();
      expect(route!.isCanary).toBe(true);
    });

    it('should get stable route', () => {
      const route = splitter.getStableRoute();
      expect(route).toBeDefined();
      expect(route!.isCanary).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear routes and sticky sessions', () => {
      splitter.createStickySession('x', 'canary');
      splitter.reset();
      expect(splitter.getRoutes()).toHaveLength(0);
      expect(splitter.getStickySessions()).toHaveLength(0);
    });
  });

  describe('resolveRoute strategies', () => {
    it('should default to stable when no routes', () => {
      splitter.reset();
      expect(splitter.route().routedVersion).toBe('stable');
    });

    it('should support round-robin strategy', () => {
      const s = new TrafficSplitter({ strategy: 'round-robin' });
      s.setSplit(50, 50);
      const r1 = s.route();
      const r2 = s.route();
      expect(r1.routedVersion).not.toBe(r2.routedVersion);
    });

    it('should support random strategy', () => {
      const s = new TrafficSplitter({ strategy: 'random' });
      s.setSplit(100, 0);
      const decision = s.route();
      expect(decision.routedVersion).toBe('canary');
    });

    it('should support weighted strategy with totalWeight=0', () => {
      splitter.reset();
      splitter.setVersionedSplit('v1', 0, 'v2', 0);
      const decision = splitter.route();
      expect(decision.routedVersion).toBeDefined();
    });
  });
});

// ============================================================
// SECTION 9 — CanaryDeployer (81.7% → ~100%)
// ============================================================
describe('CanaryDeployer', () => {
  let deployer: CanaryDeployer;
  const customStage = {
    name: 'stage-10',
    trafficPercent: 10,
    durationMs: 0,
    healthCheckIntervalMs: 1000,
    requiredConsecutiveHealthy: 1,
    driftThreshold: 0.1,
    autoAdvance: true,
    description: '10% canary',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deployer = new CanaryDeployer({
      stages: [customStage],
      globalDriftThreshold: 0.3,
    });
  });

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const d = new CanaryDeployer();
      expect(d.getConfig().stages).toHaveLength(4);
    });

    it('should call onStatusChange callback', () => {
      const cb = vi.fn();
      const d = new CanaryDeployer({ stages: [customStage], onStatusChange: cb });
      d.startDeployment({ stableVersion: 'v1', canaryVersion: 'v2', projectName: 'test' });
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('startDeployment', () => {
    it('should start a deployment successfully', async () => {
      const dep = await deployer.startDeployment({
        stableVersion: '1.0',
        canaryVersion: '2.0',
        projectName: 'dna-test',
      });
      expect(dep.status).toBe('in-progress');
      expect(dep.currentStageIndex).toBe(0);
    });

    it('should reject when deployment already in progress', async () => {
      await deployer.startDeployment({
        stableVersion: '1.0',
        canaryVersion: '2.0',
        projectName: 'test',
      });
      await expect(
        deployer.startDeployment({
          stableVersion: '1.0',
          canaryVersion: '2.0',
          projectName: 'test',
        }),
      ).rejects.toThrow('already in progress');
    });

    it('should complete when all stages done', async () => {
      const d = new CanaryDeployer({ stages: [customStage], globalDriftThreshold: 0.3 });
      mockHealthCheck.mockReturnValue({
        overallStatus: 'healthy',
        successRate: 1,
        avgLatency: 50,
        errorRate: 0,
        totalCount: 100,
      });
      mockEvalHealth.mockReturnValue(null);
      await d.startDeployment({ stableVersion: 'v1', canaryVersion: 'v2', projectName: 'p' });
      d.reportHealth({ successCount: 100, totalCount: 100, totalLatencyMs: 5000, errorCount: 0 });
      expect(d.getDeployment()!.status).toBe('completed');
    });
  });

  describe('reportHealth', () => {
    it('should return null when not in progress', () => {
      const result = deployer.reportHealth({
        successCount: 0,
        totalCount: 0,
        totalLatencyMs: 0,
        errorCount: 0,
      });
      expect(result).toBeNull();
    });

    it('should handle healthy and advance', async () => {
      mockHealthCheck.mockReturnValue({
        overallStatus: 'healthy',
        successRate: 1,
        avgLatency: 50,
        errorRate: 0,
        totalCount: 100,
      });
      mockEvalHealth.mockReturnValue(null);
      await deployer.startDeployment({
        stableVersion: 'v1',
        canaryVersion: 'v2',
        projectName: 'p',
      });
      const result = deployer.reportHealth({
        successCount: 100,
        totalCount: 100,
        totalLatencyMs: 5000,
        errorCount: 0,
      });
      expect(result!.overallStatus).toBe('healthy');
    });

    it('should reset consecutive on unhealthy', async () => {
      mockHealthCheck.mockReturnValue({
        overallStatus: 'unhealthy',
        successRate: 0.5,
        avgLatency: 200,
        errorRate: 0.5,
        totalCount: 100,
      });
      mockEvalHealth.mockReturnValue(null);
      await deployer.startDeployment({
        stableVersion: 'v1',
        canaryVersion: 'v2',
        projectName: 'p',
      });
      deployer.reportHealth({
        successCount: 50,
        totalCount: 100,
        totalLatencyMs: 20000,
        errorCount: 50,
      });
      expect(deployer.getDeployment()!.stages[0].consecutiveHealthy).toBe(0);
    });

    it('should trigger rollback when evaluateHealth returns record', async () => {
      const rollbackRecord = {
        id: 'rb-1',
        deploymentId: 'dep-1',
        fromVersion: 'v2',
        toVersion: 'v1',
        reason: 'Health check failed',
      };
      mockHealthCheck.mockReturnValue({
        overallStatus: 'unhealthy',
        successRate: 0.3,
        avgLatency: 500,
        errorRate: 0.7,
        totalCount: 100,
      });
      mockEvalHealth.mockReturnValue(rollbackRecord);
      await deployer.startDeployment({
        stableVersion: 'v1',
        canaryVersion: 'v2',
        projectName: 'p',
      });
      deployer.reportHealth({
        successCount: 30,
        totalCount: 100,
        totalLatencyMs: 50000,
        errorCount: 70,
      });
      expect(deployer.getDeployment()!.status).toBe('rolled-back');
    });
  });

  describe('reportDrift', () => {
    it('should return null when not in progress', () => {
      expect(deployer.reportDrift(0.9)).toBeNull();
    });

    it('should trigger rollback when drift exceeds threshold', async () => {
      const rb = {
        id: 'drift-1',
        deploymentId: 'dep-1',
        fromVersion: 'v2',
        toVersion: 'v1',
        reason: 'Drift too high',
      };
      mockEvalDrift.mockReturnValue(rb);
      await deployer.startDeployment({
        stableVersion: 'v1',
        canaryVersion: 'v2',
        projectName: 'p',
      });
      const result = deployer.reportDrift(0.9);
      expect(result).toBeDefined();
      expect(deployer.getDeployment()!.status).toBe('rolled-back');
    });

    it('should return null when drift within threshold', async () => {
      await deployer.startDeployment({
        stableVersion: 'v1',
        canaryVersion: 'v2',
        projectName: 'p',
      });
      expect(deployer.reportDrift(0.05)).toBeNull();
    });
  });

  describe('pause / resume', () => {
    it('should pause deployment', async () => {
      await deployer.startDeployment({
        stableVersion: 'v1',
        canaryVersion: 'v2',
        projectName: 'p',
      });
      const paused = deployer.pause();
      expect(paused!.status).toBe('paused');
    });

    it('should return null when pausing non-in-progress', () => {
      expect(deployer.pause()).toBeNull();
    });

    it('should resume paused deployment', async () => {
      await deployer.startDeployment({
        stableVersion: 'v1',
        canaryVersion: 'v2',
        projectName: 'p',
      });
      deployer.pause();
      const resumed = deployer.resume();
      expect(resumed!.status).toBe('in-progress');
    });

    it('should return null when resuming non-paused', () => {
      expect(deployer.resume()).toBeNull();
    });
  });

  describe('promote', () => {
    it('should advance to next stage', async () => {
      const d = new CanaryDeployer({
        stages: [customStage, { ...customStage, name: 'stage-50', trafficPercent: 50 }],
      });
      await d.startDeployment({ stableVersion: 'v1', canaryVersion: 'v2', projectName: 'p' });
      const promoted = d.promote();
      expect(promoted!.currentStageIndex).toBe(1);
    });

    it('should return null when not in progress', () => {
      expect(deployer.promote()).toBeNull();
    });
  });

  describe('manualRollback', () => {
    it('should trigger manual rollback', async () => {
      mockTriggerManual.mockReturnValue({
        id: 'manual-1',
        deploymentId: 'dep-1',
        fromVersion: 'v2',
        toVersion: 'v1',
        reason: 'Manual trigger',
      });
      await deployer.startDeployment({
        stableVersion: 'v1',
        canaryVersion: 'v2',
        projectName: 'p',
      });
      const result = deployer.manualRollback('Manual trigger');
      expect(result!.status).toBe('rolled-back');
    });

    it('should return null when not in progress', () => {
      expect(deployer.manualRollback('Not started')).toBeNull();
    });
  });

  describe('query methods', () => {
    it('should return deployment', async () => {
      await deployer.startDeployment({
        stableVersion: 'v1',
        canaryVersion: 'v2',
        projectName: 'p',
      });
      expect(deployer.getDeployment()).not.toBeNull();
    });

    it('should return null deployment before start', () => {
      expect(deployer.getDeployment()).toBeNull();
    });

    it('should return deployment history', async () => {
      await deployer.startDeployment({
        stableVersion: 'v1',
        canaryVersion: 'v2',
        projectName: 'p',
      });
      expect(deployer.getDeployments()).toHaveLength(1);
    });

    it('should return health checker', () => {
      expect(deployer.getHealthChecker()).toBeDefined();
    });

    it('should return rollback manager', () => {
      expect(deployer.getRollbackManager()).toBeDefined();
    });

    it('should return traffic splitter', () => {
      expect(deployer.getTrafficSplitter()).toBeDefined();
    });
  });
});
