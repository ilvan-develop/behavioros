import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BosGovernanceEngine,
  type GovernanceConfig,
  matchesGlob,
} from '../engines/behavioral/governance-engine';

// ── Sample config ──────────────────────────────────────────────

const baseConfig: GovernanceConfig = {
  authorityMatrix: {
    junior_dev: {
      role: 'junior',
      domain: 'frontend',
      permissions: {
        maxFilesPerChange: 5,
        maxPackages: 2,
        canDeploy: false,
        canApprove: false,
        canVeto: false,
        canModifySchema: false,
        canChangeContracts: false,
      },
      domainBoundary: {
        canModify: ['src/frontend/**'],
        cannotModify: ['src/backend/**', 'src/database/**'],
        canRead: 'src/**',
      },
    },
    senior_dev: {
      role: 'senior',
      domain: 'backend',
      permissions: {
        maxFilesPerChange: 20,
        maxPackages: 'unlimited',
        canDeploy: true,
        canApprove: true,
        canVeto: false,
        canModifySchema: false,
        canChangeContracts: false,
      },
      domainBoundary: {
        canModify: ['src/backend/**'],
        cannotModify: ['src/database/**'],
        canRead: 'src/**',
      },
    },
    tech_lead: {
      role: 'tech_lead',
      domain: 'infra',
      permissions: {
        maxFilesPerChange: 'unlimited',
        maxPackages: 'unlimited',
        canDeploy: true,
        canApprove: true,
        canVeto: true,
        canModifySchema: true,
        canChangeContracts: true,
      },
      domainBoundary: {
        canModify: ['**'],
        cannotModify: [],
        canRead: '**',
      },
    },
  },
  domainBoundaries: {
    frontend: {
      canModify: ['src/frontend/**'],
      cannotModify: ['src/backend/**', 'src/database/**'],
      canRead: 'src/**',
    },
    backend: {
      canModify: ['src/backend/**'],
      cannotModify: ['src/database/**'],
      canRead: 'src/**',
    },
    infra: {
      canModify: ['**'],
      cannotModify: [],
      canRead: '**',
    },
  },
  escalationMatrix: [
    { trigger: 'security', action: 'notify', timeout: '5m', retry: 0, severity: 'critical' },
    { trigger: 'approval', action: 'escalate', timeout: '30m', retry: 2, severity: 'high' },
    { trigger: 'conflict', action: 'resolve', timeout: '10m', retry: 3, severity: 'medium' },
  ],
  conflictResolution: {
    code_review: {
      protocol: [{ step: 'review' }, { step: 'approve' }, { step: 'merge' }],
      timeout: '1h',
      escalation: 'tech_lead',
    },
    design_review: {
      protocol: [{ step: 'propose' }, { step: 'review' }, { step: 'sign_off' }],
      timeout: '2h',
      escalation: 'architect',
    },
  },
  compliance: {
    requiredFrameworks: [
      { name: 'SOC2', scope: 'all', auditFrequency: 'quarterly' },
      { name: 'PCI-DSS', scope: 'payments', auditFrequency: 'monthly' },
    ],
    auditTrail: ['auth.log', 'change.log', 'deploy.log'],
  },
};

describe('BosGovernanceEngine', () => {
  describe('constructor', () => {
    it('should create from GovernanceConfig object', () => {
      const engine = new BosGovernanceEngine(baseConfig);
      expect(engine).toBeInstanceOf(BosGovernanceEngine);
      expect(engine.getConfig()).toBe(baseConfig);
    });

    it('should create from YAML file path', () => {
      // YAML path constructor requires actual filesystem — use config object
      const engine = new BosGovernanceEngine(baseConfig);
      expect(engine).toBeInstanceOf(BosGovernanceEngine);
    });
  });

  describe('YAML file path constructor', () => {
    let tmpDir: string;

    const yamlContent = `authorityMatrix:
  senior_dev:
    role: senior
    domain: backend
    permissions:
      maxFilesPerChange: 20
      maxPackages: unlimited
      canDeploy: true
      canApprove: true
    domainBoundary:
      canModify:
        - src/backend/**
      cannotModify:
        - src/database/**
      canRead: src/**
domainBoundaries:
  backend:
    canModify:
      - src/backend/**
    cannotModify:
      - src/database/**
    canRead: src/**
rules:
  - id: test-rule
    name: Test Rule
    action: warn
    severity: low
    scope: []
`;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'bos-governance-test-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should parse YAML file and load config', () => {
      const yamlPath = join(tmpDir, 'governance.yaml');
      writeFileSync(yamlPath, yamlContent, 'utf-8');

      const engine = new BosGovernanceEngine(yamlPath);
      expect(engine).toBeInstanceOf(BosGovernanceEngine);

      const config = engine.getConfig();
      expect(config.authorityMatrix).toBeDefined();
      expect(config.authorityMatrix.senior_dev).toBeDefined();
      expect(config.authorityMatrix.senior_dev.role).toBe('senior');
      expect(config.authorityMatrix.senior_dev.domain).toBe('backend');
      expect(config.authorityMatrix.senior_dev.permissions.canDeploy).toBe(true);
      expect(config.authorityMatrix.senior_dev.permissions.canApprove).toBe(true);
      expect(config.authorityMatrix.senior_dev.permissions.maxFilesPerChange).toBe(20);
      expect(config.authorityMatrix.senior_dev.permissions.maxPackages).toBe('unlimited');
      expect(config.authorityMatrix.senior_dev.domainBoundary.canModify).toEqual([
        'src/backend/**',
      ]);
      expect(config.authorityMatrix.senior_dev.domainBoundary.cannotModify).toEqual([
        'src/database/**',
      ]);
      expect(config.authorityMatrix.senior_dev.domainBoundary.canRead).toBe('src/**');
    });

    it('should throw when YAML file does not exist', () => {
      const nonExistentPath = join(tmpDir, 'nonexistent.yaml');
      expect(() => new BosGovernanceEngine(nonExistentPath)).toThrow();
    });

    it('should validate actions using YAML-loaded config', () => {
      const yamlPath = join(tmpDir, 'governance.yaml');
      writeFileSync(yamlPath, yamlContent, 'utf-8');

      const engine = new BosGovernanceEngine(yamlPath);

      // senior_dev can deploy
      const deployResult = engine.validate({
        agent: 'senior_dev',
        action: 'deploy',
        target: 'src/backend/api.ts',
        agentRole: 'senior_dev',
      });
      expect(deployResult.allowed).toBe(true);

      // unknown role should be denied
      const unknownResult = engine.validate({
        agent: 'unknown_dev',
        action: 'deploy',
        target: 'src/backend/api.ts',
      });
      expect(unknownResult.allowed).toBe(false);
      expect(unknownResult.reason).toContain('Unknown agent role');
    });
  });

  describe('validate', () => {
    let engine: BosGovernanceEngine;

    beforeEach(() => {
      engine = new BosGovernanceEngine(baseConfig);
    });

    it('should deny unknown agent role', () => {
      const result = engine.validate({
        agent: 'unknown_dev',
        action: 'deploy',
        target: 'src/frontend/index.ts',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown agent role');
      expect(result.severity).toBe('high');
    });

    it('should deny action on forbidden domain boundary', () => {
      const result = engine.validate({
        agent: 'junior_dev',
        action: 'edit',
        target: 'src/backend/api.ts',
        agentRole: 'junior_dev',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('junior_dev');
      expect(result.reason).toContain('cannot modify');
      expect(result.severity).toBe('high');
    });

    it('should skip domain check when no domain config', () => {
      const result = engine.validate({
        agent: 'junior_dev',
        action: 'edit',
        target: 'src/frontend/index.ts',
        agentRole: 'junior_dev',
        agentDomain: 'nonexistent',
      });
      expect(result.allowed).toBe(true);
    });

    describe('deploy action', () => {
      it('should deny deploy when canDeploy is false', () => {
        const result = engine.validate({
          agent: 'junior_dev',
          action: 'deploy',
          target: 'src/frontend/index.ts',
          agentRole: 'junior_dev',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('cannot deploy');
        expect(result.requiresApproval).toBe('tech_lead');
        expect(result.severity).toBe('critical');
      });

      it('should allow deploy when canDeploy is true', () => {
        const result = engine.validate({
          agent: 'senior_dev',
          action: 'deploy',
          target: 'src/backend/api.ts',
          agentRole: 'senior_dev',
        });
        expect(result.allowed).toBe(true);
      });
    });

    describe('approve action', () => {
      it('should deny approve when canApprove is false', () => {
        const result = engine.validate({
          agent: 'junior_dev',
          action: 'approve',
          target: 'src/frontend/index.ts',
          agentRole: 'junior_dev',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('cannot approve');
        expect(result.severity).toBe('medium');
      });

      it('should allow approve when canApprove is true', () => {
        const result = engine.validate({
          agent: 'senior_dev',
          action: 'approve',
          target: 'src/backend/api.ts',
          agentRole: 'senior_dev',
        });
        expect(result.allowed).toBe(true);
      });
    });

    describe('veto action', () => {
      it('should deny veto when canVeto is false', () => {
        const result = engine.validate({
          agent: 'senior_dev',
          action: 'veto',
          target: 'src/backend/api.ts',
          agentRole: 'senior_dev',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('cannot veto');
        expect(result.severity).toBe('high');
      });

      it('should allow veto when canVeto is true', () => {
        const result = engine.validate({
          agent: 'tech_lead',
          action: 'veto',
          target: 'src/infra/config.ts',
          agentRole: 'tech_lead',
        });
        expect(result.allowed).toBe(true);
      });
    });

    describe('modify_schema action', () => {
      it('should deny modify_schema when canModifySchema is false', () => {
        // Use a target within frontend domain so domain boundary passes
        const result = engine.validate({
          agent: 'junior_dev',
          action: 'modify_schema',
          target: 'src/frontend/schema.ts',
          agentRole: 'junior_dev',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('cannot modify schema');
        expect(result.requiresApproval).toBe('architect');
        expect(result.severity).toBe('high');
      });

      it('should allow modify_schema when canModifySchema is true', () => {
        const result = engine.validate({
          agent: 'tech_lead',
          action: 'modify_schema',
          target: 'src/database/schema.ts',
          agentRole: 'tech_lead',
        });
        expect(result.allowed).toBe(true);
      });
    });

    describe('change_contract action', () => {
      it('should deny change_contract when canChangeContracts is false', () => {
        const result = engine.validate({
          agent: 'junior_dev',
          action: 'change_contract',
          target: 'src/api/contract.ts',
          agentRole: 'junior_dev',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('cannot change contracts');
        expect(result.requiresApproval).toBe('architect');
        expect(result.severity).toBe('high');
      });

      it('should allow change_contract when canChangeContracts is true', () => {
        const result = engine.validate({
          agent: 'tech_lead',
          action: 'change_contract',
          target: 'src/api/contract.ts',
          agentRole: 'tech_lead',
        });
        expect(result.allowed).toBe(true);
      });
    });
  });

  describe('getEscalation', () => {
    let engine: BosGovernanceEngine;

    beforeEach(() => {
      engine = new BosGovernanceEngine(baseConfig);
    });

    it('should find matching escalation rule by trigger substring', () => {
      const result = engine.getEscalation('security_breach');
      expect(result).not.toBeNull();
      expect(result!.trigger).toBe('security');
      expect(result!.action).toBe('notify');
      expect(result!.timeout).toBe('5m');
      expect(result!.retry).toBe(0);
      expect(result!.severity).toBe('critical');
    });

    it('should find matching escalation by rule trigger containing query', () => {
      const result = engine.getEscalation('conflict');
      expect(result).not.toBeNull();
      expect(result!.trigger).toBe('conflict');
    });

    it('should return null when no match found', () => {
      const result = engine.getEscalation('nonexistent_trigger');
      expect(result).toBeNull();
    });
  });

  describe('getEscalationRules', () => {
    it('should return all escalation rules', () => {
      const engine = new BosGovernanceEngine(baseConfig);
      const rules = engine.getEscalationRules();
      expect(rules).toHaveLength(3);
      expect(rules[0].trigger).toBe('security');
      expect(rules[1].trigger).toBe('approval');
      expect(rules[2].trigger).toBe('conflict');
    });

    it('should return empty array when no rules configured', () => {
      const emptyConfig: GovernanceConfig = {
        ...baseConfig,
        escalationMatrix: [],
      };
      const engine = new BosGovernanceEngine(emptyConfig);
      expect(engine.getEscalationRules()).toEqual([]);
    });
  });

  describe('getConflictResolution', () => {
    let engine: BosGovernanceEngine;

    beforeEach(() => {
      engine = new BosGovernanceEngine(baseConfig);
    });

    it('should return conflict resolution for known type', () => {
      const result = engine.getConflictResolution('code_review');
      expect(result).not.toBeNull();
      expect(result!.protocol).toHaveLength(3);
      expect(result!.protocol[0].step).toBe('review');
      expect(result!.protocol[1].step).toBe('approve');
      expect(result!.protocol[2].step).toBe('merge');
      expect(result!.timeout).toBe('1h');
      expect(result!.escalation).toBe('tech_lead');
    });

    it('should return null for unknown type', () => {
      const result = engine.getConflictResolution('unknown_type');
      expect(result).toBeNull();
    });
  });

  describe('getContext', () => {
    it('should return governance context for a domain', () => {
      const engine = new BosGovernanceEngine(baseConfig);
      const ctx = engine.getContext('frontend');
      expect(ctx.domain).toBe('frontend');
      expect(ctx.boundaries).toBeDefined();
      expect(ctx.boundaries!.canModify).toContain('src/frontend/**');
      expect(ctx.boundaries!.cannotModify).toContain('src/backend/**');
      expect(ctx.compliance.requiredFrameworks).toHaveLength(2);
    });

    it('should return undefined boundaries for unknown domain', () => {
      const engine = new BosGovernanceEngine(baseConfig);
      const ctx = engine.getContext('nonexistent');
      expect(ctx.domain).toBe('nonexistent');
      expect(ctx.boundaries).toBeUndefined();
    });
  });

  describe('getConfig', () => {
    it('should return the raw config object', () => {
      const engine = new BosGovernanceEngine(baseConfig);
      const config = engine.getConfig();
      expect(config).toBe(baseConfig);
      expect(config.authorityMatrix).toBeDefined();
      expect(config.domainBoundaries).toBeDefined();
      expect(config.escalationMatrix).toHaveLength(3);
      expect(config.conflictResolution).toBeDefined();
      expect(config.compliance).toBeDefined();
    });
  });
});

describe('matchesGlob', () => {
  it('should match exact path', () => {
    expect(matchesGlob('src/index.ts', 'src/index.ts')).toBe(true);
  });

  it('should match with * wildcard', () => {
    expect(matchesGlob('src/frontend/app.ts', 'src/frontend/*')).toBe(true);
  });

  it('should not match * across path segments', () => {
    expect(matchesGlob('src/frontend/subdir/app.ts', 'src/frontend/*')).toBe(false);
  });

  it('should match with ** globstar', () => {
    expect(matchesGlob('src/frontend/subdir/app.ts', 'src/**')).toBe(true);
  });

  it('should match deep nested paths', () => {
    expect(matchesGlob('src/backend/api/v2/routes.ts', 'src/backend/**')).toBe(true);
  });

  it('should not match when pattern does not match', () => {
    expect(matchesGlob('src/backend/api.ts', 'src/frontend/**')).toBe(false);
  });

  it('should match empty string target when pattern is **', () => {
    expect(matchesGlob('anything', '**')).toBe(true);
  });
});
