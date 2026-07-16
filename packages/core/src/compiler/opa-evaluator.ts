import type { OPARegoPolicy, OPARegoRule } from './yaml-to-opa';

export interface OPAInput {
  action: { type: string; payload?: unknown };
  agent: { id: string; authority: string; dnaMode: string };
  governance: { level: string };
  boundaries: Array<{ type: string; value: unknown; scope: string }>;
}

export interface OPAOutput {
  allow: boolean;
  deny: boolean;
  violations: string[];
}

export class OPAEvaluator {
  private policies = new Map<string, OPARegoPolicy>();

  registerPolicy(dnaId: string, policy: OPARegoPolicy): void {
    this.policies.set(dnaId, policy);
  }

  evaluate(dnaId: string, input: OPAInput): OPAOutput {
    const policy = this.policies.get(dnaId);
    if (!policy) {
      return { allow: false, deny: true, violations: ['No policy found'] };
    }

    const violations: string[] = [];
    let allow = true;
    let deny = false;

    for (const rule of policy.rules) {
      if (rule.body.startsWith('deny')) {
        if (this.matchesRule(rule, input)) {
          deny = true;
          allow = false;
          violations.push(rule.name);
        }
      }
    }

    if (!deny) {
      for (const rule of policy.rules) {
        if (rule.body.startsWith('escalate')) {
          if (this.matchesRule(rule, input)) {
            violations.push(rule.name);
          }
        }
      }
    }

    return { allow, deny, violations };
  }

  private matchesRule(rule: OPARegoRule, input: OPAInput): boolean {
    const actionMatch = rule.body.includes(input.action.type);
    if (!actionMatch) return false;

    if (rule.body.includes('input.agent.authority')) {
      return rule.body.includes(input.agent.authority);
    }

    return true;
  }
}
