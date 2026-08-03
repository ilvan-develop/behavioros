import type { GovernanceRule, Mission } from '@behavioros/schemas';

/**
 * GovernanceTelemetryEngine — opt-in, aggregate-only governance metrics.
 *
 * Deliberately narrow by design: it subscribes to BehaviorOSEngine's existing
 * `governance:violation` / `governance:approved` / `mission:completed` / `mission:failed`
 * events and records only counters keyed by rule id/level/action and agent id/role —
 * never free-text fields (mission title/description, governance context payloads,
 * file paths). The summary this produces is safe to export off-machine; nothing else
 * from this engine is. See docs/TELEMETRY.md for the exact schema and the opt-in flow.
 */

export interface TelemetryConfig {
  /** Telemetry is entirely inert unless explicitly enabled. Default: false. */
  enabled: boolean;
  /**
   * Optional webhook URL to push summaries to (bring-your-own-endpoint — BehaviorOS
   * does not host a collector). If unset, the summary is only available locally via
   * getSummary() / the bos-telemetry-summary MCP tool.
   */
  webhookUrl?: string;
  /** How often to push to webhookUrl, in ms. Default: 15 minutes. Ignored if no webhookUrl. */
  exportIntervalMs?: number;
}

export interface RuleCounter {
  ruleId: string;
  ruleName: string;
  level: GovernanceRule['level'];
  action: GovernanceRule['action'];
  count: number;
}

export interface AgentCounter {
  agentId: string;
  violationsTriggered: number;
  missionsCompleted: number;
  missionsFailed: number;
}

export interface GovernanceTelemetrySummary {
  generatedAt: string;
  /** ISO timestamp of the first event recorded in this process (for rate calculations). */
  windowStart: string;
  violationsBlocked: RuleCounter[];
  violationsApproved: RuleCounter[];
  byAgent: AgentCounter[];
  missionsCompleted: number;
  missionsFailed: number;
  /** missionsCompleted / (missionsCompleted + missionsFailed), or null if no missions yet. */
  agentEfficiency: number | null;
}

type WebhookSender = (payload: GovernanceTelemetrySummary) => Promise<void>;

export class GovernanceTelemetryEngine {
  private config: TelemetryConfig;
  private windowStart = new Date().toISOString();
  private ruleCounters = new Map<string, RuleCounter>();
  private approvedCounters = new Map<string, RuleCounter>();
  private agentCounters = new Map<string, AgentCounter>();
  private missionsCompleted = 0;
  private missionsFailed = 0;
  private exportTimer?: ReturnType<typeof setInterval>;
  private sendWebhook?: WebhookSender;

  constructor(config?: Partial<TelemetryConfig>, sendWebhook?: WebhookSender) {
    this.config = { enabled: false, ...config };
    this.sendWebhook = sendWebhook;

    if (this.config.enabled && this.config.webhookUrl && this.sendWebhook) {
      const interval = this.config.exportIntervalMs ?? 15 * 60 * 1000;
      this.exportTimer = setInterval(() => {
        this.exportNow().catch(() => {
          // Export failures must never crash the host process; the summary
          // stays available locally regardless.
        });
      }, interval);
      this.exportTimer.unref?.();
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Extract only the known-safe identifying fields from an unknown governance context. */
  private safeAgentId(context: unknown): string {
    if (context && typeof context === 'object' && 'agentId' in context) {
      const id = (context as Record<string, unknown>).agentId;
      if (typeof id === 'string' && id.length > 0) return id;
    }
    return 'unknown';
  }

  private bumpRuleCounter(map: Map<string, RuleCounter>, rule: GovernanceRule): void {
    if (!this.config.enabled) return;
    const existing = map.get(rule.id);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(rule.id, { ruleId: rule.id, ruleName: rule.name, level: rule.level, action: rule.action, count: 1 });
    }
  }

  private getOrCreateAgentCounter(agentId: string): AgentCounter {
    let counter = this.agentCounters.get(agentId);
    if (!counter) {
      counter = { agentId, violationsTriggered: 0, missionsCompleted: 0, missionsFailed: 0 };
      this.agentCounters.set(agentId, counter);
    }
    return counter;
  }

  /** Wire this into BehaviorOSEngine's 'governance:violation' event. */
  onGovernanceViolation(rule: GovernanceRule, context: unknown): void {
    if (!this.config.enabled) return;
    this.bumpRuleCounter(this.ruleCounters, rule);
    this.getOrCreateAgentCounter(this.safeAgentId(context)).violationsTriggered += 1;
  }

  /** Wire this into BehaviorOSEngine's 'governance:approved' event. */
  onGovernanceApproved(rule: GovernanceRule, _context: unknown): void {
    if (!this.config.enabled) return;
    this.bumpRuleCounter(this.approvedCounters, rule);
  }

  /** Wire this into BehaviorOSEngine's 'mission:completed' event. */
  onMissionCompleted(mission: Mission): void {
    if (!this.config.enabled) return;
    this.missionsCompleted += 1;
    for (const agentId of mission.assignees ?? []) {
      this.getOrCreateAgentCounter(agentId).missionsCompleted += 1;
    }
  }

  /** Wire this into BehaviorOSEngine's 'mission:failed' event. */
  onMissionFailed(mission: Mission, _error: Error): void {
    if (!this.config.enabled) return;
    this.missionsFailed += 1;
    for (const agentId of mission.assignees ?? []) {
      this.getOrCreateAgentCounter(agentId).missionsFailed += 1;
    }
  }

  /** Aggregate-only summary. Safe to log, display, or export — no free-text fields. */
  getSummary(): GovernanceTelemetrySummary {
    const total = this.missionsCompleted + this.missionsFailed;
    return {
      generatedAt: new Date().toISOString(),
      windowStart: this.windowStart,
      violationsBlocked: [...this.ruleCounters.values()],
      violationsApproved: [...this.approvedCounters.values()],
      byAgent: [...this.agentCounters.values()],
      missionsCompleted: this.missionsCompleted,
      missionsFailed: this.missionsFailed,
      agentEfficiency: total > 0 ? this.missionsCompleted / total : null,
    };
  }

  /** Push the current summary to the configured webhook, if enabled and configured. */
  async exportNow(): Promise<void> {
    if (!this.config.enabled || !this.config.webhookUrl || !this.sendWebhook) return;
    await this.sendWebhook(this.getSummary());
  }

  /** Stop the export interval timer, if running. Call on shutdown. */
  stop(): void {
    if (this.exportTimer) clearInterval(this.exportTimer);
  }
}
