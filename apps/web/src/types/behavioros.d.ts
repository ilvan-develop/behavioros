declare module '@behavioros/sdk' {
  export interface BehaviorOSConfig {
    dnaPath?: string;
    dnaPackage?: import('@behavioros/schemas').DNAPackage;
    dnaLoaderOptions?: import('@behavioros/core').DNALoaderOptions;
    governance?: {
      enabled?: boolean;
      level?: 'strict' | 'standard' | 'minimal';
      requireApproval?: boolean;
      maxAgents?: number;
    };
    quality?: {
      enabled?: boolean;
      minCoverage?: number;
      enforceTypecheck?: boolean;
      enforceLint?: boolean;
    };
    learning?: {
      enabled?: boolean;
      persistPath?: string;
      autoApply?: boolean;
    };
    audit?: {
      enabled?: boolean;
    };
    outputDir?: string;
  }

  export interface BehaviorOSStatus {
    engine: boolean;
    dna: string | null;
    missions: number;
    agents: number;
    auditEvents: number;
    qualityMetrics: number;
    learningEvents: number;
  }

  export class BehaviorOS {
    constructor(config?: BehaviorOSConfig);
    init(): Promise<void>;
    loadDNA(path: string): void;

    createMission(input: {
      title: string;
      description?: string;
      type: import('@behavioros/schemas').Mission['type'];
      priority?: import('@behavioros/schemas').Mission['priority'];
      context?: Record<string, unknown>;
    }): Promise<import('@behavioros/schemas').Mission>;

    startMission(missionId: string): Promise<import('@behavioros/schemas').Mission>;
    completeMission(
      missionId: string,
      output?: Record<string, unknown>,
    ): Promise<import('@behavioros/schemas').Mission>;
    failMission(missionId: string, error: Error): Promise<import('@behavioros/schemas').Mission>;
    getMission(id: string): import('@behavioros/schemas').Mission | undefined;
    getAllMissions(): import('@behavioros/schemas').Mission[];

    getAllAgents(): import('@behavioros/schemas').AgentState[];
    getAgentsByRole(role: string): import('@behavioros/schemas').AgentState[];

    evaluateGovernance(
      action: string,
      context: Record<string, unknown>,
    ): Promise<{
      approved: boolean;
      violations: import('@behavioros/schemas').GovernanceRule[];
      warnings: import('@behavioros/schemas').GovernanceRule[];
    }>;

    evaluateGovernanceDetailed(
      context: import('@behavioros/core').GovernanceContext,
    ): Promise<import('@behavioros/core').GovernanceDecision>;

    evaluateQuality(metrics: import('@behavioros/schemas').QualityMetric[]): Promise<{
      passed: boolean;
      failedGates: import('@behavioros/schemas').QualityGate[];
      metrics: import('@behavioros/schemas').QualityMetric[];
    }>;

    recordLearning(
      event: Omit<import('@behavioros/schemas').LearningEvent, 'id' | 'timestamp'>,
    ): Promise<import('@behavioros/schemas').LearningEvent>;

    runAudit(
      projectPath: string,
      stages?: import('@behavioros/core').AuditStage[],
    ): Promise<import('@behavioros/core').AuditPipelineResult>;

    getAuditHistory(): import('@behavioros/core').AuditPipelineResult[];

    makeDecision(
      context: import('@behavioros/core').DecisionContext,
      votes: import('@behavioros/core').DecisionVote[],
    ): Promise<import('@behavioros/core').DecisionResult>;

    runPipeline(
      options?: import('@behavioros/core').PipelineOptions,
    ): Promise<import('@behavioros/schemas').PipelineState>;
    advancePipeline(): Promise<import('@behavioros/schemas').LayerResult>;
    pausePipeline(): import('@behavioros/schemas').PipelineState;
    resumePipeline(): import('@behavioros/schemas').PipelineState;
    validatePipelineLayer(
      layer: number,
      evidence: string[],
    ): Promise<import('@behavioros/schemas').LayerResult>;
    getPipelineState(): import('@behavioros/schemas').PipelineState | undefined;
    getPipelineReport(): import('@behavioros/schemas').PipelineReport | undefined;
    getPipelineProgress(): { current: number; total: number; percent: number } | undefined;

    getStatus(): BehaviorOSStatus;
    getStats(): {
      missions: Record<string, number>;
      agents: Record<string, number>;
      auditEvents: number;
      qualityMetrics: number;
      learningEvents: number;
    };
  }
}

declare module '@behavioros/core' {
  export type DNALoaderOptions = Record<string, unknown>;
  export type AuditStage =
    | 'static'
    | 'architecture'
    | 'security'
    | 'performance'
    | 'tests'
    | 'coverage'
    | 'contracts'
    | 'docs'
    | 'compliance'
    | 'benchmarks';

  export interface AuditPipelineResult {
    passed: boolean;
    stages: Array<{
      stage: string;
      passed: boolean;
      details: Record<string, unknown>;
    }>;
    summary: string;
  }

  export interface GovernanceContext {
    action: string;
    agentRole?: string;
    agentAuthority?: string;
    context?: Record<string, unknown>;
  }

  export interface GovernanceDecision {
    allowed: boolean;
    reason: string;
    escalationRequired: boolean;
  }

  export interface DecisionContext {
    title: string;
    description?: string;
    options: DecisionOption[];
  }

  export interface DecisionOption {
    id: string;
    label: string;
    description?: string;
  }

  export interface DecisionVote {
    agentId: string;
    optionId: string;
    weight: number;
    rationale?: string;
  }

  export interface DecisionResult {
    approved: boolean;
    winningOption?: string;
    votes: DecisionVote[];
  }

  export interface PipelineOptions {
    maxRetries?: number;
    timeout?: number;
  }

  export class DNALoader {
    constructor(options?: DNALoaderOptions);
    load(path: string): import('@behavioros/schemas').DNAPackage;
  }
}
