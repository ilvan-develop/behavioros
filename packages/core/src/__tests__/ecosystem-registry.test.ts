import type { DNAPackage } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { DNALoader } from '../engines/behavioral/dna-loader';
import { EcosystemRegistry } from '../engines/ecosystem-registry';
import { SkillEngine } from '../engines/skill-engine';

// ============================================================
// Helpers
// ============================================================

function makeSampleDNA(): DNAPackage {
  return {
    id: 'test-dna',
    name: 'Test DNA',
    version: '1.0.0',
    description: 'Test DNA for ecosystem registry',
    personas: [
      {
        role: 'engineer',
        authority: 'senior',
        name: 'Test Engineer',
        skills: [
          { id: 'typescript', proficiency: 4 },
          { id: 'react', proficiency: 3 },
        ],
      },
      {
        role: 'architect',
        authority: 'architect',
        name: 'Test Architect',
        skills: [{ id: 'system-design', proficiency: 5 }],
      },
    ],
  };
}

// ============================================================
// EcosystemRegistry Tests
// ============================================================

describe('EcosystemRegistry', () => {
  let registry: EcosystemRegistry;
  let skillEngine: SkillEngine;

  beforeEach(() => {
    skillEngine = new SkillEngine();
    registry = new EcosystemRegistry({
      skillEngine,
    });
  });

  // ─── Constructor ──────────────────────────────────────────

  it('should be constructable with no options', () => {
    const empty = new EcosystemRegistry();
    expect(empty).toBeDefined();
    expect(empty.isInitialized()).toBe(false);
  });

  // ─── setDNALoader() ───────────────────────────────────────

  it('should accept a DNALoader', () => {
    const loader = new DNALoader();
    registry.setDNALoader(loader);
    expect(registry).toBeDefined();
  });

  // ─── initialize() ─────────────────────────────────────────

  describe('initialize()', () => {
    it('should initialize even with no sources available', async () => {
      await registry.initialize();
      expect(registry.isInitialized()).toBe(true);
    });

    it('should load from DNA when DNALoader and SkillEngine are available', async () => {
      // Sync DNA to skill engine first
      const dna = makeSampleDNA();
      await skillEngine.syncFromDNA(dna);

      await registry.initialize();
      expect(registry.isInitialized()).toBe(true);

      // Report should include DNA skills
      const report = await registry.generateReport();
      expect(report.agents.length).toBe(2); // engineer, architect
      expect(report.skills.length).toBeGreaterThanOrEqual(3);
      expect(report.dnas.length).toBe(1);
    });
  });

  // ─── generateReport() ─────────────────────────────────────

  describe('generateReport()', () => {
    it('should return a valid EcosystemReport', async () => {
      const dna = makeSampleDNA();
      await skillEngine.syncFromDNA(dna);

      const report = await registry.generateReport();
      expect(report.project).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(Array.isArray(report.agents)).toBe(true);
      expect(Array.isArray(report.skills)).toBe(true);
      expect(Array.isArray(report.mcps)).toBe(true);
      expect(Array.isArray(report.designSystems)).toBe(true);
      expect(Array.isArray(report.dnas)).toBe(true);
    });

    it('should include all installed skills in report', async () => {
      const dna = makeSampleDNA();
      await skillEngine.syncFromDNA(dna);

      // Install additional components
      await skillEngine.install({ type: 'mcp', id: 'playwright-mcp', source: 'local' });
      await skillEngine.install({ type: 'skill', id: 'custom-tool', source: 'aitmpl' });

      const report = await registry.generateReport();
      const mcp = report.mcps.find((m) => m.id === 'playwright-mcp');
      expect(mcp).toBeDefined();

      const cusSkill = report.skills.find((s) => s.id === 'custom-tool');
      expect(cusSkill).toBeDefined();
    });
  });

  // ─── install() ────────────────────────────────────────────

  describe('install()', () => {
    it('should install a local component via SkillEngine', async () => {
      const result = await registry.install('skill', 'local-skill', 'local');
      expect(result.success).toBe(true);
      expect(result.component).toBeDefined();
      expect(result.component!.id).toBe('local-skill');
    });

    it('should fail for unknown source', async () => {
      const result = await registry.install('skill', 'test', 'unknown-source');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown source');
    });

    it('should fail for AITMPL when adapter not configured', async () => {
      const result = await registry.install('skill', 'test', 'aitmpl');
      expect(result.success).toBe(false);
      expect(result.error).toContain('AITMPL adapter not configured');
    });

    it('should fail for Open Design when adapter not configured', async () => {
      const result = await registry.install('mcp', 'test', 'open-design');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Open Design adapter not configured');
    });
  });

  // ─── sync() ───────────────────────────────────────────────

  describe('sync()', () => {
    it('should sync without errors when no sources have data', async () => {
      const result = await registry.sync(['dna', 'local']);
      expect(result.results).toBeDefined();
    });

    it('should sync local skills from the filesystem', async () => {
      const result = await registry.sync(['local']);
      expect(result.results).toBeDefined();
      // No errors — local sync handles missing dirs gracefully
    });
  });

  // ─── doctor() ─────────────────────────────────────────────

  describe('doctor()', () => {
    it('should return healthy when all engines are ready', async () => {
      const dna = makeSampleDNA();
      await skillEngine.syncFromDNA(dna);

      const result = await registry.doctor();
      expect(result.engines['skill-engine']).toBeDefined();
      expect(result.engines['skill-engine'].status).toBe('healthy');
      expect(result.healthy).toBe(true);
    });

    it('should include stats in doctor report', async () => {
      const dna = makeSampleDNA();
      await skillEngine.syncFromDNA(dna);

      await skillEngine.install({ type: 'skill', id: 'extra', source: 'local' });

      const result = await registry.doctor();
      expect(result.stats.totalComponents).toBeGreaterThan(0);
      expect(result.stats.activeComponents).toBeGreaterThan(0);
      expect(result.stats.agents).toBe(2);
    });
  });
});
