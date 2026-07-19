// Deploy — Canary deployment system barrel exports

export type {
  CanaryDeployerConfig,
  CanaryDeployerEvents,
  CanaryDeployment,
  CanaryDeploymentStatus,
  CanaryStageConfig,
  CanaryStageState,
} from './canary-deployer';
export { CanaryDeployer } from './canary-deployer';

export type {
  HealthCheckCategory,
  HealthCheckerConfig,
  HealthCheckerEvents,
  HealthCheckProbe,
  HealthCheckResult,
  HealthCheckStatus,
  HealthThreshold,
} from './health-checker';
export { HealthChecker } from './health-checker';

export type {
  RollbackManagerConfig,
  RollbackManagerEvents,
  RollbackRecord,
  RollbackStatus,
  RollbackTrigger,
} from './rollback-manager';
export { RollbackManager } from './rollback-manager';
export { STAGE_5_CONFIG, STAGE_5_THRESHOLDS } from './stages/stage-5';
export { STAGE_25_CONFIG, STAGE_25_THRESHOLDS } from './stages/stage-25';
export { STAGE_50_CONFIG, STAGE_50_THRESHOLDS } from './stages/stage-50';
export { STAGE_100_CONFIG, STAGE_100_THRESHOLDS } from './stages/stage-100';
export type {
  RoutingDecision,
  SplitStrategy,
  StickySession,
  TrafficRoute,
  TrafficSplitterConfig,
  TrafficSplitterEvents,
} from './traffic-splitter';
export { TrafficSplitter } from './traffic-splitter';
