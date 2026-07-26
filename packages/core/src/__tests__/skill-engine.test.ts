import type { DNAPackage } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { SkillEngine } from '../engines/skill-engine';

// ============================================================
// Helpers
// ============================================================

function makeSampleDNA(): DNAPackage {
  return {
    id: 'test-dna',
    name: 'Test DNA',
    version: '1.0.0',
    description: 'Test DNA for skill engine',
    personas: [
      {
        role: 'engineer',
        authority: 'senior',
        name: 'Test Engineer',
        skills: [{ id: 'typescript', proficiency: 4 }, { id: 'react', proficiency: 3 }, 'nodejs'],
      },
      {
        role: 'architect',
        authority: 'architect',
        name: 'Test Architect',
        skills: [
          { id: 'system-design', proficiency: 5 },
          { id: 'typescript', proficiency: 5 },
        ],
      },
      {
        role: 'qa',
        authority: 'senior',
        name: 'Test QA',
        skills: [],
      },
    ],
  };
}

// ============================================================
// SkillEngine Tests
// ============================================================

describe('SkillEngine', () => {
  let engine: SkillEngine;

  beforeEach(() => {
    engine = new SkillEngine();
  });

  // ─── resolve() ─────────────────────────────────────────────

  describe('resolve()', () => {
    it('should return correct skill for agent with DNA-matched skill', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      const result = await engine.resolve('engineer', 'typescript');
      expect(result.hasSkill).toBe(true);
      expect(result.proficiency).toBe(4);
      expect(result.skill).toBeDefined();
      expect(result.skill!.id).toBe('typescript');
    });

    it('should return false for agent without the skill', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      const result = await engine.resolve('engineer', 'docker');
      expect(result.hasSkill).toBe(false);
    });

    it('should resolve via semantic fallback when skill exists in registry', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      // Add the skill manually to registry
      await engine.install({ type: 'skill', id: 'python', source: 'local' });

      // Engineer is known to exist (has other skills) — semantic fallback
      const result = await engine.resolve('engineer', 'python');
      expect(result.hasSkill).toBe(true);
      expect(result.proficiency).toBe(2); // Default low proficiency
    });
  });

  // ─── validateDelegation() ──────────────────────────────────

  describe('validateDelegation()', () => {
    it('should allow delegation when agent has all required skills', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      const result = await engine.validateDelegation('orchestrator', 'engineer', [
        'typescript',
        'react',
      ]);

      expect(result.allowed).toBe(true);
      expect(result.missingSkills).toHaveLength(0);
      expect(result.insufficientProficiency).toHaveLength(0);
    });

    it('should block delegation when agent is missing a skill', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      const result = await engine.validateDelegation('orchestrator', 'engineer', [
        'typescript',
        'docker',
      ]);

      expect(result.allowed).toBe(false);
      expect(result.missingSkills).toContain('docker');
      expect(result.reason).toContain('missing skills');
    });

    it('should detect insufficient proficiency', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      // Install a skill with proficiency 1 (below threshold)
      const agentSkills = engine.getAgentSkills();
      const engineerSkills = agentSkills.get('engineer')!;
      engineerSkills.push({ id: 'python', proficiency: 1 });

      const result = await engine.validateDelegation('orchestrator', 'engineer', [
        'typescript',
        'python',
      ]);

      expect(result.allowed).toBe(false);
      expect(result.insufficientProficiency).toContain('python');
    });

    it('should return reason with combined missing and insufficient', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      const agentSkills = engine.getAgentSkills();
      const engineerSkills = agentSkills.get('engineer')!;
      engineerSkills.push({ id: 'python', proficiency: 1 });

      const result = await engine.validateDelegation('orchestrator', 'engineer', [
        'docker',
        'python',
      ]);

      expect(result.allowed).toBe(false);
      expect(result.missingSkills).toContain('docker');
      expect(result.insufficientProficiency).toContain('python');
      expect(result.reason).toContain('missing skills');
      expect(result.reason).toContain('insufficient proficiency');
    });
  });

  // ─── listAvailable() ───────────────────────────────────────

  describe('listAvailable()', () => {
    it('should return skills from DNA', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      const skills = await engine.listAvailable();
      expect(skills.length).toBeGreaterThanOrEqual(3); // typescript, react, nodejs, system-design
    });

    it('should only return active skills', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      // Install and then remove one
      await engine.install({ type: 'skill', id: 'temporary', source: 'local' });
      await engine.uninstall('temporary');

      const skills = await engine.listAvailable();
      const tempSkill = skills.find((s) => s.id === 'temporary');
      expect(tempSkill).toBeUndefined();
    });
  });

  // ─── search() ──────────────────────────────────────────────

  describe('search()', () => {
    it('should find skills by name', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      const results = await engine.search('typescript');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].id).toBe('typescript');
    });

    it('should filter by category', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      // Add a skill with a specific category manually
      await engine.install({ type: 'skill', id: 'docker-skill', source: 'local' });

      // Search without category — should find it
      const allResults = await engine.search('docker');
      expect(allResults.length).toBeGreaterThanOrEqual(1);

      // Search with category filter that doesn't match
      const filteredResults = await engine.search('docker', { category: 'security' });
      expect(filteredResults).toHaveLength(0);
    });
  });

  // ─── get() ─────────────────────────────────────────────────

  describe('get()', () => {
    it('should return null for non-existent skill', async () => {
      const skill = await engine.get('non-existent');
      expect(skill).toBeNull();
    });

    it('should return skill that exists in registry', async () => {
      await engine.install({ type: 'skill', id: 'my-skill', source: 'local' });

      const skill = await engine.get('my-skill');
      expect(skill).not.toBeNull();
      expect(skill!.id).toBe('my-skill');
    });
  });

  // ─── install() ─────────────────────────────────────────────

  describe('install()', () => {
    it('should add component to registry', async () => {
      const result = await engine.install({
        type: 'mcp',
        id: 'github-mcp',
        source: 'local',
      });

      expect(result.success).toBe(true);
      expect(result.component).toBeDefined();
      expect(result.component!.id).toBe('github-mcp');

      const registry = engine.getRegistry();
      expect(registry.has('github-mcp')).toBe(true);
    });

    it('should reject duplicate installations', async () => {
      await engine.install({ type: 'skill', id: 'duplicate', source: 'local' });

      const result = await engine.install({ type: 'skill', id: 'duplicate', source: 'local' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  // ─── uninstall() ──────────────────────────────────────────

  describe('uninstall()', () => {
    it('should remove component from registry', async () => {
      await engine.install({ type: 'skill', id: 'removable', source: 'local' });
      expect(engine.getRegistry().has('removable')).toBe(true);

      await engine.uninstall('removable');
      expect(engine.getRegistry().has('removable')).toBe(false);
    });
  });

  // ─── syncFromDNA() ─────────────────────────────────────────

  describe('syncFromDNA()', () => {
    it('should extract persona skills', async () => {
      const dna = makeSampleDNA();
      const result = await engine.syncFromDNA(dna);

      expect(result.added).toBeGreaterThanOrEqual(3); // typescript, react, nodejs, system-design
      expect(result.removed).toBe(0);
    });

    it('should populate agent skills map', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      const agentSkills = engine.getAgentSkills();
      expect(agentSkills.has('engineer')).toBe(true);
      expect(agentSkills.has('architect')).toBe(true);
      expect(agentSkills.get('engineer')!.length).toBe(3); // typescript, react, nodejs
    });
  });

  // ─── status() ──────────────────────────────────────────────

  describe('status()', () => {
    it('should return complete status with agents, skills, mcps, dnas', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      // Add an MCP component
      await engine.install({ type: 'mcp', id: 'test-mcp', source: 'local' });

      const status = await engine.status();

      expect(status.agents.length).toBe(3); // engineer, architect, qa
      expect(status.skills.length).toBeGreaterThanOrEqual(4);
      expect(status.mcps.length).toBe(1);
      expect(status.mcps[0].id).toBe('test-mcp');
      expect(status.dnas.length).toBe(1);
      expect(status.dnas[0].id).toBe('test-dna');
    });
  });

  // ─── doctor() ──────────────────────────────────────────────

  describe('doctor()', () => {
    it('should return healthy when no issues found', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      const report = await engine.doctor();
      expect(report.healthy).toBe(true);
      expect(report.stats.totalComponents).toBeGreaterThan(0);
    });

    it('should detect missing components', async () => {
      // Add a dangling skill reference without the component
      const agentSkills = engine.getAgentSkills();
      agentSkills.set('orphan-agent', [{ id: 'missing-skill', proficiency: 3 }]);

      const report = await engine.doctor();
      expect(report.issues.length).toBeGreaterThan(0);
    });

    it('should detect agents with no skills', async () => {
      const dna = makeSampleDNA();
      await engine.syncFromDNA(dna);

      const report = await engine.doctor();
      // QA agent has no skills — should warn
      const qaIssue = report.issues.find(
        (i) => i.component === 'qa' && i.message.includes('no skills'),
      );
      expect(qaIssue).toBeDefined();
    });
  });
});
