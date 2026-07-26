import crypto from 'node:crypto';

/**
 * EscalationReason — Type alias for escalationreason.
 */
export type EscalationReason =
  | 'security'
  | 'payment'
  | 'production'
  | 'breaking-change'
  | 'critical-error';

/**
 * Escalation — Configuration and options interface.
 */
export interface Escalation {
  id: string;
  reason: EscalationReason;
  description: string;
  context: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'timed-out';
  createdAt: string;
  resolvedAt?: string;
  timeout: number;
}

/**
 * EscalationManager — escalation manager.
 *
 * Methods: escalate, approve, reject, get, list, autoEscalate.
 */
export class EscalationManager {
  private escalations = new Map<string, Escalation>();

  escalate(
    reason: EscalationReason,
    description: string,
    context?: Record<string, unknown>,
    timeout?: number,
  ): string {
    const id = crypto.randomUUID();
    const escalation: Escalation = {
      id,
      reason,
      description,
      context: context ?? {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      timeout: timeout ?? 300_000,
    };
    this.escalations.set(id, escalation);
    return id;
  }

  approve(id: string): void {
    const e = this.escalations.get(id);
    if (!e) throw new Error(`Escalation ${id} not found`);
    e.status = 'approved';
    e.resolvedAt = new Date().toISOString();
  }

  reject(id: string): void {
    const e = this.escalations.get(id);
    if (!e) throw new Error(`Escalation ${id} not found`);
    e.status = 'rejected';
    e.resolvedAt = new Date().toISOString();
  }

  get(id: string): Escalation | undefined {
    return this.escalations.get(id);
  }

  list(status?: string): Escalation[] {
    const all = Array.from(this.escalations.values());
    if (!status) return all;
    return all.filter((e) => e.status === status);
  }

  autoEscalate(): void {
    const now = Date.now();
    for (const e of this.escalations.values()) {
      if (e.status === 'pending') {
        const createdAt = new Date(e.createdAt).getTime();
        if (now - createdAt > e.timeout) {
          e.status = 'timed-out';
          e.resolvedAt = new Date().toISOString();
        }
      }
    }
  }
}
