import type { DNAPackage } from '@behavioros/schemas';
import { describe, expect, it } from 'vitest';
import { BehaviorCompiler } from '../compiler/behavior-compiler';
import { OPAEvaluator, type OPAInput } from '../compiler/opa-evaluator';
import { PolicyStore } from '../compiler/policy-store';
import { YAMLToOPACompiler } from '../compiler/yaml-to-opa';

function makeDNA(overrides?: Partial<DNAPackage>): DNAPackage {
  return {
    id: 'test-dna',
    name: 'Test DNA',
    version: '1.0.0',
    author: 'test',
    personas: [
      {
        role: 'engineer',
        authority: 'senior',
        description: 'Test engineer',
        tools: ['git', 'test'],
      },
    ],
    governance: [
      { id: 'rule-1', name: 'Block Read', level: 'high', action: 'block', conditions: ['read'] },
      {
        id: 'rule-2',
        name: 'Escalate Write',
        level: 'high',
        action: 'escalate',
        conditions: ['write'],
        scope: ['core'],
      },
    ],
    quality: [{ id: 'gate-1', name: 'Coverage', type: 'test_coverage', threshold: 80 }],
    patterns: [
      {
        id: 'pattern-1',
        name: 'Review Pattern',
        type: 'review',
        triggers: ['pr.opened'],
        actions: ['log'],
        config: { required: true },
      },
    ],
    workflows: [{ id: 'wf-1', name: 'CI Pipeline', type: 'action', next: ['lint', 'test'] }],
    ...overrides,
  };
}

describe('BehaviorCompiler', () => {
  it('should compile a DNA package with dryRun mode', () => {
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile(makeDNA());

    expect(result.organization.name).toBe('Test DNA');
    expect(result.organization.agents).toHaveLength(1);
    expect(result.organization.agents[0].role).toBe('engineer');
    expect(result.organization.agents[0].authority).toBe('senior');
    expect(result.organization.workflows).toHaveLength(1);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('should generate hooks from patterns with triggers', () => {
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile(makeDNA());

    expect(result.organization.hooks).toHaveLength(1);
    expect(result.organization.hooks[0].event).toBe('pr.opened');
    expect(result.organization.hooks[0].action).toBe('log');
  });

  it('should generate no hooks when patterns have no triggers', () => {
    const compiler = new BehaviorCompiler({ dryRun: true });
    const dna = makeDNA({
      patterns: [{ id: 'p1', name: 'No Trigger', type: 'custom' }],
    });
    const result = compiler.compile(dna);

    expect(result.organization.hooks).toHaveLength(0);
  });

  it('should generate CICD gates from quality entries', () => {
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile(makeDNA());

    expect(result.organization.cicd.gates).toContain('Coverage');
    expect(result.organization.cicd.stages).toEqual([
      'lint',
      'typecheck',
      'test',
      'build',
      'deploy',
    ]);
  });

  it('should generate agent files', () => {
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile(makeDNA());

    const agentFile = result.files.find((f) => f.path.includes('agent-engineer'));
    expect(agentFile).toBeDefined();
    expect(agentFile!.type).toBe('typescript');
    expect(agentFile!.content).toContain('engineer');
  });

  it('should generate workflow YAML files', () => {
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile(makeDNA());

    const wfFile = result.files.find((f) => f.path.includes('wf-1'));
    expect(wfFile).toBeDefined();
    expect(wfFile!.type).toBe('yaml');
    expect(wfFile!.content).toContain('CI Pipeline');
  });

  it('should generate MCP file', () => {
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile(makeDNA());

    const mcpFile = result.files.find((f) => f.path.includes('mcp'));
    expect(mcpFile).toBeDefined();
    expect(mcpFile!.content).toContain('McpServer');
  });

  it('should generate CI/CD file', () => {
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile(makeDNA());

    const cicdFile = result.files.find((f) => f.path.includes('.github'));
    expect(cicdFile).toBeDefined();
    expect(cicdFile!.content).toContain('BehaviorOS CI');
  });

  it('should generate README docs', () => {
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile(makeDNA());

    const readme = result.organization.docs.readme;
    expect(readme).toContain('# Test DNA');
    expect(readme).toContain('engineer');
    expect(readme).toContain('Coverage');
  });

  it('should generate architecture doc', () => {
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile(makeDNA());

    expect(result.organization.docs.architecture).toContain('Architecture');
    expect(result.organization.docs.architecture).toContain('Test DNA');
  });

  it('should generate DNA doc', () => {
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile(makeDNA());

    expect(result.organization.docs.dna).toContain('DNA Package');
    expect(result.organization.docs.dna).toContain('test-dna');
    expect(result.organization.docs.dna).toContain('Review Pattern');
  });

  it('should accept constructor options', () => {
    const compiler1 = new BehaviorCompiler({
      dryRun: false,
      verbose: true,
      outputDir: '/tmp/test',
    });
    expect(compiler1).toBeInstanceOf(BehaviorCompiler);

    const compiler2 = new BehaviorCompiler();
    expect(compiler2).toBeInstanceOf(BehaviorCompiler);
  });

  it('should use default values when no options provided', () => {
    const compiler = new BehaviorCompiler();
    const result = compiler.compile(makeDNA());

    expect(result.organization.name).toBe('Test DNA');
  });
});

describe('OPAEvaluator', () => {
  it('should evaluate a policy and allow when no deny rules match', () => {
    const evaluator = new OPAEvaluator();
    evaluator.registerPolicy('dna-1', {
      package: 'test',
      rules: [{ name: 'deny_admin', body: 'deny { input.action.type == "delete" }' }],
    });

    const input: OPAInput = {
      action: { type: 'read' },
      agent: { id: 'agent-1', authority: 'senior', dnaMode: 'conversational' },
      governance: { level: 'high' },
      boundaries: [],
    };

    const result = evaluator.evaluate('dna-1', input);
    expect(result.allow).toBe(true);
    expect(result.deny).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('should deny when a deny rule matches', () => {
    const evaluator = new OPAEvaluator();
    evaluator.registerPolicy('dna-1', {
      package: 'test',
      rules: [{ name: 'deny_delete', body: 'deny { input.action.type == "delete" }' }],
    });

    const input: OPAInput = {
      action: { type: 'delete' },
      agent: { id: 'agent-1', authority: 'senior', dnaMode: 'conversational' },
      governance: { level: 'high' },
      boundaries: [],
    };

    const result = evaluator.evaluate('dna-1', input);
    expect(result.allow).toBe(false);
    expect(result.deny).toBe(true);
    expect(result.violations).toContain('deny_delete');
  });

  it('should escalate when escalation rules match', () => {
    const evaluator = new OPAEvaluator();
    evaluator.registerPolicy('dna-1', {
      package: 'test',
      rules: [
        {
          name: 'esc_write',
          body: 'escalate { input.action.type == "write" ; input.agent.authority == "senior" }',
        },
      ],
    });

    const input: OPAInput = {
      action: { type: 'write' },
      agent: { id: 'agent-1', authority: 'senior', dnaMode: 'conversational' },
      governance: { level: 'high' },
      boundaries: [],
    };

    const result = evaluator.evaluate('dna-1', input);
    expect(result.allow).toBe(true);
    expect(result.violations).toContain('esc_write');
  });

  it('should return deny when no policy is found', () => {
    const evaluator = new OPAEvaluator();
    const input: OPAInput = {
      action: { type: 'read' },
      agent: { id: 'agent-1', authority: 'senior', dnaMode: 'conversational' },
      governance: { level: 'high' },
      boundaries: [],
    };

    const result = evaluator.evaluate('unknown-dna', input);
    expect(result.allow).toBe(false);
    expect(result.deny).toBe(true);
    expect(result.violations).toContain('No policy found');
  });

  it('should respect authority level in rule matching', () => {
    const evaluator = new OPAEvaluator();
    evaluator.registerPolicy('dna-1', {
      package: 'test',
      rules: [
        {
          name: 'authority_check',
          body: 'deny { input.action.type == "write" ; input.agent.authority == "junior" }',
        },
      ],
    });

    const juniorInput: OPAInput = {
      action: { type: 'write' },
      agent: { id: 'agent-1', authority: 'junior', dnaMode: 'conversational' },
      governance: { level: 'high' },
      boundaries: [],
    };

    const seniorInput: OPAInput = {
      action: { type: 'write' },
      agent: { id: 'agent-2', authority: 'senior', dnaMode: 'conversational' },
      governance: { level: 'high' },
      boundaries: [],
    };

    expect(evaluator.evaluate('dna-1', juniorInput).deny).toBe(true);
    expect(evaluator.evaluate('dna-1', seniorInput).deny).toBe(false);
  });
});

describe('PolicyStore', () => {
  it('should register a DNA package and compile it to a policy', () => {
    const store = new PolicyStore();
    const policy = store.registerDNA(makeDNA());

    expect(policy.package).toBe('behaviouros.test-dna');
    expect(policy.rules.length).toBeGreaterThan(0);
  });

  it('should evaluate policies through the OPA evaluator', () => {
    const store = new PolicyStore();
    store.registerDNA(makeDNA());

    const input: OPAInput = {
      action: { type: 'read' },
      agent: { id: 'agent-1', authority: 'junior', dnaMode: 'conversational' },
      governance: { level: 'low' },
      boundaries: [],
    };

    const result = store.evaluate('test-dna', input);
    expect(result.allow).toBe(false);
    expect(result.deny).toBe(true);
  });

  it('should cache evaluation results', () => {
    const store = new PolicyStore();
    store.registerDNA(makeDNA());

    const input: OPAInput = {
      action: { type: 'read' },
      agent: { id: 'agent-1', authority: 'senior', dnaMode: 'conversational' },
      governance: { level: 'high' },
      boundaries: [],
    };

    const result1 = store.evaluate('test-dna', input);
    const result2 = store.evaluate('test-dna', input);
    expect(result1).toEqual(result2);
  });

  it('should get a registered policy', () => {
    const store = new PolicyStore();
    const policy = store.registerDNA(makeDNA());
    expect(store.getPolicy('test-dna')).toEqual(policy);
  });

  it('should return undefined for unknown policy', () => {
    const store = new PolicyStore();
    expect(store.getPolicy('unknown')).toBeUndefined();
  });

  it('should list registered policy IDs', () => {
    const store = new PolicyStore();
    store.registerDNA(makeDNA({ id: 'dna-1' }));
    store.registerDNA(makeDNA({ id: 'dna-2' }));

    const ids = store.listPolicies();
    expect(ids).toContain('dna-1');
    expect(ids).toContain('dna-2');
  });

  it('should clear cache', () => {
    const store = new PolicyStore();
    store.registerDNA(makeDNA());

    const input: OPAInput = {
      action: { type: 'read' },
      agent: { id: 'agent-1', authority: 'senior', dnaMode: 'conversational' },
      governance: { level: 'high' },
      boundaries: [],
    };

    store.evaluate('test-dna', input);
    store.clearCache();

    const result = store.evaluate('test-dna', input);
    expect(result).toBeDefined();
  });

  it('should remove a policy', () => {
    const store = new PolicyStore();
    store.registerDNA(makeDNA());
    expect(store.listPolicies()).toHaveLength(1);

    store.removePolicy('test-dna');
    expect(store.listPolicies()).toHaveLength(0);
    expect(store.getPolicy('test-dna')).toBeUndefined();
  });

  it('should register a raw policy', () => {
    const store = new PolicyStore();
    store.registerPolicy('custom-dna', {
      package: 'custom',
      rules: [{ name: 'deny_all', body: 'deny { input.action.type == "read" }' }],
    });

    const input: OPAInput = {
      action: { type: 'read' },
      agent: { id: 'agent-1', authority: 'senior', dnaMode: 'conversational' },
      governance: { level: 'high' },
      boundaries: [],
    };

    const result = store.evaluate('custom-dna', input);
    expect(result.deny).toBe(true);
  });
});

describe('YAMLToOPACompiler', () => {
  it('should compile governance rules with block action', () => {
    const compiler = new YAMLToOPACompiler();
    const policy = compiler.compile(makeDNA());

    const blockRule = policy.rules.find((r) => r.name === 'governance_rule-1');
    expect(blockRule).toBeDefined();
    expect(blockRule!.body).toContain('deny');
    expect(blockRule!.body).toContain('read');
  });

  it('should compile governance rules with escalate action', () => {
    const compiler = new YAMLToOPACompiler();
    const policy = compiler.compile(makeDNA());

    const escalateRule = policy.rules.find((r) => r.name === 'governance_rule-2');
    expect(escalateRule).toBeDefined();
    expect(escalateRule!.body).toContain('escalate');
    expect(escalateRule!.body).toContain('write');
  });

  it('should compile governance rules with allow action', () => {
    const compiler = new YAMLToOPACompiler();
    const policy = compiler.compile(
      makeDNA({
        governance: [
          { id: 'rule-3', name: 'Allow Read', level: 'low', action: 'warn', conditions: ['read'] },
        ],
      }),
    );

    const allowRule = policy.rules.find((r) => r.name === 'governance_rule-3');
    expect(allowRule).toBeDefined();
    expect(allowRule!.body).toContain('allow');
  });

  it('should compile boundary rules with forbidden type', () => {
    const compiler = new YAMLToOPACompiler();
    const policy = compiler.compile(
      makeDNA({
        personas: [
          {
            role: 'engineer',
            authority: 'senior',
            boundaries: [
              {
                id: 'b1',
                name: 'No Prod',
                type: 'forbidden',
                value: 'production',
                scope: 'global',
              },
            ],
          },
        ],
      }),
    );

    const boundaryRule = policy.rules.find((r) => r.name === 'boundary_b1');
    expect(boundaryRule).toBeDefined();
    expect(boundaryRule!.body).toContain('deny');
  });

  it('should compile boundary rules with non-forbidden type', () => {
    const compiler = new YAMLToOPACompiler();
    const policy = compiler.compile(
      makeDNA({
        personas: [
          {
            role: 'engineer',
            authority: 'senior',
            boundaries: [
              { id: 'b2', name: 'Max Files', type: 'max_files', value: 10, scope: 'per_commit' },
            ],
          },
        ],
      }),
    );

    const boundaryRule = policy.rules.find((r) => r.name === 'boundary_b2');
    expect(boundaryRule).toBeDefined();
    expect(boundaryRule!.body).toContain('allow');
  });

  it('should set the package name from dna id', () => {
    const compiler = new YAMLToOPACompiler();
    const policy = compiler.compile(makeDNA({ id: 'my-custom-dna' }));

    expect(policy.package).toBe('behaviouros.my-custom-dna');
  });

  it('should handle empty governance and personas', () => {
    const compiler = new YAMLToOPACompiler();
    const policy = compiler.compile(
      makeDNA({
        governance: [],
        personas: [{ role: 'engineer', authority: 'senior' }],
      }),
    );

    expect(policy.rules).toHaveLength(0);
  });
});
