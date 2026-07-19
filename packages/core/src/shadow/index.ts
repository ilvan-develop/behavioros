// Shadow Pipeline — barrel exports

export type {
  Alert,
  AlertManagerConfig,
  AlertRule,
  AlertStatus,
  AlertType,
  NotificationChannel,
} from './alert-manager';
export { AlertManager } from './alert-manager';

export type {
  DiffAnalysisSummary,
  DiffCategory,
  DiffFinding,
  DiffResult,
  DiffSeverity,
} from './diff-analyzer';
export { DiffAnalyzer } from './diff-analyzer';

export type {
  ComplianceCheck,
  ComplianceCheckResult,
  ComplianceFramework,
  ComplianceReport,
  ComplianceReportConfig,
  FrameworkCompliance,
} from './reports/compliance-report';
export { ComplianceReportGenerator } from './reports/compliance-report';

export type {
  ReportSection,
  ShadowRecommendation,
  ShadowReport,
  ShadowReportConfig,
} from './reports/shadow-report';
export { ShadowReportGenerator } from './reports/shadow-report';

export type {
  PipelineResult,
  PipelineStatus,
  ShadowHandler,
  ShadowPipelineConfig,
} from './shadow-pipeline';
export { ShadowPipeline } from './shadow-pipeline';

export type {
  CapturedTraffic,
  SamplingMetadata,
  SamplingStrategy,
  TrafficCaptureConfig,
} from './traffic-capture';
export { TrafficCapture } from './traffic-capture';

export type {
  ReplayConfig,
  ReplayResult,
  ReplayStats,
} from './traffic-replay';
export { TrafficReplay } from './traffic-replay';
