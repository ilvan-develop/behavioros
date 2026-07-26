export type MissionStatus = 'draft' | 'executing' | 'completed' | 'failed' | 'paused';
export type MissionPriority = 'critical' | 'high' | 'medium' | 'low';
export type MissionType =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'research'
  | 'incident'
  | 'experiment'
  | 'custom';

export type AgentStatus = 'idle' | 'working' | 'blocked' | 'offline';

export type GovernanceLevel = 'critical' | 'high' | 'medium' | 'low';
export type GovernanceAction = 'block' | 'escalate' | 'warn' | 'log';

export type QualityStatus = 'pass' | 'fail' | 'warn';

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AuditResult = 'pass' | 'fail' | 'warn';

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  priority: MissionPriority;
  status: MissionStatus;
  assignedTo: string[];
  createdAt: string;
  updatedAt: string;
  progress: number;
  tags: string[];
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  authority: string;
  status: AgentStatus;
  reputation: number;
  skills: string[];
  missionsCompleted: number;
  lastActive: string;
  avatar: string;
}

export interface GovernanceRule {
  id: string;
  name: string;
  description: string;
  level: GovernanceLevel;
  action: GovernanceAction;
  conditions: string[];
  scope: string;
  enabled: boolean;
  createdAt: string;
}

export interface QualityGate {
  id: string;
  name: string;
  description: string;
  status: QualityStatus;
  metrics: QualityMetric[];
}

export interface QualityMetric {
  id: string;
  name: string;
  value: number;
  threshold: number;
  unit: string;
  status: QualityStatus;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: string;
  severity: AuditSeverity;
  result: AuditResult;
  description: string;
  agent?: string;
  mission?: string;
}

export interface DnaPackage {
  id: string;
  name: string;
  description: string;
  tags: string[];
  personasCount: number;
  rulesCount: number;
  qualityGatesCount: number;
  version: string;
  createdAt: string;
}

// ─── Ecosystem Types ──────────────────────────────────────

export type SkillSource = 'aitmpl' | 'od' | 'bos' | 'local';
export type SkillStatus = 'active' | 'inactive' | 'outdated' | 'conflict';

export interface EcosystemSkill {
  id: string;
  name: string;
  version: string;
  category: string;
  source: SkillSource;
  status: SkillStatus;
  description: string;
  prerequisites: string[];
  installCommand: string;
  metadata: Record<string, string>;
  updatedAt: string;
}

export type MCPStatus = 'connected' | 'offline' | 'error';

export interface EcosystemMCP {
  id: string;
  name: string;
  status: MCPStatus;
  toolsCount: number;
  envVars: string[];
  description: string;
  source: string;
  version: string;
  updatedAt: string;
}

export interface EcosystemDS {
  id: string;
  name: string;
  description: string;
  status: SkillStatus;
  components: number;
  version: string;
}

export interface EcosystemSummary {
  totalSkills: number;
  totalMCPs: number;
  activeAgents: number;
  designSystemCount: number;
  activeSkills: number;
  connectedMCPs: number;
  skills: EcosystemSkill[];
  mcps: EcosystemMCP[];
  designSystems: EcosystemDS[];
  dnas: DnaPackage[];
}

// ─── Protocol Types ───────────────────────────────────────

export type EnforcementLevel = 'strict' | 'standard' | 'audit';

export interface ProtocolStep {
  id: number;
  name: string;
  tool: string;
  enforced: boolean;
  enforcementLevel: string;
}

export interface ProtocolViolation {
  id: string;
  timestamp: string;
  step: string;
  message: string;
  severity: string;
}

export interface ProtocolStatus {
  enforcementLevel: EnforcementLevel;
  dnaLoaded: boolean;
  steps: ProtocolStep[];
  violations: ProtocolViolation[];
}

export type LearningEventType = 'observation' | 'pattern' | 'insight' | 'feedback' | 'correction';

export interface LearningEvent {
  id: string;
  timestamp: string;
  type: LearningEventType;
  source: string;
  content: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  applied: boolean;
  missionId?: string;
}

export interface LearningPattern {
  id: string;
  type: string;
  description: string;
  confidence: number;
  events: number;
  firstDetected: string;
  lastDetected: string;
  suggestedAction?: string;
}

export interface LearningReport {
  totalEvents: number;
  appliedCount: number;
  pendingCount: number;
  trends: { type: LearningEventType; count: number; trend: 'up' | 'down' | 'stable' }[];
  patterns: LearningPattern[];
  recentEvents: LearningEvent[];
  anomalies: { id: string; description: string; severity: string; timestamp: string }[];
}
