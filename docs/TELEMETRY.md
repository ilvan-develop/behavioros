# Governance Telemetry (Opt-in)

BehaviorOS can collect **aggregate-only** governance metrics — violations blocked/approved by rule, per-agent mission/violation counts, and an overall agent-efficiency ratio. This is entirely opt-in and off by default: unless you explicitly enable it, nothing is recorded, and nothing ever leaves your machine.

## What this is NOT

- Not enabled by default. `BehaviorOSEngineConfig.telemetry.enabled` defaults to `false`.
- Not a hosted service. BehaviorOS does not run or offer a telemetry collector. If you configure a webhook URL, it's yours — bring-your-own-endpoint.
- Not raw event capture. Mission titles, descriptions, governance rule `description` fields, file paths, and any other free-text context are never included in the summary. See `packages/core/src/engines/telemetry/__tests__/governance-telemetry.test.ts` for the test that asserts this directly.

## What gets recorded, if enabled

Only these fields, aggregated as counters (`GovernanceTelemetrySummary`, in `@behavioros/core`):

```typescript
{
  generatedAt: string;       // ISO timestamp
  windowStart: string;       // when this process started counting
  violationsBlocked: [{ ruleId, ruleName, level, action, count }],
  violationsApproved: [{ ruleId, ruleName, level, action, count }],
  byAgent: [{ agentId, violationsTriggered, missionsCompleted, missionsFailed }],
  missionsCompleted: number,
  missionsFailed: number,
  agentEfficiency: number | null,  // missionsCompleted / (missionsCompleted + missionsFailed)
}
```

`ruleName` comes from your DNA's governance rule definitions (config you authored, e.g. `"Security Review Required"`) — not runtime data. `agentId` is whatever identifier you assign your agents (e.g. `"backend-agent"`), not a person's identity, unless you choose to name agents that way.

## Enabling it

```typescript
const bos = new BehaviorOS({
  dnaPath: './dnas/enterprise-governance.yaml',
  // telemetry config passes through to BehaviorOSEngineConfig.telemetry
})
```

If you run the packaged `@behavioros/mcp-server` binary (rather than embedding `BehaviorOSEngine` yourself), set these env vars instead — `createServer()` reads them at startup:

```bash
BEHAVIOROS_TELEMETRY_ENABLED=true
BEHAVIOROS_TELEMETRY_WEBHOOK_URL=https://your-collector.example.com/hook   # optional
BEHAVIOROS_TELEMETRY_INTERVAL_MS=900000                                    # optional, default 15 min
```

or directly against the engine config:

```typescript
new BehaviorOSEngine({
  dna,
  telemetry: {
    enabled: true,                 // required — off by default
    webhookUrl: undefined,         // optional; see below
    exportIntervalMs: 15 * 60_000, // optional, default 15 min; ignored without webhookUrl
  },
})
```

With `enabled: true` and no `webhookUrl`, nothing leaves the process — the summary is only available locally:

```typescript
const summary = bos.getTelemetrySummary()
```

or via MCP: call the `bos-telemetry-summary` tool (read-only, no protocol steps required, and it never turns telemetry on by itself).

## Exporting it (bring-your-own-endpoint)

If you set `webhookUrl`, the summary is POSTed there on `exportIntervalMs`, reusing the existing `WebhookManager` (`packages/core/src/engines/integration/webhook-manager.ts`) — the same delivery mechanism BehaviorOS uses for other event notifications, with retry on failure. BehaviorOS does not host, proxy, or see this data — point it at your own collector (a Grafana webhook receiver, a Slack incoming webhook, an internal API, whatever consumes JSON over HTTP POST).

Export failures are swallowed (never crash the host process) and the local summary remains available regardless of whether export succeeds.

## Design rationale

The aggregation logic listens to events `BehaviorOSEngine` already emits (`governance:violation`, `governance:approved`, `mission:completed`, `mission:failed`) — no new instrumentation was added to the governance/mission code paths themselves. When extracting agent identity from a governance context, only a known-safe `agentId` string field is read; everything else in the context object is ignored, specifically so that a context payload containing a task description, a file path, or anything else free-text can never end up in the exported summary, even by accident.
