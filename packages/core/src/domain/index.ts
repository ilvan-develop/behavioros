// ============================================================
// Domain — DDD Boundaries & Anti-Corruption Layer
// ============================================================

export type {
  ACLResult,
  AntiCorruptionLayer,
  EventType,
} from './anti-corruption';
export { AgentACL, DataACL, EventACL } from './anti-corruption';
export type {
  AuthorityLevel,
  Boundary,
  BoundaryResult,
  BoundaryType,
} from './boundaries';
export { AgentBoundary, DNABoundary, ExecutionBoundary } from './boundaries';
export type {
  AgentContextValidationResult,
  DNAContextValidationResult,
} from './contexts';
export { AgentContext, DNAContext } from './contexts';
