/**
 * ProtocolStateTracker — Tracks compliance with the BehaviorOS 7-Step Delegation Protocol.
 *
 * The protocol defines these mandatory steps:
 *   1. Select DNA   (bos_select_dna)
 *   2. Display DNA  (visual — not tracked via tool)
 *   3. Resolve Truth (bos_resolve_truth)
 *   4. Create Mission (create-mission)
 *   5. Delegate      (Task tool — not tracked via tool)
 *   6. Run Audit     (bos_run_audit)
 *   7. Record Learning (record-learning)
 *
 * This tracker monitors steps 1, 3, 4, 6, 7 (steps 2 and 5 are human/delegation actions
 * that don't correspond to an MCP tool call). The tracker provides validation gates
 * that enforce the correct ordering of steps and block actions that violate the protocol.
 */

export const PROTOCOL_STEPS = {
  DNA_SELECTED: 1,
  TRUTH_RESOLVED: 2,
  MISSION_CREATED: 3,
  AUDIT_DONE: 4,
  LEARNING_RECORDED: 5,
} as const;

export type ProtocolStepNumber = (typeof PROTOCOL_STEPS)[keyof typeof PROTOCOL_STEPS];

export const PROTOCOL_STEP_NAMES: Record<ProtocolStepNumber, string> = {
  [PROTOCOL_STEPS.DNA_SELECTED]: 'Select DNA',
  [PROTOCOL_STEPS.TRUTH_RESOLVED]: 'Resolve Truth',
  [PROTOCOL_STEPS.MISSION_CREATED]: 'Create Mission',
  [PROTOCOL_STEPS.AUDIT_DONE]: 'Run Audit',
  [PROTOCOL_STEPS.LEARNING_RECORDED]: 'Record Learning',
};

export const PROTOCOL_STEP_TOOLS: Record<ProtocolStepNumber, string> = {
  [PROTOCOL_STEPS.DNA_SELECTED]: 'bos_select_dna',
  [PROTOCOL_STEPS.TRUTH_RESOLVED]: 'bos_resolve_truth',
  [PROTOCOL_STEPS.MISSION_CREATED]: 'create-mission',
  [PROTOCOL_STEPS.AUDIT_DONE]: 'bos_run_audit',
  [PROTOCOL_STEPS.LEARNING_RECORDED]: 'record-learning',
};

export interface ProtocolState {
  /** Whether Step 1 (Select DNA) has been completed */
  dnaSelected: boolean;
  /** Whether Step 3 (Resolve Truth) has been completed */
  truthResolved: boolean;
  /** Whether Step 4 (Create Mission) has been completed */
  missionCreated: boolean;
  /** Whether Step 6 (Run Audit) has been completed */
  auditDone: boolean;
  /** Whether Step 7 (Record Learning) has been completed */
  learningRecorded: boolean;
  /** The highest completed step number (0 = none, 5 = all tracked steps done) */
  currentStep: ProtocolStepNumber | 0;
  /** Timestamp of last DNA selection */
  lastSelectDna: Date | null;
  /** Timestamp of last truth resolution */
  lastResolveTruth: Date | null;
  /** Timestamp of last mission creation */
  lastCreateMission: Date | null;
  /** Timestamp of last audit run */
  lastRunAudit: Date | null;
  /** Timestamp of last learning recording */
  lastRecordLearning: Date | null;
  /** When this tracker was created */
  createdAt: Date;
}

/** Validation result returned by protocol gate methods */
export interface ProtocolValidation {
  /** Whether the validation passed */
  valid: boolean;
  /** List of missing steps (by name) */
  missing: string[];
  /** Human-readable message */
  message: string;
}

/** Order violation detected in the protocol sequence */
export interface OrderViolation {
  /** Step that was violated */
  step: string;
  /** What should have been done first */
  expected: string;
  /** What was attempted */
  attempted: string;
}

/** Detailed status for the bos_validate_protocol tool */
export interface ProtocolStatus {
  /** Overall validity */
  valid: boolean;
  /** Current step number (1-5) */
  currentStep: number;
  /** Next step that should be taken */
  nextRequiredStep: string;
  /** List of completed step names */
  stepsCompleted: string[];
  /** List of missing step names */
  stepsMissing: string[];
  /** Any order violations detected */
  orderViolations: OrderViolation[];
  /** Timestamps for each completed step */
  lastActionTimestamps: { step: string; timestamp: string }[];
}

/**
 * Tracks the state of the BehaviorOS 7-Step Delegation Protocol.
 *
 * This tracker is a singleton-like state machine that records each protocol step
 * as it is completed and provides validation gates to enforce correct sequencing.
 */
export class ProtocolStateTracker {
  private state: ProtocolState;

  constructor() {
    this.state = this.createInitialState();
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private createInitialState(): ProtocolState {
    return {
      dnaSelected: false,
      truthResolved: false,
      missionCreated: false,
      auditDone: false,
      learningRecorded: false,
      currentStep: 0,
      lastSelectDna: null,
      lastResolveTruth: null,
      lastCreateMission: null,
      lastRunAudit: null,
      lastRecordLearning: null,
      createdAt: new Date(),
    };
  }

  private recalcCurrentStep(): void {
    if (this.state.learningRecorded) {
      this.state.currentStep = PROTOCOL_STEPS.LEARNING_RECORDED;
    } else if (this.state.auditDone) {
      this.state.currentStep = PROTOCOL_STEPS.AUDIT_DONE;
    } else if (this.state.missionCreated) {
      this.state.currentStep = PROTOCOL_STEPS.MISSION_CREATED;
    } else if (this.state.truthResolved) {
      this.state.currentStep = PROTOCOL_STEPS.TRUTH_RESOLVED;
    } else if (this.state.dnaSelected) {
      this.state.currentStep = PROTOCOL_STEPS.DNA_SELECTED;
    } else {
      this.state.currentStep = 0;
    }
  }

  private getCompletedSteps(): string[] {
    const completed: string[] = [];
    if (this.state.dnaSelected) {
      completed.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.DNA_SELECTED]);
    }
    if (this.state.truthResolved) {
      completed.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.TRUTH_RESOLVED]);
    }
    if (this.state.missionCreated) {
      completed.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.MISSION_CREATED]);
    }
    if (this.state.auditDone) {
      completed.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.AUDIT_DONE]);
    }
    if (this.state.learningRecorded) {
      completed.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.LEARNING_RECORDED]);
    }
    return completed;
  }

  private getMissingSteps(): string[] {
    const missing: string[] = [];
    if (!this.state.dnaSelected) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.DNA_SELECTED]);
    }
    if (!this.state.truthResolved) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.TRUTH_RESOLVED]);
    }
    if (!this.state.missionCreated) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.MISSION_CREATED]);
    }
    if (!this.state.auditDone) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.AUDIT_DONE]);
    }
    if (!this.state.learningRecorded) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.LEARNING_RECORDED]);
    }
    return missing;
  }

  private detectOrderViolations(): OrderViolation[] {
    const violations: OrderViolation[] = [];

    // Step 1 must come before Step 3
    if (this.state.truthResolved && !this.state.dnaSelected) {
      violations.push({
        step: 'Resolve Truth',
        expected: 'Select DNA first',
        attempted: 'Resolve Truth before selecting DNA',
      });
    }

    // Step 3 must come before Step 4
    if (this.state.missionCreated && !this.state.truthResolved) {
      violations.push({
        step: 'Create Mission',
        expected: 'Resolve Truth first',
        attempted: 'Create Mission before resolving truth',
      });
    }

    // Steps 1+3+4 must come before Step 6
    if (
      this.state.auditDone &&
      (!this.state.dnaSelected || !this.state.truthResolved || !this.state.missionCreated)
    ) {
      const missing = [];
      if (!this.state.dnaSelected) missing.push('Select DNA');
      if (!this.state.truthResolved) missing.push('Resolve Truth');
      if (!this.state.missionCreated) missing.push('Create Mission');
      violations.push({
        step: 'Run Audit',
        expected: `${missing.join(', ')} first`,
        attempted: 'Run Audit before completing prerequisite steps',
      });
    }

    // Step 6 must come before Step 7
    if (this.state.learningRecorded && !this.state.auditDone) {
      violations.push({
        step: 'Record Learning',
        expected: 'Run Audit first',
        attempted: 'Record Learning before running audit',
      });
    }

    return violations;
  }

  // ─── Step Markers ──────────────────────────────────────────────

  /** Mark Step 1 (Select DNA) as completed */
  markDnaSelected(): void {
    this.state.dnaSelected = true;
    this.state.lastSelectDna = new Date();
    this.recalcCurrentStep();
  }

  /** Mark Step 3 (Resolve Truth) as completed */
  markTruthResolved(): void {
    this.state.truthResolved = true;
    this.state.lastResolveTruth = new Date();
    this.recalcCurrentStep();
  }

  /** Mark Step 4 (Create Mission) as completed */
  markMissionCreated(): void {
    this.state.missionCreated = true;
    this.state.lastCreateMission = new Date();
    this.recalcCurrentStep();
  }

  /** Mark Step 6 (Run Audit) as completed */
  markAuditDone(): void {
    this.state.auditDone = true;
    this.state.lastRunAudit = new Date();
    this.recalcCurrentStep();
  }

  /** Mark Step 7 (Record Learning) as completed */
  markLearningRecorded(): void {
    this.state.learningRecorded = true;
    this.state.lastRecordLearning = new Date();
    this.recalcCurrentStep();
  }

  // ─── Validation Gates ──────────────────────────────────────────

  /**
   * Validate before any action tool execution (non-delegation tools).
   * Required: Step 1 (Select DNA) must be complete.
   * Per PROTOCOL.md: "Step 1 skipped → MCP blocks ALL action tools"
   */
  validateBeforeAction(): ProtocolValidation {
    const missing: string[] = [];

    if (!this.state.dnaSelected) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.DNA_SELECTED]);
    }

    if (missing.length > 0) {
      return {
        valid: false,
        missing,
        message:
          'Delegation enforcement failed: bos_select_dna must be called before any action tool. ' +
          `Required actions: ${missing.join(', ')}`,
      };
    }

    return {
      valid: true,
      missing: [],
      message: 'Protocol validation passed for action execution.',
    };
  }

  /**
   * Validate before delegation.
   * Required: Step 1 (Select DNA), Step 3 (Resolve Truth), Step 4 (Create Mission).
   * Per PROTOCOL.md: "Step 3 skipped → Delegation is blocked"
   */
  validateBeforeDelegation(): ProtocolValidation {
    const missing: string[] = [];

    if (!this.state.dnaSelected) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.DNA_SELECTED]);
    }
    if (!this.state.truthResolved) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.TRUTH_RESOLVED]);
    }
    if (!this.state.missionCreated) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.MISSION_CREATED]);
    }

    if (missing.length > 0) {
      return {
        valid: false,
        missing,
        message:
          'Delegation enforcement failed: prerequisite protocol steps must be completed before delegation. ' +
          `Missing: ${missing.join(', ')}`,
      };
    }

    return {
      valid: true,
      missing: [],
      message: 'Protocol validation passed for delegation.',
    };
  }

  /**
   * Validate before running audit.
   * Required: Steps 1, 3, 4.
   */
  validateBeforeAudit(): ProtocolValidation {
    const missing: string[] = [];

    if (!this.state.dnaSelected) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.DNA_SELECTED]);
    }
    if (!this.state.truthResolved) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.TRUTH_RESOLVED]);
    }
    if (!this.state.missionCreated) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.MISSION_CREATED]);
    }

    if (missing.length > 0) {
      return {
        valid: false,
        missing,
        message:
          'Cannot run audit: prerequisite protocol steps must be completed first. ' +
          `Missing: ${missing.join(', ')}`,
      };
    }

    return {
      valid: true,
      missing: [],
      message: 'Protocol validation passed for audit.',
    };
  }

  /**
   * Validate before marking a mission as completed.
   * Required: Steps 1, 3, 4, 6.
   * Per PROTOCOL.md: "Step 6 skipped → Mission cannot be marked completed"
   */
  validateBeforeComplete(): ProtocolValidation {
    const missing: string[] = [];

    if (!this.state.dnaSelected) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.DNA_SELECTED]);
    }
    if (!this.state.truthResolved) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.TRUTH_RESOLVED]);
    }
    if (!this.state.missionCreated) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.MISSION_CREATED]);
    }
    if (!this.state.auditDone) {
      missing.push(PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.AUDIT_DONE]);
    }

    if (missing.length > 0) {
      return {
        valid: false,
        missing,
        message:
          'Cannot update progress to completed: prerequisite protocol steps must be completed first. ' +
          `Missing: ${missing.join(', ')}`,
      };
    }

    return {
      valid: true,
      missing: [],
      message: 'Protocol validation passed for mission completion.',
    };
  }

  // ─── Query Methods ─────────────────────────────────────────────

  /** Get the name of the next step that should be taken */
  getNextRequiredStep(): string {
    if (!this.state.dnaSelected) {
      return `Step 1: ${PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.DNA_SELECTED]} (${PROTOCOL_STEP_TOOLS[PROTOCOL_STEPS.DNA_SELECTED]})`;
    }
    if (!this.state.truthResolved) {
      return `Step 3: ${PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.TRUTH_RESOLVED]} (${PROTOCOL_STEP_TOOLS[PROTOCOL_STEPS.TRUTH_RESOLVED]})`;
    }
    if (!this.state.missionCreated) {
      return `Step 4: ${PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.MISSION_CREATED]} (${PROTOCOL_STEP_TOOLS[PROTOCOL_STEPS.MISSION_CREATED]})`;
    }
    if (!this.state.auditDone) {
      return `Step 6: ${PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.AUDIT_DONE]} (${PROTOCOL_STEP_TOOLS[PROTOCOL_STEPS.AUDIT_DONE]})`;
    }
    if (!this.state.learningRecorded) {
      return `Step 7: ${PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.LEARNING_RECORDED]} (${PROTOCOL_STEP_TOOLS[PROTOCOL_STEPS.LEARNING_RECORDED]})`;
    }
    return 'All protocol steps completed.';
  }

  /** Get a detailed status snapshot for the protocol validation tool */
  getStatus(): ProtocolStatus {
    const completed = this.getCompletedSteps();
    const missing = this.getMissingSteps();
    const violations = this.detectOrderViolations();
    const timestamps: { step: string; timestamp: string }[] = [];

    if (this.state.lastSelectDna) {
      timestamps.push({ step: 'Select DNA', timestamp: this.state.lastSelectDna.toISOString() });
    }
    if (this.state.lastResolveTruth) {
      timestamps.push({
        step: 'Resolve Truth',
        timestamp: this.state.lastResolveTruth.toISOString(),
      });
    }
    if (this.state.lastCreateMission) {
      timestamps.push({
        step: 'Create Mission',
        timestamp: this.state.lastCreateMission.toISOString(),
      });
    }
    if (this.state.lastRunAudit) {
      timestamps.push({ step: 'Run Audit', timestamp: this.state.lastRunAudit.toISOString() });
    }
    if (this.state.lastRecordLearning) {
      timestamps.push({
        step: 'Record Learning',
        timestamp: this.state.lastRecordLearning.toISOString(),
      });
    }

    return {
      valid: violations.length === 0 && missing.length === 0,
      currentStep: this.state.currentStep,
      nextRequiredStep: this.getNextRequiredStep(),
      stepsCompleted: completed,
      stepsMissing: missing,
      orderViolations: violations,
      lastActionTimestamps: timestamps,
    };
  }

  /** Get the raw protocol state */
  getState(): ProtocolState {
    return { ...this.state };
  }

  /** Get the current step number (0 = none) */
  getCurrentStep(): ProtocolStepNumber | 0 {
    return this.state.currentStep;
  }

  /** Check if Step 1 is complete */
  isDnaSelected(): boolean {
    return this.state.dnaSelected;
  }

  /** Check if Step 3 is complete */
  isTruthResolved(): boolean {
    return this.state.truthResolved;
  }

  /** Check if Step 4 is complete */
  isMissionCreated(): boolean {
    return this.state.missionCreated;
  }

  /** Check if Step 6 is complete */
  isAuditDone(): boolean {
    return this.state.auditDone;
  }

  /** Check if Step 7 is complete */
  isLearningRecorded(): boolean {
    return this.state.learningRecorded;
  }

  /** Reset the tracker to initial state (all steps incomplete) */
  reset(): void {
    this.state = this.createInitialState();
  }
}
