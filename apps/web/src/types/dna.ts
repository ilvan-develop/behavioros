export interface AgentPersona {
  role: string;
  authority: string;
  name: string;
  description: string;
  boundaries?: {
    id: string;
    name: string;
    type: string;
    value: string | number | boolean;
    scope: string;
  }[];
  skills?: string[];
  tools?: string[];
}

export interface GovernanceRule {
  id: string;
  name: string;
  type: string;
  description: string;
  severity?: string;
  action?: string;
  conditions?: Record<string, unknown>;
}

export interface QualityGate {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  operator: string;
  action?: string;
}

export interface BehaviorPattern {
  id?: string;
  name: string;
  description: string;
  triggers?: string[];
  actions?: string[];
  frequency?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  order: number;
  inputs?: string[];
  outputs?: string[];
  timeout?: number;
  fallback?: string;
}

export interface DNADetail {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  tags?: string[];
  personas: AgentPersona[];
  governance?: GovernanceRule[];
  quality?: QualityGate[];
  patterns?: BehaviorPattern[];
  workflows?: WorkflowStep[];
  config?: Record<string, unknown>;
}
