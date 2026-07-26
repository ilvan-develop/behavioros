import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BehaviorOSEngine, ProtocolStateTracker } from '@behavioros/core';

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

  /**
   * Persist current protocol state to .agent_state.json.
   */
  persist(): void {
    const statePath = join(this.projectRoot, '.agent_state.json');
    const tracker = this.protocolTracker;
    const state = tracker.getState();
    const data = JSON.stringify(
      {
        version: '1.0',
        protocol: {
          dnaSelected: state.dnaSelected,
          truthResolved: state.truthResolved,
          missionCreated: state.missionCreated,
          auditDone: state.auditDone,
          learningRecorded: state.learningRecorded,
          lastStep: state.currentStep === 0 ? null : state.currentStep,
          lastUpdated: new Date().toISOString(),
        },
      },
      null,
      2,
    );
    writeFileSync(statePath, data, 'utf-8');
  }

  /**
   * Load protocol state from .agent_state.json into the tracker.
   */
  syncFromDisk(): boolean {
    const statePath = join(this.projectRoot, '.agent_state.json');
    if (!existsSync(statePath)) return false;

    try {
      const raw = readFileSync(statePath, 'utf-8');
      const diskState = JSON.parse(raw);
      const protocol = diskState.protocol as Record<string, unknown> | undefined;
      if (!protocol) return false;

      if (protocol.dnaSelected === true) this.protocolTracker.markDnaSelected();
      if (protocol.truthResolved === true) this.protocolTracker.markTruthResolved();
      if (protocol.missionCreated === true) this.protocolTracker.markMissionCreated();
      if (protocol.auditDone === true) this.protocolTracker.markAuditDone();
      if (protocol.learningRecorded === true) this.protocolTracker.markLearningRecorded();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Enforce protocol compliance BEFORE executing the handler.
   * Returns an EnforcementResult that says whether to block or allow.
   */
  async enforce(options: EnforcementOptions): Promise<EnforcementResult> {
    // 1. Validate required protocol steps
    const stepValidation = this.validateRequiredSteps(options);
    if (!stepValidation.allowed) {
      return stepValidation;
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
      });

      const hasCriticalViolations = govResult.violations.length > 0;

      if (hasCriticalViolations && this.level !== 'audit') {
        return {
          allowed: false,
          blocked: true,
          reason: `Governance violation: ${govResult.violations.map((v: any) => v.name).join(', ')}`,
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
