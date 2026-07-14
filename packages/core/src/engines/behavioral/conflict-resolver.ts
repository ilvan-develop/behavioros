/**
 * BOS Conflict Resolver — resolves agent conflicts via protocol-driven templates.
 * Supports: backend_vs_frontend, security_vs_feature, qa_vs_developer, devops_vs_backend.
 */

export interface ConflictContext {
  type:
    | 'backend_vs_frontend'
    | 'security_vs_feature'
    | 'qa_vs_developer'
    | 'devops_vs_backend'
    | 'custom';
  agents: string[];
  issue: string;
  evidence?: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Resolution {
  resolution: string;
  steps: string[];
  winner?: string;
  compromise?: string;
  escalation?: string;
  timeout: string;
  timestamp: string;
}

const RESOLUTION_TEMPLATES: Record<ConflictContext['type'], Omit<Resolution, 'timestamp'>> = {
  backend_vs_frontend: {
    resolution: 'Contract boundary dispute resolved by contract spec',
    steps: [
      '1. Frontend raises contract concern with evidence',
      '2. Backend presents contract spec (Zod schema)',
      '3. If contract-compliant: Frontend adapts implementation',
      '4. If contract-broken: Backend must version contract',
      '5. If disputed: Escalate to architect',
    ],
    escalation: 'architect -> cto -> human',
    timeout: '2 cycles',
  },
  security_vs_feature: {
    resolution: 'Security vs delivery resolved by risk assessment',
    steps: [
      '1. Security raises concern with OWASP/compliance evidence',
      '2. Feature team presents business case and risk acceptance',
      '3. If risk_acceptable: Proceed with mitigations',
      '4. If risk_unacceptable: Halt feature until resolved',
      '5. If disputed: CTO makes final call',
    ],
    escalation: 'cto -> human',
    timeout: '1 cycle',
  },
  qa_vs_developer: {
    resolution: 'Quality gate dispute resolved by fix plan viability',
    steps: [
      '1. QA blocks release with test evidence',
      '2. Developer presents fix plan with timeline',
      '3. If fix_viable: Proceed with fix and re-test',
      '4. If insufficient: Escalate to tech lead',
      '5. Tech lead decides: fix or accept documented risk',
    ],
    escalation: 'tech_lead -> architect',
    timeout: '1 cycle',
  },
  devops_vs_backend: {
    resolution: 'Infra vs app resolved by capability assessment',
    steps: [
      '1. DevOps raises infrastructure concern',
      '2. Backend presents application need',
      '3. If infra_can_accommodate: DevOps adapts',
      '4. If infra_cannot: Backend adapts',
      '5. If disputed: Architect decides',
    ],
    escalation: 'architect',
    timeout: '2 cycles',
  },
  custom: {
    resolution: 'Custom conflict resolved by evidence-based analysis',
    steps: [
      '1. Both agents present position with evidence',
      '2. Orchestrator analyzes cost-benefit',
      '3. If clear winner: Proceed',
      '4. If unclear: Escalate to architect',
    ],
    escalation: 'architect -> cto',
    timeout: '2 cycles',
  },
};

export class ConflictResolver {
  private history: Array<ConflictContext & { resolution: Resolution }> = [];

  resolve(context: ConflictContext): Resolution {
    const template = RESOLUTION_TEMPLATES[context.type];

    const resolution: Resolution = {
      ...template,
      timestamp: new Date().toISOString(),
    };

    if (context.evidence && context.evidence.length > 0 && context.agents.length === 2) {
      resolution.winner = this.determineWinner(context);
    }

    this.history.push({ ...context, resolution });
    return resolution;
  }

  getResolutionHistory(
    type?: ConflictContext['type'],
  ): Array<ConflictContext & { resolution: Resolution }> {
    if (type) {
      return this.history.filter((h) => h.type === type);
    }
    return [...this.history];
  }

  private determineWinner(context: ConflictContext): string | undefined {
    if (context.agents.length !== 2) return undefined;

    if (context.type === 'security_vs_feature') {
      return context.agents.find((a) => a.toLowerCase().includes('security'));
    }

    if (context.type === 'qa_vs_developer' && context.severity === 'critical') {
      return context.agents.find((a) => a.toLowerCase().includes('qa'));
    }

    return undefined;
  }
}
