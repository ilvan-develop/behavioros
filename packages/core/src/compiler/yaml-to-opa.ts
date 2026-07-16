import type { BoundaryRule, DNAPackage, GovernanceRule } from '@behavioros/schemas';

export interface OPARegoPolicy {
  package: string;
  rules: OPARegoRule[];
}

export interface OPARegoRule {
  name: string;
  body: string;
}

export class YAMLToOPACompiler {
  compile(dna: DNAPackage): OPARegoPolicy {
    const rules: OPARegoRule[] = [];

    dna.governance?.forEach((rule) => {
      rules.push(this.compileGovernanceRule(rule));
    });

    dna.personas?.forEach((persona) => {
      persona.boundaries?.forEach((boundary) => {
        rules.push(this.compileBoundaryRule(boundary));
      });
    });

    return {
      package: `behaviouros.${dna.id}`,
      rules,
    };
  }

  private compileGovernanceRule(rule: GovernanceRule): OPARegoRule {
    const firstCondition = rule.conditions?.[0] ?? 'read';

    if (rule.action === 'block') {
      return {
        name: `governance_${rule.id}`,
        body: `deny { input.action.type == "${firstCondition}" }`,
      };
    }

    if (rule.action === 'escalate') {
      return {
        name: `governance_${rule.id}`,
        body: `escalate { input.action.type == "${firstCondition}" ; input.agent.authority < "${rule.level}" }`,
      };
    }

    return {
      name: `governance_${rule.id}`,
      body: `allow { input.action.type == "${firstCondition}" ; input.governance.level >= "${rule.level}" }`,
    };
  }

  private compileBoundaryRule(boundary: BoundaryRule): OPARegoRule {
    if (boundary.type === 'forbidden') {
      return {
        name: `boundary_${boundary.id}`,
        body: `deny { input.action.matches("${String(boundary.value)}") }`,
      };
    }

    return {
      name: `boundary_${boundary.id}`,
      body: `allow { boundary_check("${boundary.type}", ${String(boundary.value)}, "${boundary.scope}") }`,
    };
  }
}
