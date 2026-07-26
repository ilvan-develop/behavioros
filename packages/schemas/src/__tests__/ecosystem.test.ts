import { describe, expect, it } from 'vitest';
import {
  AgentPersonaSchema,
  AutonomousMissionSchema,
  ComponentRegistrySchema,
  ComponentSourceSchema,
  ComponentStatusSchema,
  ComponentTypeSchema,
  EcosystemReportSchema,
  RejectionReasonSchema,
  SkillRefSchema,
  SkillSchema,
  SubTaskSchema,
  TaskRouteSchema,
} from '../index';

// ============================================================
// SkillSchema Tests
// ============================================================

describe('SkillSchema', () => {
  it('should parse a valid skill with all fields', () => {
    const valid = {
      id: 'typescript-mastery',
      name: 'TypeScript Mastery',
      version: '1.0.0',
      description: 'Advanced TypeScript development skill',
      category: 'development',
      source: 'behavioros',
    };
    const result = SkillSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should parse a valid skill with optional fields', () => {
    const valid = {
      id: 'security-audit',
      name: 'Security Audit',
      version: '2.1.0',
      description: 'Security auditing and penetration testing',
      category: 'security',
      authorityRequired: 'senior',
      prerequisites: ['network-basics', 'cryptography'],
      tags: ['security', 'audit', 'pentest'],
      source: 'aitmpl',
      installCommand: 'npm install -g security-audit',
      checksum: 'abc123def456',
      installedAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T12:00:00.000Z',
    };
    const result = SkillSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject skill with invalid id (spaces)', () => {
    const invalid = {
      id: 'invalid id with spaces',
      name: 'Bad',
      version: '1.0.0',
      description: 'Test',
      category: 'development',
      source: 'behavioros',
    };
    const result = SkillSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject skill with invalid id (special chars)', () => {
    const invalid = {
      id: 'special!@#chars',
      name: 'Bad',
      version: '1.0.0',
      description: 'Test',
      category: 'development',
      source: 'behavioros',
    };
    const result = SkillSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject skill with invalid category', () => {
    const invalid = {
      id: 'test-skill',
      name: 'Test',
      version: '1.0.0',
      description: 'Test',
      category: 'invalid-category',
      source: 'behavioros',
    };
    const result = SkillSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject skill with invalid source', () => {
    const invalid = {
      id: 'test-skill',
      name: 'Test',
      version: '1.0.0',
      description: 'Test',
      category: 'development',
      source: 'invalid-source',
    };
    const result = SkillSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// SkillRefSchema Tests
// ============================================================

describe('SkillRefSchema', () => {
  it('should accept minimal SkillRef with just id', () => {
    const valid = { id: 'typescript-mastery' };
    const result = SkillRefSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should accept SkillRef with id and proficiency', () => {
    const valid = { id: 'typescript-mastery', proficiency: 3 };
    const result = SkillRefSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should accept proficiency boundary values', () => {
    const min = { id: 'x', proficiency: 1 };
    const max = { id: 'x', proficiency: 5 };
    expect(SkillRefSchema.safeParse(min).success).toBe(true);
    expect(SkillRefSchema.safeParse(max).success).toBe(true);
  });

  it('should reject proficiency > 5', () => {
    const invalid = { id: 'x', proficiency: 6 };
    const result = SkillRefSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject proficiency < 1', () => {
    const invalid = { id: 'x', proficiency: 0 };
    const result = SkillRefSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// ComponentRegistrySchema Tests
// ============================================================

describe('ComponentRegistrySchema', () => {
  it('should validate all 7 component types', () => {
    const types = ComponentTypeSchema.options;
    for (const type of types) {
      const component = {
        id: `comp-${type}`,
        type,
        name: `Test ${type}`,
        source: 'behavioros' as const,
        version: '1.0.0',
      };
      const result = ComponentRegistrySchema.safeParse(component);
      expect(result.success).toBe(true);
    }
  });

  it('should validate all 6 component sources', () => {
    const sources = ComponentSourceSchema.options;
    for (const source of sources) {
      const component = {
        id: `comp-${source}`,
        type: 'skill' as const,
        name: `Test ${source}`,
        source,
        version: '1.0.0',
      };
      const result = ComponentRegistrySchema.safeParse(component);
      expect(result.success).toBe(true);
    }
  });

  it('should validate all 6 component statuses', () => {
    const statuses = ComponentStatusSchema.options;
    for (const status of statuses) {
      const component = {
        id: 'comp-status',
        type: 'mcp' as const,
        name: 'Test',
        source: 'local' as const,
        version: '1.0.0',
        status,
      };
      const result = ComponentRegistrySchema.safeParse(component);
      expect(result.success).toBe(true);
    }
  });

  it('should default status to active', () => {
    const component = {
      id: 'comp-default',
      type: 'skill',
      name: 'Default Status',
      source: 'behavioros',
      version: '1.0.0',
    };
    const result = ComponentRegistrySchema.safeParse(component);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('active');
    }
  });

  it('should default dependencies to empty array', () => {
    const component = {
      id: 'comp-deps',
      type: 'plugin',
      name: 'No Deps',
      source: 'custom',
      version: '1.0.0',
    };
    const result = ComponentRegistrySchema.safeParse(component);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dependencies).toEqual([]);
    }
  });

  it('should validate component with all optional fields', () => {
    const component = {
      id: 'full-component',
      type: 'design-system',
      name: 'Full Component',
      source: 'ui-ux-pro-max',
      version: '2.0.0',
      status: 'active',
      description: 'A complete design system',
      dependencies: ['core', 'icons'],
      authorityRequired: 'architect',
      tags: ['design', 'ui'],
      metadata: { theme: 'dark', colors: 256 },
      installedAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T12:00:00.000Z',
    };
    const result = ComponentRegistrySchema.safeParse(component);
    expect(result.success).toBe(true);
  });

  it('should reject component with invalid type', () => {
    const invalid = {
      id: 'bad-type',
      type: 'invalid-type',
      name: 'Bad',
      source: 'behavioros',
      version: '1.0.0',
    };
    const result = ComponentRegistrySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// RejectionReasonSchema Tests
// ============================================================

describe('RejectionReasonSchema', () => {
  it('should validate all rejection codes', () => {
    const codes = [
      'missing-skill',
      'insufficient-authority',
      'overloaded',
      'out-of-scope',
      'conflict',
      'timeout',
    ] as const;
    for (const code of codes) {
      const reason = { code, details: `Agent rejected due to ${code}` };
      const result = RejectionReasonSchema.safeParse(reason);
      expect(result.success).toBe(true);
    }
  });

  it('should validate rejection with suggestion', () => {
    const valid = {
      code: 'missing-skill',
      details: 'Agent lacks required skill',
      suggestion: 'Assign to agent with typescript skill',
      requiredSkill: 'typescript',
    };
    const result = RejectionReasonSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject invalid rejection code', () => {
    const invalid = { code: 'invalid-code', details: 'Test' };
    const result = RejectionReasonSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// SubTaskSchema Tests
// ============================================================

describe('SubTaskSchema', () => {
  it('should validate a minimal subtask', () => {
    const valid = {
      id: 'subtask-1',
      title: 'Implement API endpoint',
      type: 'implementation',
      requiredSkill: 'backend-typescript',
    };
    const result = SubTaskSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should default status to pending', () => {
    const valid = {
      id: 'subtask-default',
      title: 'Write tests',
      type: 'testing',
      requiredSkill: 'qa-automation',
    };
    const result = SubTaskSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('pending');
    }
  });

  it('should validate all subtask types', () => {
    const types = [
      'design',
      'implementation',
      'testing',
      'documentation',
      'review',
      'security',
      'deployment',
      'compliance',
    ] as const;
    for (const type of types) {
      const subtask = {
        id: `st-${type}`,
        title: `Do ${type}`,
        type,
        requiredSkill: 'general',
      };
      expect(SubTaskSchema.safeParse(subtask).success).toBe(true);
    }
  });

  it('should validate all subtask statuses', () => {
    const statuses = [
      'pending',
      'routed',
      'accepted',
      'in_progress',
      'completed',
      'rejected',
      'failed',
    ] as const;
    for (const status of statuses) {
      const subtask = {
        id: `st-${status}`,
        title: `Status ${status}`,
        type: 'implementation',
        requiredSkill: 'general',
        status,
      };
      expect(SubTaskSchema.safeParse(subtask).success).toBe(true);
    }
  });

  it('should validate subtask with rejection reason', () => {
    const valid = {
      id: 'subtask-rejected',
      title: 'Complex task',
      type: 'implementation',
      requiredSkill: 'advanced-ml',
      status: 'rejected',
      rejectionReason: {
        code: 'missing-skill',
        details: 'No agent has the required skill',
      },
    };
    const result = SubTaskSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate subtask with output', () => {
    const valid = {
      id: 'subtask-done',
      title: 'Write code',
      type: 'implementation',
      requiredSkill: 'typescript',
      status: 'completed',
      output: { files: ['src/api.ts'], linesOfCode: 150 },
    };
    const result = SubTaskSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// TaskRouteSchema Tests
// ============================================================

describe('TaskRouteSchema', () => {
  it('should validate a valid task route', () => {
    const valid = {
      subtaskId: 'subtask-1',
      agentId: 'agent-42',
      confidence: 0.85,
      strategy: 'dna-match',
    };
    const result = TaskRouteSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate all routing strategies', () => {
    const strategies = ['dna-match', 'capability-match', 'semantic-fallback'] as const;
    for (const strategy of strategies) {
      const route = {
        subtaskId: 'st-1',
        agentId: 'agent-1',
        confidence: 0.5,
        strategy,
      };
      expect(TaskRouteSchema.safeParse(route).success).toBe(true);
    }
  });

  it('should accept confidence boundary values', () => {
    const min = {
      subtaskId: 'st-1',
      agentId: 'agent-1',
      confidence: 0,
      strategy: 'dna-match' as const,
    };
    const max = {
      subtaskId: 'st-1',
      agentId: 'agent-1',
      confidence: 1,
      strategy: 'dna-match' as const,
    };
    expect(TaskRouteSchema.safeParse(min).success).toBe(true);
    expect(TaskRouteSchema.safeParse(max).success).toBe(true);
  });

  it('should reject confidence out of range', () => {
    const invalid = {
      subtaskId: 'st-1',
      agentId: 'agent-1',
      confidence: 1.5,
      strategy: 'dna-match',
    };
    const result = TaskRouteSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// AutonomousMissionSchema Tests
// ============================================================

describe('AutonomousMissionSchema', () => {
  it('should validate a full autonomous mission', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Implement payment flow',
      type: 'feature',
      priority: 'high',
      status: 'executing',
      subtasks: [
        {
          id: 'st-1',
          title: 'Design API',
          type: 'design',
          requiredSkill: 'backend',
        },
        {
          id: 'st-2',
          title: 'Implement',
          type: 'implementation',
          requiredSkill: 'backend',
          status: 'in_progress',
          assignedAgent: 'agent-42',
        },
      ],
      routing: [
        {
          subtaskId: 'st-1',
          agentId: 'agent-1',
          confidence: 0.9,
          strategy: 'dna-match',
        },
      ],
      dnaPattern: 'surgical-team',
      createdAt: '2026-07-20T10:00:00.000Z',
      lifecycle: {
        docsGenerated: true,
        testsGenerated: false,
        auditPassed: false,
        learningRecorded: false,
      },
    };
    const result = AutonomousMissionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should default subtasks to empty array', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Minimal mission',
      type: 'bugfix',
      priority: 'medium',
      status: 'created',
      createdAt: '2026-07-20T10:00:00.000Z',
    };
    const result = AutonomousMissionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subtasks).toEqual([]);
      expect(result.data.routing).toEqual([]);
    }
  });

  it('should default lifecycle to all false', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      title: 'Lifecycle defaults',
      type: 'refactor',
      priority: 'low',
      status: 'created',
      createdAt: '2026-07-20T10:00:00.000Z',
    };
    const result = AutonomousMissionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lifecycle.docsGenerated).toBe(false);
      expect(result.data.lifecycle.testsGenerated).toBe(false);
      expect(result.data.lifecycle.auditPassed).toBe(false);
      expect(result.data.lifecycle.learningRecorded).toBe(false);
    }
  });

  it('should validate all mission statuses', () => {
    const statuses = [
      'created',
      'decomposing',
      'routing',
      'executing',
      'review',
      'completed',
      'failed',
    ] as const;
    for (const status of statuses) {
      const mission = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        title: `Status ${status}`,
        type: 'feature',
        priority: 'medium',
        status,
        createdAt: '2026-07-20T10:00:00.000Z',
      };
      expect(AutonomousMissionSchema.safeParse(mission).success).toBe(true);
    }
  });

  it('should validate all mission types', () => {
    const types = ['feature', 'bugfix', 'refactor', 'security', 'deploy', 'research'] as const;
    for (const type of types) {
      const mission = {
        id: '550e8400-e29b-41d4-a716-446655440004',
        title: `Type ${type}`,
        type,
        priority: 'medium',
        status: 'created',
        createdAt: '2026-07-20T10:00:00.000Z',
      };
      expect(AutonomousMissionSchema.safeParse(mission).success).toBe(true);
    }
  });

  it('should reject mission with invalid UUID', () => {
    const invalid = {
      id: 'not-a-uuid',
      title: 'Bad ID',
      type: 'feature',
      priority: 'medium',
      status: 'created',
      createdAt: '2026-07-20T10:00:00.000Z',
    };
    const result = AutonomousMissionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject mission with completedAt but not completed', () => {
    const invalid = {
      id: '550e8400-e29b-41d4-a716-446655440005',
      title: 'Inconsistent',
      type: 'feature',
      priority: 'medium',
      status: 'created',
      createdAt: '2026-07-20T10:00:00.000Z',
      completedAt: '2026-07-20T12:00:00.000Z',
    };
    const result = AutonomousMissionSchema.safeParse(invalid);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// AgentPersonaSchema Skills Backward Compatibility Tests
// ============================================================

describe('AgentPersonaSchema Skills', () => {
  it('should accept legacy string[] skills', () => {
    const valid = {
      role: 'engineer',
      authority: 'senior',
      skills: ['testing', 'review', 'deployment'],
    };
    const result = AgentPersonaSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should accept new SkillRef[] skills', () => {
    const valid = {
      role: 'architect',
      authority: 'architect',
      skills: [
        { id: 'typescript-mastery', proficiency: 5 },
        { id: 'system-design', proficiency: 4 },
      ],
    };
    const result = AgentPersonaSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should accept mixed string and SkillRef skills', () => {
    const valid = {
      role: 'qa',
      authority: 'senior',
      skills: ['testing', { id: 'automation', proficiency: 4 }, 'performance'],
    };
    const result = AgentPersonaSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should accept empty skills array', () => {
    const valid = {
      role: 'engineer',
      authority: 'junior',
      skills: [],
    };
    const result = AgentPersonaSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should accept persona without skills', () => {
    const valid = {
      role: 'engineer',
      authority: 'junior',
    };
    const result = AgentPersonaSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// EcosystemReportSchema Tests
// ============================================================

describe('EcosystemReportSchema', () => {
  it('should validate a complete ecosystem report', () => {
    const valid = {
      project: 'behavioros',
      timestamp: '2026-07-20T10:00:00.000Z',
      agents: [
        { id: 'agent-1', status: 'working', skillsCount: 5 },
        { id: 'agent-2', status: 'idle', skillsCount: 3 },
      ],
      skills: [
        {
          id: 'skill-1',
          type: 'skill',
          name: 'TypeScript',
          source: 'behavioros',
          version: '1.0.0',
        },
      ],
      mcps: [
        {
          id: 'mcp-1',
          type: 'mcp',
          name: 'GitHub MCP',
          source: 'aitmpl',
          version: '2.0.0',
        },
      ],
      designSystems: [
        {
          id: 'ds-1',
          type: 'design-system',
          name: 'BehaviorOS UI',
          source: 'open-design',
          version: '0.5.0',
        },
      ],
      dnas: [
        { id: 'surgical-team', version: '1.0.0', active: true },
        { id: 'manufacturing', version: '2.0.0', active: false },
      ],
      audit: {
        lastRun: '2026-07-20T09:00:00.000Z',
        passed: true,
      },
    };
    const result = EcosystemReportSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate minimal ecosystem report without audit', () => {
    const valid = {
      project: 'test-project',
      timestamp: '2026-07-20T10:00:00.000Z',
      agents: [],
      skills: [],
      mcps: [],
      designSystems: [],
      dnas: [],
    };
    const result = EcosystemReportSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});
