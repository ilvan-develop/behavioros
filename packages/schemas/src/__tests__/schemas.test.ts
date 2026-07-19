import { describe, expect, it } from 'vitest';
import {
  AgentPersonaSchema,
  AgentRoleSchema,
  AgentStateSchema,
  AuditEventSchema,
  AuthorityLevelSchema,
  BehaviorPatternSchema,
  BoundaryRuleSchema,
  DNABehavioralPatternSchema,
  DNAPackageSchema,
  GovernanceRuleSchema,
  LearningEventSchema,
  MissionSchema,
  PipelineReportSchema,
  PipelineStateSchema,
  QualityGateSchema,
  WorkflowStepSchema,
} from '../index';

// ============================================================
// DNAPackageSchema Tests
// ============================================================

describe('DNAPackageSchema', () => {
  it('should validate a minimal valid DNAPackage', () => {
    const valid = {
      id: 'test-dna',
      name: 'Test DNA',
      version: '1.0.0',
      personas: [{ role: 'engineer', authority: 'senior' }],
    };
    const result = DNAPackageSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate a full DNAPackage with all fields', () => {
    const valid = {
      id: 'full-dna',
      name: 'Full DNA',
      version: '2.0.0',
      description: 'A complete DNA package',
      author: 'Test Author',
      license: 'MIT',
      tags: ['test', 'example'],
      personas: [{ role: 'architect', authority: 'architect', name: 'Lead Architect' }],
      governance: [{ id: 'g1', name: 'Rule 1', level: 'high', action: 'block' }],
      quality: [{ id: 'q1', name: 'Coverage', type: 'test_coverage', threshold: 80 }],
      patterns: [{ id: 'p1', name: 'Pattern 1', type: 'decision' }],
      workflows: [{ id: 'w1', name: 'Step 1', type: 'action' }],
    };
    const result = DNAPackageSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject DNAPackage without required fields', () => {
    const invalid = { name: 'Missing fields' };
    const result = DNAPackageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject DNAPackage with empty personas array', () => {
    const invalid = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      personas: [],
    };
    const result = DNAPackageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject DNAPackage with invalid persona role', () => {
    const invalid = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      personas: [{ role: 'invalid-role', authority: 'senior' }],
    };
    const result = DNAPackageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// GovernanceRuleSchema Tests
// ============================================================

describe('GovernanceRuleSchema', () => {
  it('should validate minimal governance rule', () => {
    const valid = { id: 'r1', name: 'Rule', level: 'medium', action: 'warn' };
    const result = GovernanceRuleSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate all level/action combinations', () => {
    const levels = ['critical', 'high', 'medium', 'low'] as const;
    const actions = ['block', 'warn', 'log', 'escalate', 'auto_approve'] as const;

    for (const level of levels) {
      for (const action of actions) {
        const rule = { id: `r-${level}-${action}`, name: 'Rule', level, action };
        const result = GovernanceRuleSchema.safeParse(rule);
        expect(result.success).toBe(true);
      }
    }
  });

  it('should validate rule with scope and conditions', () => {
    const valid = {
      id: 'r2',
      name: 'Scoped Rule',
      level: 'high',
      action: 'block',
      scope: ['deploy', 'production'],
      conditions: ['type:security'],
    };
    const result = GovernanceRuleSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate rule with description', () => {
    const valid = {
      id: 'r3',
      name: 'Described Rule',
      description: 'A rule with description',
      level: 'low',
      action: 'log',
    };
    const result = GovernanceRuleSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject rule with invalid level', () => {
    const invalid = { id: 'r1', name: 'Rule', level: 'invalid', action: 'block' };
    const result = GovernanceRuleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject rule with invalid action', () => {
    const invalid = { id: 'r1', name: 'Rule', level: 'high', action: 'invalid' };
    const result = GovernanceRuleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject rule missing required fields', () => {
    const invalid = { name: 'Rule' };
    const result = GovernanceRuleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// QualityGateSchema Tests
// ============================================================

describe('QualityGateSchema', () => {
  it('should validate minimal quality gate', () => {
    const valid = { id: 'q1', name: 'Gate', type: 'test_coverage' };
    const result = QualityGateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate all gate types', () => {
    const types = [
      'test_coverage',
      'lint',
      'typecheck',
      'security',
      'performance',
      'custom',
    ] as const;
    for (const type of types) {
      const gate = { id: `q-${type}`, name: 'Gate', type };
      const result = QualityGateSchema.safeParse(gate);
      expect(result.success).toBe(true);
    }
  });

  it('should validate gate with threshold boundary values', () => {
    const minThreshold = { id: 'q1', name: 'Min', type: 'test_coverage', threshold: 0 };
    const maxThreshold = { id: 'q2', name: 'Max', type: 'performance', threshold: 100 };
    expect(QualityGateSchema.safeParse(minThreshold).success).toBe(true);
    expect(QualityGateSchema.safeParse(maxThreshold).success).toBe(true);
  });

  it('should validate gate with pass boolean', () => {
    const passTrue = { id: 'q1', name: 'Pass', type: 'lint', pass: true };
    const passFalse = { id: 'q2', name: 'Fail', type: 'lint', pass: false };
    expect(QualityGateSchema.safeParse(passTrue).success).toBe(true);
    expect(QualityGateSchema.safeParse(passFalse).success).toBe(true);
  });

  it('should validate gate with config', () => {
    const valid = {
      id: 'q1',
      name: 'Custom',
      type: 'custom',
      config: { pattern: '*.ts', maxErrors: 0 },
    };
    const result = QualityGateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject gate with invalid type', () => {
    const invalid = { id: 'q1', name: 'Gate', type: 'invalid' };
    const result = QualityGateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// AgentPersonaSchema Tests
// ============================================================

describe('AgentPersonaSchema', () => {
  it('should validate minimal persona', () => {
    const valid = { role: 'engineer', authority: 'senior' };
    const result = AgentPersonaSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate all agent roles', () => {
    const roles = AgentRoleSchema.options;
    for (const role of roles) {
      const persona = { role, authority: 'senior' };
      const result = AgentPersonaSchema.safeParse(persona);
      expect(result.success).toBe(true);
    }
  });

  it('should validate all authority levels', () => {
    const levels = AuthorityLevelSchema.options;
    for (const authority of levels) {
      const persona = { role: 'engineer', authority };
      const result = AgentPersonaSchema.safeParse(persona);
      expect(result.success).toBe(true);
    }
  });

  it('should validate persona with boundaries', () => {
    const valid = {
      role: 'architect',
      authority: 'architect',
      name: 'Lead',
      boundaries: [{ id: 'b1', name: 'Max files', type: 'max_files', value: 10, scope: 'per_pr' }],
    };
    const result = AgentPersonaSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate persona with skills and tools', () => {
    const valid = {
      role: 'qa',
      authority: 'senior',
      skills: ['testing', 'review'],
      tools: ['jest', 'playwright'],
    };
    const result = AgentPersonaSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// BoundaryRuleSchema Tests
// ============================================================

describe('BoundaryRuleSchema', () => {
  it('should validate all boundary types', () => {
    const types = [
      'max_files',
      'max_lines',
      'max_modules',
      'require_approval',
      'forbidden',
    ] as const;
    const scopes = ['per_commit', 'per_pr', 'per_session', 'global'] as const;
    for (const type of types) {
      for (const scope of scopes) {
        const rule = { id: 'b1', name: 'Boundary', type, value: 10, scope };
        const result = BoundaryRuleSchema.safeParse(rule);
        expect(result.success).toBe(true);
      }
    }
  });
});

// ============================================================
// BehaviorPatternSchema Tests
// ============================================================

describe('BehaviorPatternSchema', () => {
  it('should validate minimal pattern', () => {
    const valid = { id: 'p1', name: 'Pattern', type: 'decision' };
    const result = BehaviorPatternSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate all pattern types', () => {
    const types = [
      'decision',
      'collaboration',
      'escalation',
      'review',
      'testing',
      'deployment',
      'monitoring',
      'learning',
      'communication',
      'custom',
    ] as const;
    for (const type of types) {
      const pattern = { id: `p-${type}`, name: 'Pattern', type };
      const result = BehaviorPatternSchema.safeParse(pattern);
      expect(result.success).toBe(true);
    }
  });

  it('should validate pattern with triggers, actions, conditions', () => {
    const valid = {
      id: 'p1',
      name: 'Full Pattern',
      type: 'deployment',
      triggers: ['deploy_started'],
      actions: ['validate', 'deploy'],
      conditions: ['env:production'],
    };
    const result = BehaviorPatternSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// WorkflowStepSchema Tests
// ============================================================

describe('WorkflowStepSchema', () => {
  it('should validate minimal workflow step', () => {
    const valid = { id: 'w1', name: 'Step', type: 'action' };
    const result = WorkflowStepSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate all step types', () => {
    const types = ['action', 'decision', 'parallel', 'conditional', 'loop', 'gate'] as const;
    for (const type of types) {
      const step = { id: `w-${type}`, name: 'Step', type };
      const result = WorkflowStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    }
  });
});

// ============================================================
// MissionSchema Tests
// ============================================================

describe('MissionSchema', () => {
  it('should validate a minimal mission', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Test Mission',
      type: 'feature',
    };
    const result = MissionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate mission with all fields', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Full Mission',
      description: 'A complete mission',
      type: 'bugfix',
      priority: 'critical',
      status: 'executing',
      assignees: ['agent-1'],
      labels: ['urgent'],
      context: { env: 'production' },
      input: { pr: '#142' },
      output: { deployUrl: 'https://example.com' },
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-02T00:00:00.000Z',
      deadline: '2026-01-03T00:00:00.000Z',
    };
    const result = MissionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject mission with invalid UUID', () => {
    const invalid = { id: 'not-a-uuid', title: 'Bad ID', type: 'feature' };
    const result = MissionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject mission with empty title', () => {
    const invalid = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      title: '',
      type: 'feature',
    };
    const result = MissionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject mission with invalid type', () => {
    const invalid = {
      id: '550e8400-e29b-41d4-a716-446655440003',
      title: 'Bad Type',
      type: 'invalid',
    };
    const result = MissionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// AuditEventSchema Tests
// ============================================================

describe('AuditEventSchema', () => {
  it('should validate a minimal audit event', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-01T00:00:00.000Z',
      type: 'commit',
      description: 'Code committed',
    };
    const result = AuditEventSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate event with all severities and results', () => {
    const severities = ['info', 'warning', 'error', 'critical'] as const;
    const results = ['pass', 'fail', 'warn', 'skip'] as const;
    for (const severity of severities) {
      for (const result of results) {
        const event = {
          id: '550e8400-e29b-41d4-a716-446655440004',
          timestamp: '2026-01-01T00:00:00.000Z',
          type: 'test',
          severity,
          result,
          description: 'Test event',
        };
        expect(AuditEventSchema.safeParse(event).success).toBe(true);
      }
    }
  });
});

// ============================================================
// LearningEventSchema Tests
// ============================================================

describe('LearningEventSchema', () => {
  it('should validate a minimal learning event', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-01T00:00:00.000Z',
      type: 'observation',
      source: 'test',
      data: { key: 'value' },
    };
    const result = LearningEventSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate all event types', () => {
    const types = ['observation', 'pattern', 'insight', 'feedback', 'correction'] as const;
    for (const type of types) {
      const event = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        timestamp: '2026-01-01T00:00:00.000Z',
        type,
        source: 'test',
        data: {},
      };
      expect(LearningEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it('should validate confidence boundaries', () => {
    const min = {
      id: '550e8400-e29b-41d4-a716-446655440006',
      timestamp: '2026-01-01T00:00:00.000Z',
      type: 'observation' as const,
      source: 'test',
      data: {},
      confidence: 0,
    };
    const max = { ...min, confidence: 1 };
    expect(LearningEventSchema.safeParse(min).success).toBe(true);
    expect(LearningEventSchema.safeParse(max).success).toBe(true);
  });
});

// ============================================================
// PipelineStateSchema Tests
// ============================================================

describe('PipelineStateSchema', () => {
  it('should validate a minimal pipeline state', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      dnaId: 'test-dna',
      status: 'created',
      layers: [],
      overallScore: 0,
      overallStatus: 'pending',
    };
    const result = PipelineStateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate all pipeline statuses', () => {
    const statuses = ['created', 'running', 'paused', 'completed', 'failed'] as const;
    for (const status of statuses) {
      const state = {
        id: '550e8400-e29b-41d4-a716-446655440007',
        dnaId: 'test',
        status,
        layers: [],
        overallScore: 50,
        overallStatus: 'pass' as const,
      };
      expect(PipelineStateSchema.safeParse(state).success).toBe(true);
    }
  });
});

// ============================================================
// DNABehavioralPatternSchema Tests
// ============================================================

describe('DNABehavioralPatternSchema', () => {
  it('should validate a minimal behavioral pattern', () => {
    const valid = {
      meta: { version: '1.0.0' },
      identity: { name: 'Test', description: 'Test pattern', archetype: 'test', category: 'test' },
    };
    const result = DNABehavioralPatternSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate full behavioral pattern with principles and forbidden', () => {
    const valid = {
      meta: { version: '1.0.0', schema: 'v1', description: 'Full pattern' },
      identity: {
        name: 'Full',
        description: 'Full pattern',
        archetype: 'arch',
        category: 'cat',
        version: '1.0',
      },
      principles: [
        { id: 'pr1', statement: 'Be safe', priority: 'must', rationale: 'Safety first' },
      ],
      forbidden: [
        { id: 'f1', action: 'deploy without scan', consequence: 'block', severity: 'critical' },
      ],
    };
    const result = DNABehavioralPatternSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// AgentStateSchema Tests
// ============================================================

describe('AgentStateSchema', () => {
  it('should validate minimal agent state', () => {
    const valid = { id: 'agent-1', role: 'engineer' };
    const result = AgentStateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate agent state with defaults', () => {
    const valid = { id: 'agent-2', role: 'qa' };
    const result = AgentStateSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('idle');
      expect(result.data.reputation).toBe(50);
    }
  });

  it('should validate agent with reputation bounds', () => {
    const min = { id: 'a', role: 'engineer' as const, reputation: 0 };
    const max = { id: 'b', role: 'engineer' as const, reputation: 100 };
    expect(AgentStateSchema.safeParse(min).success).toBe(true);
    expect(AgentStateSchema.safeParse(max).success).toBe(true);
  });

  it('should reject agent with reputation out of bounds', () => {
    const invalid = { id: 'a', role: 'engineer', reputation: 101 };
    const result = AgentStateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
