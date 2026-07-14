/**
 * BOS Escalation Manager — monitors triggers and manages escalation lifecycle.
 */

export interface EscalationTrigger {
  id: string;
  condition: string;
  action: string;
  timeout: string;
  retry: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface EscalationEvent {
  triggerId: string;
  timestamp: string;
  agent?: string;
  context: Record<string, unknown>;
  action: string;
  status: 'triggered' | 'in_progress' | 'resolved' | 'failed';
  retries: number;
}

export interface GovernanceRule {
  id: string;
  name?: string;
  description?: string;
  level: 'critical' | 'high' | 'medium' | 'low';
  action: 'block' | 'warn' | 'log' | 'escalate' | 'auto_approve';
  conditions?: string[];
}

export class EscalationManager {
  private triggers: EscalationTrigger[];
  private events: EscalationEvent[] = [];

  constructor(triggers?: EscalationTrigger[]) {
    this.triggers = triggers ?? [
      {
        id: 'security-vuln',
        condition: 'security vulnerability',
        action: 'halt_all_activate_immune',
        timeout: 'immediate',
        retry: 0,
        severity: 'critical',
      },
      {
        id: 'production-incident',
        condition: 'production incident',
        action: 'immediate_surgical_team',
        timeout: 'immediate',
        retry: 0,
        severity: 'critical',
      },
      {
        id: 'schema-migration',
        condition: 'schema migration',
        action: 'halt_and_review',
        timeout: '5min',
        retry: 1,
        severity: 'high',
      },
      {
        id: 'breaking-change',
        condition: 'breaking change',
        action: 'halt_and_notify_architect',
        timeout: '5min',
        retry: 1,
        severity: 'high',
      },
      {
        id: 'payment-failure',
        condition: 'payment_failure',
        action: 'immediate_surgical_team',
        timeout: 'immediate',
        retry: 0,
        severity: 'critical',
      },
      {
        id: 'compliance-violation',
        condition: 'compliance_violation',
        action: 'halt_and_activate_governance',
        timeout: 'immediate',
        retry: 0,
        severity: 'critical',
      },
      {
        id: 'perf-regression',
        condition: 'performance_regression',
        action: 'halt_and_activate_mathematical_swarm',
        timeout: '5min',
        retry: 1,
        severity: 'high',
      },
      {
        id: 'coverage-drop',
        condition: 'test_coverage_drop',
        action: 'spawn_testing_agent',
        timeout: 'immediate',
        retry: 2,
        severity: 'medium',
      },
    ];
  }

  /**
   * Load governance rules as escalation triggers.
   * Only 'escalate' and 'block' actions become triggers.
   */
  loadGovernanceRules(rules: GovernanceRule[]): void {
    for (const rule of rules) {
      if (rule.action !== 'escalate' && rule.action !== 'block') continue;

      const conditions = rule.conditions ?? [];
      for (const condition of conditions) {
        // Parse "type:security" -> "security"
        const conditionValue = condition.replace('type:', '');

        this.triggers.push({
          id: rule.id,
          condition: conditionValue,
          action: rule.action === 'block' ? 'halt_and_review' : 'escalate_to_human',
          timeout: rule.level === 'critical' ? 'immediate' : '5min',
          retry: rule.level === 'critical' ? 0 : 1,
          severity: rule.level as EscalationTrigger['severity'],
        });
      }
    }
  }

  check(event: {
    type: string;
    agent?: string;
    context?: Record<string, unknown>;
  }): EscalationEvent | null {
    // Also check context.type for governance-style matching
    const contextType = event.context?.type as string | undefined;

    const matchingTrigger = this.triggers.find(
      (t) =>
        event.type.includes(t.condition) ||
        t.condition.includes(event.type) ||
        (contextType !== undefined &&
          (contextType.includes(t.condition) || t.condition.includes(contextType))),
    );

    if (!matchingTrigger) return null;

    const escalationEvent: EscalationEvent = {
      triggerId: matchingTrigger.id,
      timestamp: new Date().toISOString(),
      agent: event.agent,
      context: event.context ?? {},
      action: matchingTrigger.action,
      status: 'triggered',
      retries: 0,
    };

    this.events.push(escalationEvent);
    return escalationEvent;
  }

  resolve(triggerId: string): boolean {
    const event = this.events.find((e) => e.triggerId === triggerId && e.status !== 'resolved');
    if (!event) return false;
    event.status = 'resolved';
    return true;
  }

  retry(triggerId: string): boolean {
    const event = this.events.find(
      (e) => e.triggerId === triggerId && (e.status === 'triggered' || e.status === 'in_progress'),
    );
    if (!event) return false;

    const trigger = this.triggers.find((t) => t.id === event.triggerId);
    if (!trigger) return false;

    if (event.retries >= trigger.retry) {
      event.status = 'failed';
      return false;
    }

    event.retries++;
    event.status = 'in_progress';
    return true;
  }

  getActiveEscalations(): EscalationEvent[] {
    return this.events.filter((e) => e.status === 'triggered' || e.status === 'in_progress');
  }

  getEscalationHistory(): EscalationEvent[] {
    return [...this.events];
  }

  prune(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    const before = this.events.length;
    this.events = this.events.filter((e) => {
      if (e.status !== 'resolved' && e.status !== 'failed') return true;
      return new Date(e.timestamp).getTime() > cutoff;
    });
    return before - this.events.length;
  }
}
