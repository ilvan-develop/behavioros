export type MissionStatus = 'draft' | 'executing' | 'completed' | 'failed' | 'paused';
export type MissionPriority = 'critical' | 'high' | 'medium' | 'low';
export type MissionType = 'research' | 'build' | 'review' | 'deploy' | 'monitor';

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
