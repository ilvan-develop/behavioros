import { join } from 'node:path';
import type { BehaviorOSEngine, ProtocolStateTracker } from '@behavioros/core';
import { readState, writeSignedState } from '@behavioros/core';
import type { BoundaryRule } from '@behavioros/schemas';

export type RequiredStep = 'dna' | 'truth' | 'mission' | 'audit' | 'learning';
export type EnforcementLevel = 'strict' | 'standard' | 'audit';

export interface EnforcementOptions {
  /** Protocol steps that must be completed before this tool runs */
  requiredSteps: RequiredStep[];
  /** Whether to auto-evaluate governance rules before executing */
  evaluateGovernance: boolean;
  /** Action name to pass to governance evaluation (e.g., 'start-pipeline', 'edit-file') */
  governanceAction?: string;
  /** Tool name for error messages */
  toolName: string;
  /** Required skills the agent must have to use this tool (skill validation) */
  requiredSkills?: string[];
  /** Agent ID for skill validation */
  agentId?: string;
  /** Agent role for governance/boundary evaluation (e.g. 'orchestrator', 'engineer') */
  agentRole?: string;
  /** Agent authority level for governance/boundary evaluation */
  agentAuthority?: string;
  /** Files targeted by this tool call, for forbidden-pattern / max_files boundary checks */
  targetFiles?: string[];
  /** Number of files touched by this tool call, for max_files boundary checks */
  fileCount?: number;
  /** Number of lines changed by this tool call, for max_lines boundary checks */
  lineCount?: number;
  /** Boundary rules (from the active persona's DNA) to enforce for this call */
  boundaries?: BoundaryRule[];
}

export interface EnforcementResult {
  allowed: boolean;
  blocked: boolean;
  reason?: string;
  governanceResult?: { approved: boolean; violations: any[]; warnings: any[] };
  skillValidation?: {
    allowed: boolean;
    missingSkills: string[];
    insufficientProficiency: string[];
    reason?: string;
  };
}

export class EnforcementMiddleware {
  private protocolTracker: ProtocolStateTracker;
  private engine: BehaviorOSEngine;
  private level: EnforcementLevel;
  private projectRoot: string;
  private activeRole?: string;
  /** Set when syncFromDisk() detects a signed state file that failed signature
   * verification (i.e. the boolean flags were hand-edited without recomputing the
   * HMAC). While true, enforce() fails closed on every call regardless of level,
   * until bos_reset_protocol explicitly clears it. */
  private tamperDetected = false;
  private tamperReason?: string;

  constructor(
    protocolTracker: ProtocolStateTracker,
    engine: BehaviorOSEngine,
    level?: EnforcementLevel,
    projectRoot?: string,
  ) {
    this.protocolTracker = protocolTracker;
    this.engine = engine;
    this.level =
      level ?? (process.env.BEHAVIOROS_ENFORCEMENT_LEVEL as EnforcementLevel) ?? 'standard';
    this.projectRoot = projectRoot ?? process.cwd();
    // Load persisted state on construction
    this.syncFromDisk();
  }

  /** Set the active persona role (e.g. 'orchestrator'), persisted alongside protocol state. */
  setActiveRole(role: string | undefined): void {
    this.activeRole = role;
  }

  getActiveRole(): string | undefined {
    return this.activeRole;
  }

  wasTamperDetected(): boolean {
    return this.tamperDetected;
  }

  /** Clear a tamper flag. Only meant to be called from bos_reset_protocol (confirm=true). */
  clearTamperFlag(): void {
    this.tamperDetected = false;
    this.tamperReason = undefined;
  }

  /**
   * Persist current protocol state to a signed .agent_state.json (see agent-state-store.ts).
   */
  persist(): void {
    const statePath = join(this.projectRoot, '.agent_state.json');
    const state = this.protocolTracker.getState();
    writeSignedState(statePath, {
      dnaSelected: state.dnaSelected,
      truthResolved: state.truthResolved,
      missionCreated: state.missionCreated,
      auditDone: state.auditDone,
      learningRecorded: state.learningRecorded,
      lastStep: state.currentStep === 0 ? null : state.currentStep,
      lastUpdated: new Date().toISOString(),
      activeRole: this.activeRole,
    });
  }

  /**
   * Load protocol state from .agent_state.json into the tracker, verifying its
   * signature. Returns false if there's no state file yet OR if the state was
   * tampered with (signature mismatch) — callers should check wasTamperDetected()
   * to distinguish the two cases.
   */
  syncFromDisk(): boolean {
    const statePath = join(this.projectRoot, '.agent_state.json');
    const result = readState(statePath);

    if (result.tampered) {
      this.tamperDetected = true;
      this.tamperReason = result.reason;
      return false;
    }

    if (!result.ok || !result.data) return false;

    const { protocol } = result.data;
    if (protocol.dnaSelected === true) this.protocolTracker.markDnaSelected();
    if (protocol.truthResolved === true) this.protocolTracker.markTruthResolved();
    if (protocol.missionCreated === true) this.protocolTracker.markMissionCreated();
    if (protocol.auditDone === true) this.protocolTracker.markAuditDone();
    if (protocol.learningRecorded === true) this.protocolTracker.markLearningRecorded();
    if (protocol.activeRole) this.activeRole = protocol.activeRole;
    return true;
  }

  /**
   * Enforce protocol compliance BEFORE executing the handler.
   * Returns an EnforcementResult that says whether to block or allow.
   */
  async enforce(options: EnforcementOptions): Promise<EnforcementResult> {
    // 0. Fail closed if the on-disk state was found to be tampered with. bos_reset_protocol
    // is exempt so there's always a documented recovery path — otherwise a tamper flag
    // (real or a false positive from a corrupted secret) would permanently brick the server.
    if (this.tamperDetected && options.toolName !== 'bos_reset_protocol') {
      return {
        allowed: false,
        blocked: true,
        reason:
          `Protocol state integrity check failed (${this.tamperReason ?? 'signature-mismatch'}): ` +
          '.agent_state.json was modified without going through BehaviorOS tools. ' +
          'Run bos_reset_protocol with confirm=true to acknowledge and reset.',
      };
    }

    // 1. Validate required protocol steps
    const stepValidation = this.validateRequiredSteps(options);
    if (!stepValidation.allowed) {
      return stepValidation;
    }

    // 1b. Orchestrator boundary/governance check for file-targeting actions
    if (options.targetFiles?.length || options.boundaries?.length) {
      const boundaryResult = await this.evaluateBoundaries(options);
      if (!boundaryResult.allowed) {
        return boundaryResult;
      }
    }

    // 2. Validate required skills if specified
    if (options.requiredSkills && options.requiredSkills.length > 0 && options.agentId) {
      const skillValidation = await this.validateRequiredSkills(options);
      if (!skillValidation.allowed) {
        if (this.level === 'strict') {
          return {
            allowed: false,
            blocked: true,
            reason: `Skill validation failed: ${skillValidation.reason}`,
            skillValidation,
          };
        }
        if (this.level === 'standard') {
          if (skillValidation.missingSkills.length > 0) {
            return {
              allowed: false,
              blocked: true,
              reason: `Missing required skills: ${skillValidation.missingSkills.join(', ')}`,
              skillValidation,
            };
          }
        }
      }
    }

    // 3. Auto-evaluate governance if requested
    if (options.evaluateGovernance && options.governanceAction) {
      const govResult = await this.engine.evaluateGovernance(options.governanceAction, {
        toolName: options.toolName,
        requiredSteps: options.requiredSteps,
        agentRole: options.agentRole ?? this.activeRole,
        agentAuthority: options.agentAuthority,
        targetFiles: options.targetFiles,
        fileCount: options.fileCount ?? options.targetFiles?.length,
        lineCount: options.lineCount,
        boundaries: options.boundaries,
      });

      // Not just `violations.length > 0`: boundary rejections (max_files, forbidden
      // globs, etc.) surface as `approved: false` without a matching GovernanceRule,
      // so they'd otherwise slip through this gate silently.
      if (!govResult.approved && this.level !== 'audit') {
        const reason =
          govResult.violations.length > 0
            ? `Governance violation: ${govResult.violations.map((v: any) => v.name).join(', ')}`
            : `Governance violation: ${govResult.reason ?? 'boundary check failed'}`;
        return {
          allowed: false,
          blocked: true,
          reason,
          governanceResult: govResult,
        };
      }

      return {
        allowed: true,
        blocked: false,
        governanceResult: govResult,
      };
    }

    return { allowed: true, blocked: false };
  }

  /**
   * Evaluate boundary rules (max_files, max_lines, forbidden globs, require_approval)
   * for a tool call that targets specific files, independent of the general
   * `evaluateGovernance` flag — so boundary checks run even for tools that don't
   * otherwise opt into full governance evaluation.
   */
  private async evaluateBoundaries(options: EnforcementOptions): Promise<EnforcementResult> {
    const govResult = await this.engine.evaluateGovernance(
      options.governanceAction ?? options.toolName,
      {
        toolName: options.toolName,
        agentRole: options.agentRole ?? this.activeRole,
        agentAuthority: options.agentAuthority,
        targetFiles: options.targetFiles,
        fileCount: options.fileCount ?? options.targetFiles?.length,
        lineCount: options.lineCount,
        boundaries: options.boundaries,
      },
    );

    if (!govResult.approved && this.level !== 'audit') {
      const reason =
        govResult.violations.length > 0
          ? `Boundary violation: ${govResult.violations.map((v: any) => v.name).join(', ')}`
          : (govResult.reason ?? 'Boundary violation');
      return { allowed: false, blocked: true, reason, governanceResult: govResult };
    }

    return { allowed: true, blocked: false, governanceResult: govResult };
  }

  /**
   * Validate that the agent has the required skills.
   */
  private async validateRequiredSkills(options: EnforcementOptions): Promise<{
    allowed: boolean;
    missingSkills: string[];
    insufficientProficiency: string[];
    reason?: string;
  }> {
    const { requiredSkills, agentId } = options;
    if (!requiredSkills?.length || !agentId) {
      return { allowed: true, missingSkills: [], insufficientProficiency: [] };
    }

    const validation = await this.engine.skillEngine.validateDelegation(
      agentId,
      agentId,
      requiredSkills,
    );

    return validation;
  }

  private validateRequiredSteps(options: EnforcementOptions): EnforcementResult {
    const tracker = this.protocolTracker;
    const state = tracker.getState();
    const missing: string[] = [];

    for (const step of options.requiredSteps) {
      switch (step) {
        case 'dna':
          if (!state.dnaSelected) missing.push('Select DNA (bos_select_dna)');
          break;
        case 'truth':
          if (!state.truthResolved) missing.push('Resolve Truth (bos_resolve_truth)');
          break;
        case 'mission':
          if (!state.missionCreated) missing.push('Create Mission (create-mission)');
          break;
        case 'audit':
          if (!state.auditDone) missing.push('Run Audit (bos_run_audit)');
          break;
        case 'learning':
          if (!state.learningRecorded) missing.push('Record Learning (record-learning)');
          break;
      }
    }

    if (missing.length > 0) {
      return {
        allowed: false,
        blocked: this.level !== 'audit',
        reason: `Protocol enforcement failed for "${options.toolName}": prerequisite steps missing — ${missing.join(', ')}`,
      };
    }

    return { allowed: true, blocked: false };
  }

  getLevel(): EnforcementLevel {
    return this.level;
  }

  setLevel(level: EnforcementLevel): void {
    this.level = level;
  }
}
