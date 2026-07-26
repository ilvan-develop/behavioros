import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineDispatcherContext } from '../pipeline/pipeline-context';

const mockAccess = vi.fn();
const mockReaddir = vi.fn();

vi.mock('node:fs/promises', () => ({
  access: (...args: unknown[]) => mockAccess(...(args as [string])),
  readdir: (...args: unknown[]) => mockReaddir(...(args as [string])),
}));

import { CoverageEngine } from '../engines/coverage-engine';
import { CoverageGateLayer } from '../pipeline/layers/coverage-gate.layer';

function createContext(
  overrides: Partial<PipelineDispatcherContext> = {},
): PipelineDispatcherContext {
  return {
    id: 'test-context',
    dnaId: 'test-dna',
    dnaMode: 'transactional',
    agentId: 'engineer-1',
    agentAuthority: 'senior',
    action: 'test-action',
    payload: {},
    metadata: new Map(),
    startTime: Date.now(),
    layerResults: [],
    currentLayerIndex: 0,
    failed: false,
    ...overrides,
  };
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
}

function setupFs(existingPaths: string[]) {
  const normalizedExisting = existingPaths.map(normalize);

  mockAccess.mockImplementation(async (filePath: string) => {
    if (!normalizedExisting.includes(normalize(filePath))) {
      throw Object.assign(new Error(`ENOENT: ${filePath}`), { code: 'ENOENT' });
    }
  });

  mockReaddir.mockImplementation(async (dirPath: string) => {
    const normDir = normalize(dirPath);
    const matching = normalizedExisting
      .filter((f) => f.startsWith(`${normDir}/`))
      .map((f) => {
        const relative = f.slice(normDir.length + 1);
        return relative.split('/')[0];
      });
    return [...new Set(matching)];
  });
}

const FULL_COVERAGE_PATHS = [
  '/project/docs/',
  '/project/docs/ARCHITECTURE.md',
  '/project/docs/PROTOCOL.md',
  '/project/dnas/',
  '/project/dnas/behavioros.yaml',
  '/project/.agent_state.json',
  '/project/package.json',
  '/project/.opencode/skills/',
  '/project/.opencode/skills/context7-mcp/SKILL.md',
  '/project/packages/core/src/engines/governance/',
  '/project/packages/core/src/engines/governance/governance-engine.ts',
  '/project/packages/core/src/engines/quality/',
  '/project/packages/core/src/engines/quality/quality-engine.ts',
  '/project/CLAUDE.md',
  '/project/packages/mcp-server/',
  '/project/packages/mcp-server/src/index.ts',
];

describe('CoverageEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have default threshold of 90', () => {
    const engine = new CoverageEngine();
    expect(engine).toBeDefined();
  });

  describe('calculate', () => {
    it('should return full coverage when all artifacts exist', async () => {
      setupFs(FULL_COVERAGE_PATHS);

      const engine = new CoverageEngine();
      const report = await engine.calculate('/project');

      expect(report.passed).toBe(true);
      expect(report.overallPercentage).toBe(100);
      expect(report.dimensions.length).toBe(10);
      expect(report.totalFound).toBe(report.totalExpected);
    });

    it('should return passed: false when coverage is below 90%', async () => {
      setupFs(['/project/package.json']);

      const engine = new CoverageEngine();
      const report = await engine.calculate('/project');

      expect(report.passed).toBe(false);
      expect(report.overallPercentage).toBeLessThan(90);
    });

    it('should return passed: true when coverage is exactly 90%', async () => {
      const engine = new CoverageEngine({ threshold: 90 });

      setupFs([
        '/project/docs/ARCHITECTURE.md',
        '/project/dnas/',
        '/project/.agent_state.json',
        '/project/package.json',
        '/project/.opencode/skills/',
        '/project/packages/core/src/engines/governance/',
        '/project/packages/core/src/engines/quality/',
        '/project/CLAUDE.md',
        '/project/packages/mcp-server/',
      ]);

      const report = await engine.calculate('/project');
      expect(report.passed).toBe(true);
      expect(report.overallPercentage).toBeGreaterThanOrEqual(90);
    });

    it('should correctly identify missing items', async () => {
      setupFs([]);

      const engine = new CoverageEngine();
      const report = await engine.calculate('/project');

      const archDim = report.dimensions.find((d) => d.name === 'architecture');
      expect(archDim).toBeDefined();
      expect(archDim!.missing.length).toBeGreaterThan(0);
      expect(archDim!.percentage).toBe(0);
    });

    it('should include timestamp in report', async () => {
      setupFs([]);
      const engine = new CoverageEngine();
      const report = await engine.calculate('/project');

      expect(report.timestamp).toBeDefined();
      expect(new Date(report.timestamp).toISOString()).toBe(report.timestamp);
    });
  });

  describe('calculateDimensions', () => {
    it('should calculate only requested dimensions', async () => {
      setupFs(['/project/docs/ARCHITECTURE.md', '/project/CLAUDE.md']);

      const engine = new CoverageEngine();
      const dims = await engine.calculateDimensions('/project', [
        'architecture',
        'platform_adapters',
      ]);

      expect(dims.length).toBe(2);
      expect(dims.find((d) => d.name === 'architecture')?.percentage).toBe(100);
      expect(dims.find((d) => d.name === 'platform_adapters')?.percentage).toBe(100);
    });

    it('should return empty array for unknown dimensions', async () => {
      setupFs([]);
      const engine = new CoverageEngine();
      const dims = await engine.calculateDimensions('/project', ['nonexistent']);

      expect(dims.length).toBe(0);
    });
  });

  describe('checkThreshold', () => {
    it('should return passed: true when above threshold', async () => {
      setupFs(FULL_COVERAGE_PATHS);

      const engine = new CoverageEngine();
      const report = await engine.calculate('/project');
      const result = engine.checkThreshold(report);

      expect(result.passed).toBe(true);
      expect(result.missing.length).toBe(0);
    });

    it('should return passed: false with missing items when below threshold', async () => {
      setupFs(['/project/package.json']);

      const engine = new CoverageEngine();
      const report = await engine.calculate('/project');
      const result = engine.checkThreshold(report);

      expect(result.passed).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });
  });

  describe('getRecommendations', () => {
    it('should generate recommendations for missing artifacts', async () => {
      setupFs(['/project/package.json']);

      const engine = new CoverageEngine();
      const report = await engine.calculate('/project');
      const recs = engine.getRecommendations(report);

      expect(recs.length).toBeGreaterThan(0);
      expect(recs.some((r) => r.includes('Create missing'))).toBe(true);
    });

    it('should return empty recommendations when fully covered', async () => {
      setupFs(FULL_COVERAGE_PATHS);

      const engine = new CoverageEngine();
      const report = await engine.calculate('/project');
      const recs = engine.getRecommendations(report);

      expect(recs.length).toBe(0);
    });

    it('should include threshold warning when below threshold', async () => {
      setupFs([]);

      const engine = new CoverageEngine();
      const report = await engine.calculate('/project');
      const recs = engine.getRecommendations(report);

      expect(recs.some((r) => r.includes('below threshold'))).toBe(true);
    });
  });
});

describe('CoverageGateLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct id and name', () => {
    const layer = new CoverageGateLayer();
    expect(layer.id).toBe('coverage-gate');
    expect(layer.name).toBe('Context Coverage Gate');
  });

  it('should always execute', () => {
    const layer = new CoverageGateLayer();
    const ctx = createContext();
    expect(layer.shouldExecute(ctx)).toBe(true);
  });

  it('should block execution when coverage is below threshold', async () => {
    setupFs(['/project/package.json']);

    const layer = new CoverageGateLayer(90);
    const ctx = createContext({
      metadata: new Map([['projectPath', '/project']]),
    });

    const result = await layer.execute(ctx);

    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(90);
    expect(result.details.blocked).toBe(true);
  });

  it('should allow execution when coverage is above threshold', async () => {
    setupFs(FULL_COVERAGE_PATHS);

    const layer = new CoverageGateLayer(90);
    const ctx = createContext({
      metadata: new Map([['projectPath', '/project']]),
    });

    const result = await layer.execute(ctx);

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('should use process.cwd() when projectPath not in metadata', async () => {
    setupFs([]);

    const layer = new CoverageGateLayer(90);
    const ctx = createContext();

    const result = await layer.execute(ctx);

    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(90);
  });

  it('should block on error during coverage calculation', async () => {
    const layer = new CoverageGateLayer(90);
    const ctx = createContext({
      metadata: new Map([['projectPath', '/inaccessible']]),
    });

    const calculateSpy = vi
      .spyOn(CoverageEngine.prototype, 'calculate')
      .mockRejectedValueOnce(new Error('Permission denied'));

    const result = await layer.execute(ctx);

    expect(result.passed).toBe(false);
    expect(result.details.blocked).toBe(true);
    expect(result.details.error).toBe('Permission denied');

    calculateSpy.mockRestore();
  });
});
