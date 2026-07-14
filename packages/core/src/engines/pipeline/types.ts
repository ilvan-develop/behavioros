import type {
  ConversationProtocol,
  DNAPackage,
  PipelineReport,
  PipelineState,
  SkillReference,
} from '@behavioros/schemas';

// ============================================================
// Pipeline Engine Types — EAARG Pipeline Execution
// ============================================================

export type PipelineStatus = 'created' | 'running' | 'paused' | 'completed' | 'failed';
export type LayerStatus = 'pending' | 'in_progress' | 'pass' | 'fail' | 'skip';

export interface PipelineContext {
  projectPath: string;
  dna: DNAPackage;
  options?: PipelineOptions;
}

export interface PipelineOptions {
  startLayer?: number;
  endLayer?: number;
  skipValidation?: boolean;
  autoAdvance?: boolean;
  timeout?: number;
  skills?: SkillReference[];
}

export interface LayerExecutionResult {
  layer: number;
  layerName: string;
  status: LayerStatus;
  score: number;
  protocol: ConversationProtocol;
  evidenceCollected: string[];
  questionsAnswered: number;
  questionsTotal: number;
  criteriaMet: number;
  criteriaTotal: number;
  skillsUsed: string[];
  skillsScore: number;
  duration: number;
  timestamp: string;
  error?: string;
}

export interface GateCheckResult {
  passed: boolean;
  failedGates: string[];
  warnings: string[];
}

export interface EvidenceValidationResult {
  valid: boolean;
  collected: string[];
  missing: string[];
  extra: string[];
}

export interface SkillValidationResult {
  skillId: string;
  skillName: string;
  loaded: boolean;
  applicable: boolean;
  score: number;
  recommendations: string[];
}

export interface PipelineEngineEvents {
  'pipeline:started': (state: PipelineState) => void;
  'pipeline:paused': (state: PipelineState) => void;
  'pipeline:resumed': (state: PipelineState) => void;
  'pipeline:completed': (report: PipelineReport) => void;
  'pipeline:failed': (state: PipelineState, error: Error) => void;
  'layer:started': (layer: number, layerName: string) => void;
  'layer:completed': (result: LayerExecutionResult) => void;
  'layer:failed': (result: LayerExecutionResult) => void;
  'layer:gate_checked': (layer: number, result: GateCheckResult) => void;
  'evidence:collected': (layer: number, evidence: string[]) => void;
  'evidence:validated': (layer: number, result: EvidenceValidationResult) => void;
  'skills:validated': (layer: number, results: SkillValidationResult[]) => void;
}
