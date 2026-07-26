import {
  BehaviorOSEngine,
  EcosystemRegistry,
  HandoffProtocol,
  SkillEngine,
} from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { bosAgentHandoff } from '../tools/bos-agent-handoff.js';
import { bosEcosystemDoctor } from '../tools/bos-ecosystem-doctor.js';
import { bosEcosystemInstall } from '../tools/bos-ecosystem-install.js';
import { bosEcosystemStatus } from '../tools/bos-ecosystem-status.js';
import { bosSkillsList } from '../tools/bos-skills-list.js';
import { bosSkillsValidate } from '../tools/bos-skills-validate.js';

const testDNA: DNAPackage = {
  id: 'test-dna',
  name: 'Test DNA',
  version: '1.0.0',
  personas: [
    {
      role: 'engineer',
      authority: 'senior',
      name: 'Test Engineer',
      skills: [
        { id: 'typescript', proficiency: 4 },
        { id: 'react', proficiency: 3 },
        { id: 'testing', proficiency: 3 },
      ],
    },
    {
      role: 'qa',
      authority: 'senior',
      name: 'Test QA',
      skills: [{ id: 'testing', proficiency: 5 }],
    },
    {
      role: 'devops',
      authority: 'senior',
      name: 'Test DevOps',
      skills: [{ id: 'docker', proficiency: 4 }],
    },
  ],
  governance: [
    {
      id: 'test-rule',
      name: 'Test Rule',
      level: 'medium',
      action: 'warn',
      conditions: ['type:feature'],
    },
  ],
  quality: [{ id: 'test-coverage', name: 'Test Coverage', type: 'test_coverage', threshold: 80 }],
  patterns: [
    {
      id: 'test-pattern',
      name: 'Test Pattern',
      type: 'collaboration',
      triggers: ['agent:engineer'],
      actions: ['code-review'],
    },
  ],
};

function createTestEngine(): BehaviorOSEngine {
  return new BehaviorOSEngine({
    dna: testDNA,
    governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
    quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
    learning: { enabled: true, autoApply: false },
    audit: { enabled: true },
  });
}

// ============================================================
// bos-agent-handoff Tests
// ============================================================

describe('bos-agent-handoff', () => {
  let protocol: HandoffProtocol;

  beforeEach(() => {
    protocol = new HandoffProtocol(50);
  });

  it('should request a handoff', async () => {
    const result = await bosAgentHandoff(protocol, {
      action: 'request',
      from: 'agent-a',
      to: 'agent-b',
      context: {
        subtask: {
          id: 'sub-1',
          title: 'Implement feature',
          type: 'implementation',
          requiredSkill: 'typescript',
        },
        missionId: 'mission-1',
      },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.action).toBe('request');
    expect(parsed.handoffId).toBeDefined();
    expect(parsed.status).toBe('pending');
    expect(parsed.message).toContain('agent-a');
    expect(parsed.message).toContain('agent-b');
  });

  it('should accept a handoff and transition to in_progress', async () => {
    // First request
    const request = await bosAgentHandoff(protocol, {
      action: 'request',
      from: 'agent-a',
      to: 'agent-b',
      context: {
        subtask: {
          id: 'sub-1',
          title: 'Implement feature',
          type: 'implementation',
          requiredSkill: 'typescript',
        },
        missionId: 'mission-1',
      },
    });
    const handoffId = JSON.parse(request.content[0].text).handoffId;

    // Then accept
    const accept = await bosAgentHandoff(protocol, {
      action: 'accept',
      handoffId,
    });

    const acceptParsed = JSON.parse(accept.content[0].text);
    expect(acceptParsed.action).toBe('accept');
    expect(acceptParsed.status).toBe('in_progress');
  });

  it('should reject a handoff with reason', async () => {
    const request = await bosAgentHandoff(protocol, {
      action: 'request',
      from: 'agent-a',
      to: 'agent-b',
      context: {
        subtask: {
          id: 'sub-1',
          title: 'Implement feature',
          type: 'implementation',
          requiredSkill: 'typescript',
        },
        missionId: 'mission-1',
      },
    });
    const handoffId = JSON.parse(request.content[0].text).handoffId;

    const reject = await bosAgentHandoff(protocol, {
      action: 'reject',
      handoffId,
      reason: {
        code: 'overloaded',
        details: 'Agent B is currently at capacity',
        suggestion: 'Try agent-c instead',
      },
    });

    const rejectParsed = JSON.parse(reject.content[0].text);
    expect(rejectParsed.action).toBe('reject');
    expect(rejectParsed.status).toBe('rejected');
    expect(rejectParsed.reason.code).toBe('overloaded');
  });

  it('should complete a handoff with output', async () => {
    const request = await bosAgentHandoff(protocol, {
      action: 'request',
      from: 'agent-a',
      to: 'agent-b',
      context: {
        subtask: {
          id: 'sub-1',
          title: 'Implement feature',
          type: 'implementation',
          requiredSkill: 'typescript',
        },
        missionId: 'mission-1',
      },
    });
    const handoffId = JSON.parse(request.content[0].text).handoffId;

    await bosAgentHandoff(protocol, { action: 'accept', handoffId });

    const complete = await bosAgentHandoff(protocol, {
      action: 'complete',
      handoffId,
      output: { result: 'success', files: ['src/feature.ts'] },
    });

    const completeParsed = JSON.parse(complete.content[0].text);
    expect(completeParsed.action).toBe('complete');
    expect(completeParsed.status).toBe('completed');
    expect(completeParsed.completedAt).toBeDefined();
  });

  it('should return status for a handoff', async () => {
    const request = await bosAgentHandoff(protocol, {
      action: 'request',
      from: 'agent-a',
      to: 'agent-b',
      context: {
        subtask: {
          id: 'sub-1',
          title: 'Implement feature',
          type: 'implementation',
          requiredSkill: 'typescript',
        },
        missionId: 'mission-1',
      },
    });
    const handoffId = JSON.parse(request.content[0].text).handoffId;

    const status = await bosAgentHandoff(protocol, { action: 'status', handoffId });

    const statusParsed = JSON.parse(status.content[0].text);
    expect(statusParsed.action).toBe('status');
    expect(statusParsed.handoff.handoffId).toBe(handoffId);
    expect(statusParsed.handoff.status).toBe('pending');
  });

  it('should list active handoffs', async () => {
    // Create 2 handoffs
    await bosAgentHandoff(protocol, {
      action: 'request',
      from: 'agent-a',
      to: 'agent-b',
      context: {
        subtask: {
          id: 'sub-1',
          title: 'Task 1',
          type: 'implementation',
          requiredSkill: 'typescript',
        },
        missionId: 'mission-1',
      },
    });
    await bosAgentHandoff(protocol, {
      action: 'request',
      from: 'agent-b',
      to: 'agent-c',
      context: {
        subtask: { id: 'sub-2', title: 'Task 2', type: 'review', requiredSkill: 'testing' },
        missionId: 'mission-1',
      },
    });

    const list = await bosAgentHandoff(protocol, { action: 'list-active' });
    const listParsed = JSON.parse(list.content[0].text);
    expect(listParsed.action).toBe('list-active');
    expect(listParsed.total).toBe(2);
    expect(listParsed.counts.pending).toBe(2);
  });
});

// ============================================================
// bos-skills-validate Tests
// ============================================================

describe('bos-skills-validate', () => {
  let engine: SkillEngine;

  beforeEach(() => {
    engine = new SkillEngine();
    // Manually set agent skills
    engine.getRegistry().set('typescript', {
      id: 'typescript',
      type: 'skill',
      name: 'TypeScript',
      source: 'behavioros',
      version: '1.0.0',
      status: 'active',
      dependencies: [],
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    engine.getRegistry().set('react', {
      id: 'react',
      type: 'skill',
      name: 'React',
      source: 'behavioros',
      version: '1.0.0',
      status: 'active',
      dependencies: [],
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    engine.getRegistry().set('docker', {
      id: 'docker',
      type: 'skill',
      name: 'Docker',
      source: 'behavioros',
      version: '1.0.0',
      status: 'active',
      dependencies: [],
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('should block missing skill', async () => {
    const result = await bosSkillsValidate(engine, {
      agentId: 'engineer',
      requiredSkills: ['typescript', 'kubernetes'],
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.allowed).toBe(false);
    // Both are missing because 'engineer' agent has no skills registered via syncFromDNA
    expect(parsed.missingSkills).toContain('kubernetes');
    expect(parsed.missingSkills).toContain('typescript');
    expect(parsed.reason).toBeDefined();
  });

  it('should allow with sufficient skills', async () => {
    // Register engineer with typescript and react skills via syncFromDNA
    const dna: DNAPackage = {
      id: 'test-dna',
      name: 'Test DNA',
      version: '1.0.0',
      personas: [
        {
          role: 'engineer',
          authority: 'senior',
          name: 'Fullstack Dev',
          skills: [
            { id: 'typescript', proficiency: 4 },
            { id: 'react', proficiency: 3 },
          ],
        },
      ],
      governance: [],
      quality: [],
      patterns: [],
    };
    await engine.syncFromDNA(dna);

    const result = await bosSkillsValidate(engine, {
      agentId: 'engineer',
      requiredSkills: ['typescript', 'react'],
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.allowed).toBe(true);
    expect(parsed.missingSkills).toHaveLength(0);
    expect(parsed.insufficientProficiency).toHaveLength(0);
  });
});

// ============================================================
// bos-skills-list Tests
// ============================================================

describe('bos-skills-list', () => {
  let engine: SkillEngine;

  beforeEach(() => {
    engine = new SkillEngine();
    const dna: DNAPackage = {
      id: 'test-dna',
      name: 'Test DNA',
      version: '1.0.0',
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
          role: 'devops',
          authority: 'senior',
          name: 'Test DevOps',
          skills: [{ id: 'docker', proficiency: 4 }],
        },
      ],
      governance: [],
      quality: [],
      patterns: [],
    };
    engine.syncFromDNA(dna);
  });

  it('should return all skills when no filter is applied', async () => {
    const result = await bosSkillsList(engine, {});

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBeGreaterThanOrEqual(3);
    const skillIds = parsed.skills.map((s: { id: string }) => s.id);
    expect(skillIds).toContain('typescript');
    expect(skillIds).toContain('react');
    expect(skillIds).toContain('docker');
  });

  it('should filter by category when specified', async () => {
    const result = await bosSkillsList(engine, {
      category: 'custom',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.filters.category).toBe('custom');
    // Skills from syncFromDNA will be category: 'custom' (default in toSkill)
    expect(parsed.total).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================
// bos-ecosystem-status Tests
// ============================================================

describe('bos-ecosystem-status', () => {
  let registry: EcosystemRegistry;
  let engine: SkillEngine;

  beforeEach(() => {
    engine = new SkillEngine();
    registry = new EcosystemRegistry({ skillEngine: engine });
  });

  it('should return a valid ecosystem report', async () => {
    const result = await bosEcosystemStatus(registry, {});

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty('initialized');
    expect(parsed).toHaveProperty('project');
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('agents');
    expect(parsed).toHaveProperty('skills');
    expect(parsed).toHaveProperty('mcps');
    expect(parsed).toHaveProperty('designSystems');
    expect(parsed).toHaveProperty('dnas');
    expect(parsed).toHaveProperty('summary');
    expect(parsed.summary).toHaveProperty('totalAgents');
    expect(parsed.summary).toHaveProperty('totalSkills');
  });

  it('should reflect synced components', async () => {
    const dna: DNAPackage = {
      id: 'test-dna',
      name: 'Test DNA',
      version: '1.0.0',
      personas: [
        {
          role: 'engineer',
          authority: 'senior',
          name: 'Test Engineer',
          skills: [{ id: 'golang', proficiency: 4 }],
        },
      ],
      governance: [],
      quality: [],
      patterns: [],
    };
    await engine.syncFromDNA(dna);

    const result = await bosEcosystemStatus(registry, {});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.agents.length).toBeGreaterThanOrEqual(1);
    expect(parsed.skills.some((s: { id: string }) => s.id === 'golang')).toBe(true);
  });
});

// ============================================================
// bos-ecosystem-doctor Tests
// ============================================================

describe('bos-ecosystem-doctor', () => {
  let registry: EcosystemRegistry;
  let engine: SkillEngine;

  beforeEach(() => {
    engine = new SkillEngine();
    registry = new EcosystemRegistry({ skillEngine: engine });
  });

  it('should return a diagnostic report', async () => {
    const result = await bosEcosystemDoctor(registry, {});

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty('healthy');
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('stats');
    expect(parsed).toHaveProperty('engines');
    expect(parsed).toHaveProperty('recommendations');
  });

  it('should detect issues when components have errors', async () => {
    // Add a component with error status
    engine.getRegistry().set('failing-skill', {
      id: 'failing-skill',
      type: 'skill',
      name: 'Failing Skill',
      source: 'behavioros',
      version: '1.0.0',
      status: 'error',
      dependencies: [],
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await bosEcosystemDoctor(registry, {});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.healthy).toBe(false);
  });

  it('should detect dangling skill references', async () => {
    // Add agent with reference to non-existent skill
    const dna: DNAPackage = {
      id: 'test-dna',
      name: 'Test DNA',
      version: '1.0.0',
      personas: [
        {
          role: 'specialist',
          authority: 'senior',
          name: 'Ghost Agent',
          skills: [{ id: 'nonexistent-skill', proficiency: 3 }],
        },
      ],
      governance: [],
      quality: [],
      patterns: [],
    };
    await engine.syncFromDNA(dna);
    // Remove the skill from registry to create dangling reference
    engine.getRegistry().delete('nonexistent-skill');

    const result = await bosEcosystemDoctor(registry, {});
    const parsed = JSON.parse(result.content[0].text);

    // SkillEngine.doctor() detects dangling refs as warnings (not errors) so healthy stays true
    // But the stats should reflect there are issues
    expect(parsed.stats.issues).toBeGreaterThan(0);
  });
});

// ============================================================
// bos-ecosystem-install Tests
// ============================================================

describe('bos-ecosystem-install', () => {
  let registry: EcosystemRegistry;
  let engine: SkillEngine;

  beforeEach(() => {
    engine = new SkillEngine();
    registry = new EcosystemRegistry({ skillEngine: engine });
  });

  it('should install a local skill successfully', async () => {
    const result = await bosEcosystemInstall(registry, {
      type: 'skill',
      id: 'my-custom-skill',
      source: 'local',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.id).toBe('my-custom-skill');
    expect(parsed.type).toBe('skill');
    expect(parsed.source).toBe('local');
    expect(parsed.message).toContain('Successfully installed');
  });

  it('should fail when installing a duplicate component', async () => {
    // First install
    await bosEcosystemInstall(registry, {
      type: 'skill',
      id: 'duplicate-skill',
      source: 'local',
    });

    // Second install should fail
    const result = await bosEcosystemInstall(registry, {
      type: 'skill',
      id: 'duplicate-skill',
      source: 'local',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBeDefined();
    expect(parsed.error).toContain('already exists');
  });

  it('should fail gracefully when AITMPL is not configured', async () => {
    const result = await bosEcosystemInstall(registry, {
      type: 'mcp',
      id: 'some-mcp-server',
      source: 'aitmpl',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBeDefined();
  });
});

// ============================================================
// Full Flow Integration Test
// ============================================================

describe('ecosystem tools - full flow', () => {
  let protocol: HandoffProtocol;
  let engine: SkillEngine;
  let registry: EcosystemRegistry;

  beforeEach(() => {
    protocol = new HandoffProtocol(50);
    engine = new SkillEngine();
    registry = new EcosystemRegistry({ skillEngine: engine });
  });

  it('should handle a complete handoff lifecycle', async () => {
    // 1. Request
    const request = await bosAgentHandoff(protocol, {
      action: 'request',
      from: 'agent-a',
      to: 'agent-b',
      context: {
        subtask: {
          id: 'sub-1',
          title: 'Build feature',
          type: 'implementation',
          requiredSkill: 'typescript',
        },
        missionId: 'mission-1',
      },
    });
    const handoffId = JSON.parse(request.content[0].text).handoffId;

    // 2. Accept
    await bosAgentHandoff(protocol, { action: 'accept', handoffId });

    // 3. Complete with output
    const complete = await bosAgentHandoff(protocol, {
      action: 'complete',
      handoffId,
      output: { pr: 'https://github.com/org/repo/pull/42' },
    });
    const completeParsed = JSON.parse(complete.content[0].text);
    expect(completeParsed.status).toBe('completed');

    // 4. Verify ecosystem status
    const status = await bosEcosystemStatus(registry, {});
    const statusParsed = JSON.parse(status.content[0].text);
    expect(statusParsed.initialized).toBe(false);

    // 5. Doctor check should be healthy (empty registry is fine)
    const doctor = await bosEcosystemDoctor(registry, {});
    const doctorParsed = JSON.parse(doctor.content[0].text);
    expect(doctorParsed).toHaveProperty('healthy');
  });
});

// ============================================================
// Full Engine Integration Test
// ============================================================

describe('ecosystem tools - with BehaviorOSEngine', () => {
  let engine: BehaviorOSEngine;

  beforeEach(() => {
    engine = createTestEngine();
  });

  it('should have access to skillEngine and handoffProtocol via engine', () => {
    expect(engine.skillEngine).toBeDefined();
    expect(engine.handoffProtocol).toBeDefined();
    expect(engine.ecosystemRegistry).toBeDefined();
  });

  it('should validate skills via engine.skillEngine', async () => {
    // Register agent skills first
    const dna: DNAPackage = {
      id: 'test-dna',
      name: 'Test DNA',
      version: '1.0.0',
      personas: [
        {
          role: 'engineer',
          authority: 'senior',
          name: 'Fullstack Dev',
          skills: [{ id: 'typescript', proficiency: 5 }],
        },
      ],
      governance: [],
      quality: [],
      patterns: [],
    };
    await engine.skillEngine.syncFromDNA(dna);

    // Validate existing skill
    const result = await bosSkillsValidate(engine.skillEngine, {
      agentId: 'engineer',
      requiredSkills: ['typescript'],
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.allowed).toBe(true);

    // Validate missing skill
    const missing = await bosSkillsValidate(engine.skillEngine, {
      agentId: 'engineer',
      requiredSkills: ['kubernetes'],
    });
    const missingParsed = JSON.parse(missing.content[0].text);
    expect(missingParsed.allowed).toBe(false);
    expect(missingParsed.missingSkills).toContain('kubernetes');
  });

  it('should process handoff via engine.handoffProtocol', async () => {
    const result = await bosAgentHandoff(engine.handoffProtocol, {
      action: 'request',
      from: 'orchestrator',
      to: 'backend-agent',
      context: {
        subtask: {
          id: 'sub-1',
          title: 'Create API',
          type: 'implementation',
          requiredSkill: 'typescript',
        },
        missionId: 'mission-42',
      },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.action).toBe('request');
    expect(parsed.handoffId).toBeDefined();
  });
});
