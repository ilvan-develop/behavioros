/**
 * BOS Behavior Selector — selects optimal behavioral DNA pattern
 * for a given task context. Supports DNA blending (primary + secondary).
 */

export interface TaskContext {
  problemType:
    | 'bug_fix'
    | 'feature'
    | 'refactor'
    | 'security'
    | 'performance'
    | 'discovery'
    | 'incident'
    | 'maintenance';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  scope: 'single_file' | 'single_package' | 'multi_package' | 'monorepo' | 'cross_system';
  timeline: 'urgent' | 'sprint' | 'quarter' | 'ongoing';
  domain: string;
  compliance?: string[];
  tags?: string[];
}

export interface DnaSelection {
  primary: string;
  secondary?: string;
  blend: { primary: number; secondary: number };
  rationale: string;
  confidence: number;
}

interface DecisionRule {
  id: string;
  when: (ctx: TaskContext) => boolean;
  result: () => DnaSelection;
  priority: number;
}

export class BehaviorSelector {
  private rules: DecisionRule[] = [];

  constructor(_catalogPath?: string) {
    this.loadDecisionTable();
  }

  private loadDecisionTable(): void {
    this.rules = [
      {
        id: 'bugfix-critical',
        when: (ctx) => ctx.problemType === 'bug_fix' && ctx.riskLevel === 'critical',
        result: () => ({
          primary: 'surgical-team',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Critical bug requires precision, minimal changes, auto-rollback',
          confidence: 0.95,
        }),
        priority: 100,
      },
      {
        id: 'bugfix-monorepo',
        when: (ctx) => ctx.problemType === 'bug_fix' && ctx.scope === 'monorepo',
        result: () => ({
          primary: 'ant-colony',
          secondary: 'immune-system',
          blend: { primary: 70, secondary: 30 },
          rationale: 'Wide-scope bug needs parallel search with immune verification',
          confidence: 0.85,
        }),
        priority: 80,
      },
      {
        id: 'bugfix-security',
        when: (ctx) => ctx.problemType === 'bug_fix' && ctx.domain === 'security',
        result: () => ({
          primary: 'immune-system',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Security bug requires immune system detection and response',
          confidence: 0.95,
        }),
        priority: 95,
      },
      {
        id: 'bugfix-default',
        when: (ctx) => ctx.problemType === 'bug_fix',
        result: () => ({
          primary: 'manufacturing',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Standard bug fix through manufacturing pipeline',
          confidence: 0.8,
        }),
        priority: 50,
      },
      {
        id: 'feature-multi-package',
        when: (ctx) => ctx.problemType === 'feature' && ctx.scope === 'multi_package',
        result: () => ({
          primary: 'bee-colony',
          secondary: 'manufacturing',
          blend: { primary: 70, secondary: 30 },
          rationale: 'Multi-package feature needs hive coordination with manufacturing precision',
          confidence: 0.85,
        }),
        priority: 90,
      },
      {
        id: 'feature-urgent',
        when: (ctx) => ctx.problemType === 'feature' && ctx.timeline === 'urgent',
        result: () => ({
          primary: 'orchestra',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Urgent feature needs synchronized orchestration',
          confidence: 0.9,
        }),
        priority: 85,
      },
      {
        id: 'feature-cross-system',
        when: (ctx) => ctx.problemType === 'feature' && ctx.scope === 'cross_system',
        result: () => ({
          primary: 'octopus',
          secondary: 'manufacturing',
          blend: { primary: 60, secondary: 40 },
          rationale: 'Cross-system feature needs multi-arm coordination',
          confidence: 0.8,
        }),
        priority: 80,
      },
      {
        id: 'feature-default',
        when: (ctx) => ctx.problemType === 'feature',
        result: () => ({
          primary: 'manufacturing',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Standard feature through manufacturing pipeline',
          confidence: 0.75,
        }),
        priority: 50,
      },
      {
        id: 'security-any',
        when: (ctx) => ctx.problemType === 'security',
        result: () => ({
          primary: 'immune-system',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Security issues always use immune system pattern',
          confidence: 0.95,
        }),
        priority: 100,
      },
      {
        id: 'performance-any',
        when: (ctx) => ctx.problemType === 'performance',
        result: () => ({
          primary: 'mathematical-swarm',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Performance optimization needs metric-driven convergence',
          confidence: 0.9,
        }),
        priority: 100,
      },
      {
        id: 'incident-any',
        when: (ctx) => ctx.problemType === 'incident',
        result: () => ({
          primary: 'wolf-pack',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Incidents require alpha-led coordinated response',
          confidence: 0.95,
        }),
        priority: 100,
      },
      {
        id: 'discovery-any',
        when: (ctx) => ctx.problemType === 'discovery',
        result: () => ({
          primary: 'research-lab',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Discovery requires research-before-build methodology',
          confidence: 0.9,
        }),
        priority: 100,
      },
      {
        id: 'refactor-monorepo',
        when: (ctx) => ctx.problemType === 'refactor' && ctx.scope === 'monorepo',
        result: () => ({
          primary: 'ant-colony',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Monorepo refactor needs parallel swarm intelligence',
          confidence: 0.9,
        }),
        priority: 90,
      },
      {
        id: 'refactor-default',
        when: (ctx) => ctx.problemType === 'refactor',
        result: () => ({
          primary: 'manufacturing',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Standard refactor through manufacturing pipeline',
          confidence: 0.75,
        }),
        priority: 50,
      },
      {
        id: 'maintenance-any',
        when: (ctx) => ctx.problemType === 'maintenance',
        result: () => ({
          primary: 'manufacturing',
          blend: { primary: 100, secondary: 0 },
          rationale: 'Maintenance through standard manufacturing pipeline',
          confidence: 0.8,
        }),
        priority: 50,
      },
    ];
  }

  select(ctx: TaskContext): DnaSelection {
    const matches = this.rules.filter((r) => r.when(ctx)).sort((a, b) => b.priority - a.priority);

    if (matches.length === 0) {
      return {
        primary: 'manufacturing',
        blend: { primary: 100, secondary: 0 },
        rationale: 'No specific rule matched -> default Manufacturing',
        confidence: 0.5,
      };
    }

    let selection = matches[0].result();

    if (
      (ctx.riskLevel === 'critical' || ctx.riskLevel === 'high') &&
      ctx.domain !== 'security' &&
      selection.primary !== 'immune-system'
    ) {
      selection = {
        ...selection,
        secondary: 'immune-system',
        blend: { primary: 70, secondary: 30 },
        rationale: `${selection.rationale} + Immune System overlay (risk=${ctx.riskLevel})`,
        confidence: selection.confidence * 0.95,
      };
    }

    if (ctx.compliance && ctx.compliance.length > 0) {
      selection = {
        ...selection,
        secondary: selection.secondary || 'enterprise-governance',
        blend: {
          primary: selection.blend.primary,
          secondary: selection.blend.secondary + (selection.secondary ? 0 : 30),
        },
        rationale: `${selection.rationale} + Enterprise Governance (compliance: ${ctx.compliance.join(', ')})`,
        confidence: selection.confidence * 0.98,
      };
    }

    return selection;
  }

  getRuleById(id: string): DecisionRule | undefined {
    return this.rules.find((r) => r.id === id);
  }

  listRules(): DecisionRule[] {
    return [...this.rules];
  }
}
