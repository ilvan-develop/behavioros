/**
 * BehaviorOS HandoffProtocol — Manages contextual handoffs between agents.
 *
 * Handoff lifecycle:
 *   pending → accepted → in_progress → completed
 *   pending → rejected
 *
 * Each handoff carries full context (subtask, missionId, previous output)
 * so the receiving agent can continue without asking for context.
 *
 * Part of the AutonomousOrchestrator engine (Phase 2).
 */

import { randomUUID } from 'node:crypto';
import type { SubTask } from '@behavioros/schemas';

// ============================================================
// Types
// ============================================================

/**
 * HandoffStatus — Union type: pending, accepted, in_progress, completed, rejected;.
 */
export type HandoffStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected';

/**
 * HandoffContext — Configuration and options interface.
 */
export interface HandoffContext {
  subtask: SubTask;
  missionId: string;
  previousOutput?: unknown;
}

/**
 * HandoffRecord — Configuration and options interface.
 */
export interface HandoffRecord {
  handoffId: string;
  from: string;
  to: string;
  status: HandoffStatus;
  context: HandoffContext;
  rejectionReason?: {
    code: string;
    details: string;
    suggestion?: string;
  };
  output?: unknown;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

/**
 * HandoffRejectReason — Configuration and options interface.
 */
export interface HandoffRejectReason {
  code: string;
  details: string;
  suggestion?: string;
}

// ============================================================
// HandoffProtocol
// ============================================================

/**
 * HandoffProtocol — ============================================================.
 */
export class HandoffProtocol {
  private handoffs: Map<string, HandoffRecord> = new Map();
  private maxActiveHandoffs: number;

  constructor(maxActiveHandoffs: number = 50) {
    this.maxActiveHandoffs = maxActiveHandoffs;
  }

  /**
   * Request a handoff from one agent to another with full context.
   * The receiving agent can accept or reject.
   */
  async request(
    from: string,
    to: string,
    context: HandoffContext,
  ): Promise<{ handoffId: string; status: HandoffStatus }> {
    // Enforce max active handoffs
    const activeCount = this.getActiveCount();
    if (activeCount >= this.maxActiveHandoffs) {
      throw new Error(
        `Maximum active handoffs reached (${this.maxActiveHandoffs}). ` +
          'Complete or cancel some handoffs before requesting new ones.',
      );
    }

    const handoffId = randomUUID();
    const now = new Date().toISOString();

    const record: HandoffRecord = {
      handoffId,
      from,
      to,
      status: 'pending',
      context,
      createdAt: now,
    };

    this.handoffs.set(handoffId, record);

    return { handoffId, status: 'pending' };
  }

  /**
   * Accept a pending handoff — transitions to in_progress.
   */
  async accept(handoffId: string): Promise<void> {
    const record = this.handoffs.get(handoffId);
    if (!record) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }
    if (record.status !== 'pending') {
      throw new Error(`Cannot accept handoff in status: ${record.status}. Expected: pending`);
    }

    record.status = 'accepted';
    record.updatedAt = new Date().toISOString();

    // Auto-transition to in_progress after accept
    record.status = 'in_progress';
  }

  /**
   * Reject a pending handoff with a structured reason.
   */
  async reject(handoffId: string, reason: HandoffRejectReason): Promise<void> {
    const record = this.handoffs.get(handoffId);
    if (!record) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }
    if (record.status !== 'pending') {
      throw new Error(`Cannot reject handoff in status: ${record.status}. Expected: pending`);
    }

    record.status = 'rejected';
    record.rejectionReason = reason;
    record.updatedAt = new Date().toISOString();
  }

  /**
   * Mark a handoff as completed with the output from the receiving agent.
   */
  async complete(handoffId: string, output: unknown): Promise<void> {
    const record = this.handoffs.get(handoffId);
    if (!record) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }
    if (record.status !== 'in_progress' && record.status !== 'accepted') {
      throw new Error(
        `Cannot complete handoff in status: ${record.status}. Expected: in_progress or accepted`,
      );
    }

    record.status = 'completed';
    record.output = output;
    record.completedAt = new Date().toISOString();
    record.updatedAt = record.completedAt;
  }

  /**
   * Get the current status of a handoff.
   */
  async status(handoffId: string): Promise<HandoffRecord> {
    const record = this.handoffs.get(handoffId);
    if (!record) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }
    return { ...record };
  }

  /**
   * List all active (pending, accepted, in_progress) handoffs.
   */
  async listActive(): Promise<HandoffRecord[]> {
    const active: HandoffRecord[] = [];
    for (const record of this.handoffs.values()) {
      if (
        record.status === 'pending' ||
        record.status === 'accepted' ||
        record.status === 'in_progress'
      ) {
        active.push({ ...record });
      }
    }
    return active;
  }

  /**
   * List all handoffs for a specific agent (sent or received).
   */
  async listForAgent(agentId: string): Promise<HandoffRecord[]> {
    const records: HandoffRecord[] = [];
    for (const record of this.handoffs.values()) {
      if (record.from === agentId || record.to === agentId) {
        records.push({ ...record });
      }
    }
    return records;
  }

  /**
   * Get a handoff by ID (full record).
   */
  async get(handoffId: string): Promise<HandoffRecord | null> {
    const record = this.handoffs.get(handoffId);
    return record ? { ...record } : null;
  }

  /**
   * Get all handoffs (for reporting).
   */
  async getAll(): Promise<HandoffRecord[]> {
    return Array.from(this.handoffs.values()).map((r) => ({ ...r }));
  }

  /**
   * Count handoffs by status.
   */
  async countByStatus(): Promise<Record<HandoffStatus, number>> {
    const counts: Record<HandoffStatus, number> = {
      pending: 0,
      accepted: 0,
      in_progress: 0,
      completed: 0,
      rejected: 0,
    };

    for (const record of this.handoffs.values()) {
      counts[record.status]++;
    }

    return counts;
  }

  /**
   * Check if a handoff exists.
   */
  async exists(handoffId: string): Promise<boolean> {
    return this.handoffs.has(handoffId);
  }

  // ─── Private Helpers ───────────────────────────────────────

  /**
   * Count the number of active (non-terminal) handoffs.
   */
  private getActiveCount(): number {
    let count = 0;
    for (const record of this.handoffs.values()) {
      if (record.status !== 'completed' && record.status !== 'rejected') {
        count++;
      }
    }
    return count;
  }
}
