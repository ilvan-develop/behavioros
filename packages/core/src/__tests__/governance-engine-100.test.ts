import { describe, expect, it } from 'vitest';
import {
  type AuthorityLevelValue,
  type GovernanceContext,
  GovernanceEngine,
} from '../engines/governance/governance-engine';

const juniorContext: GovernanceContext = {
  agentId: 'agent-1',
  agentRole: 'developer',
  agentAuthority: 'junior',
  action: 'write',
  targetType: 'file',
  impact: 'low',
};

const architectContext: GovernanceContext = {
  agentId: 'agent-2',
  agentRole: 'architect',
  agentAuthority: 'architect',
  action: 'write',
  targetType: 'file',
  impact: 'low',
};

describe('GovernanceEngine', () => {
  describe('constructor / buildIndex', () => {
    it('should handle empty rules', () => {
      const engine = new GovernanceEngine([]);
      const result = engine.evaluate(juniorContext);
      expect(result.allowed).toBe(true);
    });

    it('should build scope index for rules with scope', () => {
      const rules = [
        {
          id: 'r1',
          name: 'File rules',
          level: 'high' as const,
          action: 'block' as const,
          scope: ['file'],
        },
        {
          id: 'r2',
          name: 'Module rules',
          level: 'medium' as const,
          action: 'block' as const,
          scope: ['module'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const fileResult = engine.evaluate({ ...juniorContext, targetType: 'file' });
      expect(fileResult.allowed).toBe(false);
      expect(fileResult.reason).toContain('Blocked by governance rule: File rules');

      const moduleResult = engine.evaluate({ ...juniorContext, targetType: 'module' });
      expect(moduleResult.allowed).toBe(false);
      expect(moduleResult.reason).toContain('Blocked by governance rule: Module rules');
    });

    it('should put rules without scope into rulesWithoutScope', () => {
      const rules = [
        {
          id: 'r1',
          name: 'Global rule',
          level: 'high' as const,
          action: 'block' as const,
        },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate({
        ...juniorContext,
        targetType: 'service',
        impact: 'low',
      });
      expect(result.allowed).toBe(false);
    });

    it('should build condition index for type: conditions', () => {
      const rules = [
        {
          id: 'r1',
          name: 'DB rules',
          level: 'critical' as const,
          action: 'block' as const,
          conditions: ['type:database'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const dbResult = engine.evaluate({
        ...juniorContext,
        targetType: 'database',
        impact: 'critical',
      });
      expect(dbResult.allowed).toBe(false);

      const fileResult = engine.evaluate({ ...juniorContext, targetType: 'file', impact: 'low' });
      expect(fileResult.allowed).toBe(true);
    });

    it('should build condition index for impact: conditions', () => {
      const rules = [
        {
          id: 'r1',
          name: 'Critical only',
          level: 'critical' as const,
          action: 'block' as const,
          conditions: ['impact:critical'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const criticalResult = engine.evaluate({
        ...juniorContext,
        targetType: 'file',
        impact: 'critical',
      });
      expect(criticalResult.allowed).toBe(false);

      const lowResult = engine.evaluate({ ...juniorContext, targetType: 'file', impact: 'low' });
      expect(lowResult.allowed).toBe(true);
    });

    it('should classify time-restricted rules', () => {
      const rules = [
        {
          id: 'r1',
          name: 'No Friday deploys',
          level: 'high' as const,
          action: 'block' as const,
          conditions: ['day:friday'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const friday = new Date('2026-07-24T10:00:00Z'); // Friday
      const result = engine.evaluate({
        ...juniorContext,
        impact: 'low',
        currentTime: friday,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('friday');
    });

    it('should classify dependency rules', () => {
      const rules = [
        {
          id: 'r1',
          name: 'No new deps',
          level: 'high' as const,
          action: 'block' as const,
          conditions: ['dependency:lodash,express'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate({
        ...juniorContext,
        impact: 'low',
        targetDependency: 'react',
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe('evaluate', () => {
    describe('authority checks', () => {
      it('should pass with sufficient authority', () => {
        const engine = new GovernanceEngine([]);
        const result = engine.evaluate(juniorContext);
        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('All governance checks passed');
      });

      it('should block with insufficient authority for critical impact', () => {
        const engine = new GovernanceEngine([]);
        const result = engine.evaluate({ ...juniorContext, impact: 'critical' });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Authority level junior');
        expect(result.reason).toContain('lead');
        expect(result.escalationRequired).toBe(true);
        expect(result.requiredAuthority).toBe('lead');
      });

      it('should block with insufficient authority for high impact', () => {
        const engine = new GovernanceEngine([]);
        const result = engine.evaluate({ ...juniorContext, impact: 'high' });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('architect');
      });

      it('should pass for low impact with junior authority', () => {
        const engine = new GovernanceEngine([]);
        const result = engine.evaluate(juniorContext);
        expect(result.allowed).toBe(true);
      });

      it('should block for medium impact with junior authority', () => {
        const engine = new GovernanceEngine([]);
        const result = engine.evaluate({ ...juniorContext, impact: 'medium' });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('senior');
      });
    });

    describe('rule checks — action types', () => {
      it('should block when governance rule has action=block', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Block sensitive',
            level: 'high' as const,
            action: 'block' as const,
            scope: ['file'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Blocked by governance rule');
        expect(result.rule?.id).toBe('r1');
      });

      it('should set escalationRequired for high-level block rules', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Critical block',
            level: 'critical' as const,
            action: 'block' as const,
            scope: ['file'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        expect(result.allowed).toBe(false);
        expect(result.escalationRequired).toBe(true);
      });

      it('should not set escalationRequired for low-level block rules', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Low block',
            level: 'low' as const,
            action: 'block' as const,
            scope: ['file'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        expect(result.allowed).toBe(false);
        expect(result.escalationRequired).toBe(false);
      });

      it('should escalate when governance rule has action=escalate', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Needs approval',
            level: 'medium' as const,
            action: 'escalate' as const,
            scope: ['file'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Approval required');
        expect(result.escalationRequired).toBe(true);
      });

      it('should pass when governance rule has action=warn', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Warning only',
            level: 'low' as const,
            action: 'warn' as const,
            scope: ['file'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        expect(result.allowed).toBe(true);
      });

      it('should pass when governance rule has action=log', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Log only',
            level: 'low' as const,
            action: 'log' as const,
            scope: ['file'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        expect(result.allowed).toBe(true);
      });

      it('should pass when governance rule has action=auto_approve', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Auto approve',
            level: 'low' as const,
            action: 'auto_approve' as const,
            scope: ['file'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        expect(result.allowed).toBe(true);
      });
    });

    describe('rule checks — multiple conflicting rules', () => {
      it('should block when first matching rule is block', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Block first',
            level: 'high' as const,
            action: 'block' as const,
            scope: ['file'],
          },
          {
            id: 'r2',
            name: 'Also blocks',
            level: 'medium' as const,
            action: 'block' as const,
            scope: ['file'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        expect(result.allowed).toBe(false);
        expect(result.rule?.id).toBe('r1');
      });

      it('should escalate and not block when first matching rule is escalate', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Escalate first',
            level: 'medium' as const,
            action: 'escalate' as const,
            scope: ['file'],
          },
          {
            id: 'r2',
            name: 'Block second',
            level: 'high' as const,
            action: 'block' as const,
            scope: ['file'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        expect(result.allowed).toBe(false);
        expect(result.rule?.id).toBe('r1');
        expect(result.escalationRequired).toBe(true);
      });

      it('should pass when no rules match due to scope mismatch', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Only for DB',
            level: 'high' as const,
            action: 'block' as const,
            scope: ['database'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        expect(result.allowed).toBe(true);
      });
    });

    describe('rule checks — context-dependent conditions', () => {
      it('should match rule with condition matching targetType', () => {
        const rules = [
          {
            id: 'r1',
            name: 'DB rules',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['type:database'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const ctx: GovernanceContext = { ...juniorContext, targetType: 'database', impact: 'low' };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(false);
      });

      it('should match rule with condition matching impact', () => {
        const rules = [
          {
            id: 'r1',
            name: 'High impact only',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['impact:high'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'high' });
        expect(result.allowed).toBe(false);
      });

      it('should not match rule when condition does not match', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Type:infra only',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['type:infrastructure'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, targetType: 'file' });
        expect(result.allowed).toBe(true);
      });

      it('should match slow-path conditions with impact context', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Freeform condition',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['custom:file-audit'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({
          ...juniorContext,
          targetType: 'file',
          impact: 'low',
        });
        expect(result.allowed).toBe(false);
      });

      it('should not match slow-path condition when nothing matches', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Freeform no match',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['custom:nonexistent'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({
          ...juniorContext,
          targetType: 'file',
          impact: 'low',
        });
        expect(result.allowed).toBe(true);
      });

      it('should apply rule with both scope and conditions', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Scoped+conditioned',
            level: 'high' as const,
            action: 'block' as const,
            scope: ['file'],
            conditions: ['impact:high'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const noMatch = engine.evaluate({ ...juniorContext, impact: 'low' });
        expect(noMatch.allowed).toBe(true);

        const match = engine.evaluate({ ...juniorContext, impact: 'high' });
        expect(match.allowed).toBe(false);
      });

      it('should not apply rule when scope mismatches', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Only config',
            level: 'high' as const,
            action: 'block' as const,
            scope: ['config'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, targetType: 'file' });
        expect(result.allowed).toBe(true);
      });
    });

    describe('boundary checks — forbidden', () => {
      it('should block when file matches forbidden pattern', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'No secrets',
              type: 'forbidden',
              value: '**/secrets/**',
              scope: 'global',
            },
          ],
          targetFiles: ['src/secrets/keys.ts'],
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('matches forbidden pattern');
        expect(result.escalationRequired).toBe(true);
      });

      it('should allow when no files match forbidden pattern', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'No secrets',
              type: 'forbidden',
              value: '**/secrets/**',
              scope: 'global',
            },
          ],
          targetFiles: ['src/public/readme.md'],
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('should block when targetScope matches forbidden pattern', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'No admin',
              type: 'forbidden',
              value: 'admin/*',
              scope: 'global',
            },
          ],
          targetScope: 'admin/users',
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(false);
      });

      it('should allow architect+ with scope escalation on forbidden', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...architectContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'No secrets',
              type: 'forbidden',
              value: '**/secrets/**',
              scope: 'global',
            },
          ],
          targetFiles: ['src/secrets/keys.ts'],
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('should pass when there are no targetFiles or targetScope', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'No secrets',
              type: 'forbidden',
              value: '**/secrets/**',
              scope: 'global',
            },
          ],
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('should not match * across path separators in forbidden', () => {
        expect(GovernanceEngine.matchesGlob('*.ts', 'src/file.ts')).toBe(false);
      });

      it('should not match forbidden pattern without pattern hit', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'No secrets',
              type: 'forbidden',
              value: '*.exe',
              scope: 'global',
            },
          ],
          targetFiles: ['src/file.ts'],
          targetScope: 'src',
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });
    });

    describe('boundary checks — max_files', () => {
      it('should block when file count exceeds maximum', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Max files per commit',
              type: 'max_files',
              value: 5,
              scope: 'per_commit',
            },
          ],
          fileCount: 10,
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('File count 10 exceeds maximum 5');
        expect(result.escalationRequired).toBe(true);
      });

      it('should pass when file count is within limit', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Max files per commit',
              type: 'max_files',
              value: 10,
              scope: 'per_commit',
            },
          ],
          fileCount: 3,
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('should pass when fileCount is undefined', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Max files',
              type: 'max_files',
              value: 5,
              scope: 'per_commit',
            },
          ],
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('should handle NaN max_files value gracefully', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Invalid',
              type: 'max_files',
              value: 'invalid',
              scope: 'per_commit',
            },
          ],
          fileCount: 100,
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('should allow architect+ scope escalation for max_files', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...architectContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Max files',
              type: 'max_files',
              value: 3,
              scope: 'per_commit',
            },
          ],
          fileCount: 10,
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });
    });

    describe('boundary checks — max_lines', () => {
      it('should block when line count exceeds maximum', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Max lines',
              type: 'max_lines',
              value: 100,
              scope: 'per_commit',
            },
          ],
          lineCount: 200,
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Line count 200 exceeds maximum 100');
      });

      it('should pass when line count is within limit', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Max lines',
              type: 'max_lines',
              value: 500,
              scope: 'per_commit',
            },
          ],
          lineCount: 50,
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('should pass when lineCount is undefined', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Max lines',
              type: 'max_lines',
              value: 100,
              scope: 'per_commit',
            },
          ],
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('should handle NaN max_lines value gracefully', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Invalid',
              type: 'max_lines',
              value: 'bad',
              scope: 'per_commit',
            },
          ],
          lineCount: 999,
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });
    });

    describe('boundary checks — max_modules', () => {
      it('should block when module count exceeds maximum', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Max modules',
              type: 'max_modules',
              value: 3,
              scope: 'per_commit',
            },
          ],
          targetModules: 10,
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Module count 10 exceeds maximum 3');
      });

      it('should pass when module count is within limit', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Max modules',
              type: 'max_modules',
              value: 5,
              scope: 'per_commit',
            },
          ],
          targetModules: 2,
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('should pass when targetModules is undefined', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Max modules',
              type: 'max_modules',
              value: 3,
              scope: 'per_commit',
            },
          ],
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('should handle NaN max_modules value gracefully', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Invalid',
              type: 'max_modules',
              value: 'bad',
              scope: 'per_commit',
            },
          ],
          targetModules: 999,
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });
    });

    describe('boundary checks — require_approval', () => {
      it('should escalate when require_approval is true', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Requires approval',
              type: 'require_approval',
              value: true,
              scope: 'global',
            },
          ],
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('requires approval');
        expect(result.escalationRequired).toBe(true);
      });

      it('should pass when require_approval is false', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'No approval needed',
              type: 'require_approval',
              value: false,
              scope: 'global',
            },
          ],
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });
    });

    describe('boundary checks — unknown type', () => {
      it('should pass with warning for unknown boundary type', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [
            {
              id: 'b1',
              name: 'Unknown',
              type: 'unknown' as never,
              value: 'something',
              scope: 'global',
            },
          ],
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });
    });

    describe('boundary checks — time restrictions', () => {
      it('should block on matching day', () => {
        const rules = [
          {
            id: 'r1',
            name: 'No Friday work',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['day:friday'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const friday = new Date('2026-07-24T10:00:00Z'); // Friday
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
          currentTime: friday,
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('friday');
      });

      it('should pass on non-matching day', () => {
        const rules = [
          {
            id: 'r1',
            name: 'No Friday work',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['day:friday'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const monday = new Date('2026-07-20T10:00:00Z'); // Monday
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
          currentTime: monday,
        });
        expect(result.allowed).toBe(true);
      });

      it('should escalate on matching day with escalate action', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Friday approval',
            level: 'medium' as const,
            action: 'escalate' as const,
            conditions: ['day:friday'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const friday = new Date('2026-07-24T10:00:00Z');
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
          currentTime: friday,
        });
        expect(result.allowed).toBe(true);
      });

      it('should block during restricted hours', () => {
        const rules = [
          {
            id: 'r1',
            name: 'No deploys 2-4am',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['hours:2-4'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const night = new Date('2026-07-20T03:00:00Z');
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
          currentTime: night,
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('hours');
      });

      it('should pass outside restricted hours', () => {
        const rules = [
          {
            id: 'r1',
            name: 'No deploys 2-4am',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['hours:2-4'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const noon = new Date('2026-07-20T12:00:00Z');
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
          currentTime: noon,
        });
        expect(result.allowed).toBe(true);
      });

      it('should handle hours with NaN start/end gracefully', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Bad hours',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['hours:abc-def'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
          currentTime: new Date(),
        });
        expect(result.allowed).toBe(true);
      });

      it('should ignore unknown day names', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Blobday',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['day:blobday'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
          currentTime: new Date(),
        });
        expect(result.allowed).toBe(true);
      });

      it('should use current time when currentTime is not provided', () => {
        const rules = [
          {
            id: 'r1',
            name: 'No Mondays',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['day:monday'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        const day = new Date().getDay();
        if (day === 1) {
          expect(result.allowed).toBe(false);
        } else {
          expect(result.allowed).toBe(true);
        }
      });

      it('should use default time when currentTime is not provided in checkTimeRestrictions', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Night block',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['hours:0-5'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        const hour = new Date().getHours();
        if (hour >= 0 && hour <= 5) {
          expect(result.allowed).toBe(false);
        } else {
          expect(result.allowed).toBe(true);
        }
      });
    });

    describe('boundary checks — dependency boundary', () => {
      it('should block disallowed dependency', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Approved deps only',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['dependency:lodash,express,react'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
          targetDependency: 'vue',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('vue');
        expect(result.reason).toContain('lodash, express, react');
      });

      it('should pass allowed dependency', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Approved deps',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['dependency:lodash,express'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
          targetDependency: 'lodash',
        });
        expect(result.allowed).toBe(true);
      });

      it('should pass when no targetDependency', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Approved deps',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['dependency:lodash'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({ ...juniorContext, impact: 'low' });
        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('All governance checks passed');
      });

      it('should escalate disallowed dependency with escalate action', () => {
        const rules = [
          {
            id: 'r1',
            name: 'Dep approval needed',
            level: 'medium' as const,
            action: 'escalate' as const,
            conditions: ['dependency:lodash,express'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
          targetDependency: 'vue',
        });
        expect(result.allowed).toBe(true);
      });

      it('should handle empty allowed dependency list', () => {
        const rules = [
          {
            id: 'r1',
            name: 'No deps allowed',
            level: 'high' as const,
            action: 'block' as const,
            conditions: ['dependency:'],
          },
        ];
        const engine = new GovernanceEngine(rules);
        const result = engine.evaluate({
          ...juniorContext,
          impact: 'low',
          targetDependency: 'anything',
        });
        expect(result.allowed).toBe(false);
      });
    });

    describe('boundary checks — empty boundaries array', () => {
      it('should pass when boundaries array is empty', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: [],
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });

      it('should pass when boundaries is undefined', () => {
        const engine = new GovernanceEngine([]);
        const ctx: GovernanceContext = {
          ...juniorContext,
          impact: 'low',
          boundaries: undefined,
        };
        const result = engine.evaluate(ctx);
        expect(result.allowed).toBe(true);
      });
    });
  });

  describe('escalate', () => {
    it('should return next level in chain', () => {
      const engine = new GovernanceEngine([]);
      expect(engine.escalate('junior')).toBe('senior');
      expect(engine.escalate('senior')).toBe('architect');
      expect(engine.escalate('architect')).toBe('lead');
      expect(engine.escalate('lead')).toBe('director');
      expect(engine.escalate('director')).toBe('vp');
      expect(engine.escalate('vp')).toBe('c-level');
    });

    it('should return null for top level', () => {
      const engine = new GovernanceEngine([]);
      expect(engine.escalate('c-level')).toBeNull();
    });

    it('should return null for unknown level', () => {
      const engine = new GovernanceEngine([]);
      expect(engine.escalate('unknown' as AuthorityLevelValue)).toBeNull();
    });
  });

  describe('getApplicableRules', () => {
    it('should return matching rules based on scope and conditions', () => {
      const rules = [
        {
          id: 'r1',
          name: 'Block file writes',
          level: 'high' as const,
          action: 'block' as const,
          scope: ['file'],
          conditions: ['impact:high'],
        },
        {
          id: 'r2',
          name: 'Block db',
          level: 'critical' as const,
          action: 'block' as const,
          scope: ['database'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const ctx: GovernanceContext = {
        ...juniorContext,
        targetType: 'file',
        impact: 'high',
      };
      const applicable = engine.getApplicableRules(ctx);
      expect(applicable).toHaveLength(1);
      expect(applicable[0].id).toBe('r1');
    });

    it('should return empty array when no rules match', () => {
      const rules = [
        {
          id: 'r1',
          name: 'DB only',
          level: 'high' as const,
          action: 'block' as const,
          scope: ['database'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const applicable = engine.getApplicableRules({ ...juniorContext, targetType: 'file' });
      expect(applicable).toHaveLength(0);
    });

    it('should return rules from condition index', () => {
      const rules = [
        {
          id: 'r1',
          name: 'Critical impact',
          level: 'critical' as const,
          action: 'block' as const,
          conditions: ['impact:critical'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const ctx: GovernanceContext = {
        ...juniorContext,
        targetType: 'file',
        impact: 'critical',
      };
      const applicable = engine.getApplicableRules(ctx);
      expect(applicable).toHaveLength(1);
    });
  });

  describe('summary', () => {
    it('should return formatted summary with rule counts by level', () => {
      const rules = [
        {
          id: 'r1',
          name: 'Critical rule',
          level: 'critical' as const,
          action: 'block' as const,
        },
        {
          id: 'r2',
          name: 'High rule',
          level: 'high' as const,
          action: 'block' as const,
        },
        {
          id: 'r3',
          name: 'Low rule',
          level: 'low' as const,
          action: 'warn' as const,
        },
      ];
      const engine = new GovernanceEngine(rules);
      const s = engine.summary();
      expect(s).toContain('Governance Rules: 3');
      expect(s).toContain('critical: 1');
      expect(s).toContain('high: 1');
      expect(s).toContain('low: 1');
    });

    it('should handle empty rules', () => {
      const engine = new GovernanceEngine([]);
      const s = engine.summary();
      expect(s).toContain('Governance Rules: 0');
    });
  });

  describe('matchesGlob', () => {
    it('should match * pattern against path segments', () => {
      expect(GovernanceEngine.matchesGlob('*.ts', 'file.ts')).toBe(true);
      expect(GovernanceEngine.matchesGlob('*.ts', 'file.js')).toBe(false);
    });

    it('should not match * across path separators', () => {
      expect(GovernanceEngine.matchesGlob('src/*.ts', 'src/file.ts')).toBe(true);
      expect(GovernanceEngine.matchesGlob('src/*.ts', 'src/sub/file.ts')).toBe(false);
    });

    it('should match ** across path separators', () => {
      expect(GovernanceEngine.matchesGlob('src/**/*.ts', 'src/a/b/c/file.ts')).toBe(true);
      expect(GovernanceEngine.matchesGlob('src/**/*.ts', 'src/file.ts')).toBe(true);
    });

    it('should match ? single character', () => {
      expect(GovernanceEngine.matchesGlob('file.??', 'file.ts')).toBe(true);
      expect(GovernanceEngine.matchesGlob('file.?', 'file.t')).toBe(true);
      expect(GovernanceEngine.matchesGlob('file.???', 'file.ts')).toBe(false);
      expect(GovernanceEngine.matchesGlob('file.?', 'file.ts')).toBe(false);
    });

    it('should match exact literal', () => {
      expect(GovernanceEngine.matchesGlob('src/index.ts', 'src/index.ts')).toBe(true);
      expect(GovernanceEngine.matchesGlob('src/index.ts', 'other.ts')).toBe(false);
    });

    it('should handle regex special characters in pattern', () => {
      expect(GovernanceEngine.matchesGlob('file+[test].ts', 'file+[test].ts')).toBe(true);
      expect(GovernanceEngine.matchesGlob('file+[test].ts', 'file.ts')).toBe(false);
    });

    it('should handle cross-platform backslash path separators', () => {
      expect(GovernanceEngine.matchesGlob('src\\*.ts', 'src/file.ts')).toBe(true);
      expect(GovernanceEngine.matchesGlob('*.ts', 'src\\file.ts')).toBe(false);
    });

    it('should handle **/ pattern with trailing slash consumption', () => {
      expect(GovernanceEngine.matchesGlob('a/**/b', 'a/x/b')).toBe(true);
      expect(GovernanceEngine.matchesGlob('a/**/b', 'a/x/y/b')).toBe(true);
    });

    it('should match single file with **', () => {
      expect(GovernanceEngine.matchesGlob('**', 'any/path/file.ts')).toBe(true);
      expect(GovernanceEngine.matchesGlob('**', 'file.ts')).toBe(true);
    });
  });

  describe('evaluate — full integration', () => {
    it('should block when authority is insufficient and rule matches', () => {
      const rules = [
        {
          id: 'r1',
          name: 'DB block',
          level: 'high' as const,
          action: 'block' as const,
          scope: ['database'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const ctx: GovernanceContext = {
        ...juniorContext,
        targetType: 'database',
        impact: 'critical',
      };
      const result = engine.evaluate(ctx);
      expect(result.allowed).toBe(false);
    });

    it('should handle multiple boundary rules combined', () => {
      const engine = new GovernanceEngine([]);
      const ctx: GovernanceContext = {
        ...juniorContext,
        impact: 'low',
        targetFiles: ['src/public/doc.ts'],
        fileCount: 2,
        lineCount: 50,
        targetModules: 1,
        boundaries: [
          {
            id: 'b1',
            name: 'No secrets',
            type: 'forbidden',
            value: '**/secrets/**',
            scope: 'global',
          },
          {
            id: 'b2',
            name: 'Max 5 files',
            type: 'max_files',
            value: 5,
            scope: 'per_commit',
          },
          {
            id: 'b3',
            name: 'Max 200 lines',
            type: 'max_lines',
            value: 200,
            scope: 'per_commit',
          },
          {
            id: 'b4',
            name: 'Max 3 modules',
            type: 'max_modules',
            value: 3,
            scope: 'per_commit',
          },
        ],
      };
      const result = engine.evaluate(ctx);
      expect(result.allowed).toBe(true);
    });

    it('should block on first failing boundary rule', () => {
      const engine = new GovernanceEngine([]);
      const ctx: GovernanceContext = {
        ...juniorContext,
        impact: 'low',
        targetFiles: ['src/secrets/keys.ts'],
        fileCount: 100,
        boundaries: [
          {
            id: 'b1',
            name: 'No secrets',
            type: 'forbidden',
            value: '**/secrets/**',
            scope: 'global',
          },
          {
            id: 'b2',
            name: 'Max 5 files',
            type: 'max_files',
            value: 5,
            scope: 'per_commit',
          },
        ],
      };
      const result = engine.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('matches forbidden pattern');
    });
  });
});
