# Event Mesh Specification

> **Version:** 0.1.0  
> **Status:** FUTURE ARCHITECTURE — not yet implemented  
> **Canonical Reference:** `docs/KERNEL_SPEC.md §14`  
> **Related Docs:** `docs/PLATFORM_SPEC.md`, `docs/ARCHITECTURE.md`  
> **Decision Record:** `docs/ADR/003-event-mesh.md` — 5-bus architecture approved  
> **Existing Foundation:** `packages/core/src/events/` — `event-types.ts`, `event-store.ts`, `event-replay.ts`

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [The 5 Buses](#the-5-buses)
4. [Message Format](#message-format)
5. [Event Router](#event-router)
6. [Channels](#channels)
7. [Subscription System](#subscription-system)
8. [Delivery Guarantees](#delivery-guarantees)
9. [Integration with EventStore](#integration-with-eventstore)
10. [Routing Rules](#routing-rules)
11. [Inter-Bus Communication](#inter-bus-communication)
12. [Appendix: Existing Event Types](#appendix-existing-event-types)

---

## Overview

The Event Mesh is the central nervous system of BehaviorOS. It enables **decoupled, asynchronous communication** between all engines, agents, and external integrations through 5 specialized buses.

### Goals

- **Decoupling** — Engines communicate through messages, never direct calls
- **Observability** — Every message is traceable through the existing EventStore
- **Resilience** — Buses degrade gracefully; message delivery is guaranteed
- **Scalability** — Multiple consumers can subscribe to the same channel
- **Auditability** — All messages are recorded for post-hoc analysis

### Current Foundation

The Event Mesh builds on the existing event sourcing infrastructure:

| Component | File | Status |
|-----------|------|--------|
| `EventStore` | `packages/core/src/events/event-store.ts` | ✅ Implemented (append-only, snapshots, persistence) |
| `EventReplay` | `packages/core/src/events/event-replay.ts` | ✅ Implemented (projection reducer) |
| `BehaviorOSEvent` | `packages/core/src/events/event-types.ts` | ✅ Implemented (9 aggregate types) |
| Event Mesh | This spec | ⬜ Not yet implemented |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Event Mesh                                │
│                                                                  │
│   ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│   │ Command  │  │  Query    │  │  Event   │  │ Notification │  │
│   │   Bus    │  │   Bus     │  │   Bus    │  │     Bus      │  │
│   │ (sync)   │  │ (sync)    │  │ (async)  │  │ (broadcast)  │  │
│   └────┬─────┘  └────┬──────┘  └────┬─────┘  └──────┬───────┘  │
│        │             │              │                │          │
│        └─────────────┴──────────────┴────────────────┘          │
│                            │                                     │
│                     ┌──────┴──────┐                              │
│                     │   Stream    │                              │
│                     │    Bus      │                              │
│                     │ (continuous)│                              │
│                     └─────────────┘                              │
│                                                                  │
│   ┌──────────────────────────────────────────────────────┐       │
│   │                  Event Router                         │       │
│   │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐  │       │
│   │  │ Channel │  │ Channel  │  │ Channel  │  │ ...  │  │       │
│   │  │  Mgr    │  │  Router  │  │ Filter   │  │      │  │       │
│   │  └─────────┘  └──────────┘  └──────────┘  └──────┘  │       │
│   └──────────────────────────────────────────────────────┘       │
│                                                                  │
│   ┌──────────────────────────────────────────────────────┐       │
│   │                 EventStore (persistence)               │       │
│   │  Append-only log → Snapshots → Replay                │       │
│   └──────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|-----------|---------------|
| **Command Bus** | Point-to-point synchronous commands (e.g., "create mission") |
| **Query Bus** | Request-response synchronous queries (e.g., "get agent status") |
| **Event Bus** | Async pub/sub domain events (e.g., "mission completed") |
| **Notification Bus** | Async broadcast notifications (e.g., "quality gate failed") |
| **Stream Bus** | Async continuous streaming (e.g., "audit log tail") |
| **Event Router** | Routes messages between buses, manages channels and subscriptions |
| **Channel** | Named communication pathway within a bus |
| **Subscription** | A consumer's registration to receive messages from a channel |
| **EventStore** | Persistent append-only log of all domain events |

---

## The 5 Buses

### 1. Command Bus

| Property | Value |
|----------|-------|
| **Pattern** | Point-to-point |
| **Delivery** | Exactly-once (with idempotency) |
| **Timeout** | 30s default |
| **Retry** | 3 attempts with exponential backoff |
| **Persistence** | Not persisted (fire-and-forget with result) |

**Purpose:** Execute side-effect-producing actions via the **Command pattern**. Each command targets exactly one handler. Point-to-point routing ensures a single consumer processes each command.

**Examples:**
- `createMission` — Create a new mission
- `evaluateGovernance` — Evaluate an action against rules
- `runAudit` — Execute audit pipeline
- `recordLearning` — Record a learning event

**Handler signature:**
```typescript
interface CommandHandler<TCommand, TResult> {
  handle(command: TCommand): Promise<TResult>;
}
```

### 2. Query Bus

| Property | Value |
|----------|-------|
| **Pattern** | Request-response |
| **Delivery** | At-most-once |
| **Timeout** | 10s default |
| **Caching** | Optional (TTL-based) |
| **Persistence** | Not persisted |

**Purpose:** Retrieve state without side effects. Queries operate against **read models** and **projections** built from the event stream. Queries are idempotent and cacheable.

**Examples:**
- `getMission` — Get mission by ID
- `listMissions` — List all missions with filters
- `getAgentStatus` — Get agent status
- `queryAuditLog` — Search audit events

**Handler signature:**
```typescript
interface QueryHandler<TQuery, TResult> {
  handle(query: TQuery): Promise<TResult>;
}
```

### 3. Event Bus

| Property | Value |
|----------|-------|
| **Pattern** | Pub/sub (fan-out) |
| **Delivery** | At-least-once |
| **Persistence** | Persisted in EventStore (append-only, immutable log) |
| **Replay** | Supported from snapshots |

**Purpose:** Broadcast **immutable domain events** that have occurred. Events are appended to an **append-only log** — they are never mutated or deleted. Multiple subscribers can react to the same event.

**Examples:**
- `mission.created` — A mission was created
- `mission.completed` — A mission was completed
- `governance.violation` — A governance rule was violated
- `quality.gate_failed` — A quality gate failed

**Event types map to the existing `AggregateType` from `event-types.ts`:**

| Aggregate Type | Event Examples |
|----------------|---------------|
| `mission` | `mission.created`, `mission.started`, `mission.completed`, `mission.failed` |
| `agent` | `agent.assigned`, `agent.status_changed` |
| `pipeline` | `pipeline.started`, `pipeline.completed`, `pipeline.layer_passed` |
| `governance` | `governance.evaluated`, `governance.violation`, `governance.escalated` |
| `quality` | `quality.gate_passed`, `quality.gate_failed` |
| `audit` | `audit.completed`, `audit.stage_passed` |
| `learning` | `learning.recorded`, `learning.insight_generated` |
| `dna` | `dna.loaded`, `dna.validated` |
| `skill` | `skill.resolved`, `skill.installed` |

### 4. Notification Bus

| Property | Value |
|----------|-------|
| **Pattern** | Broadcast / fan-out |
| **Delivery** | At-most-once (best effort) |
| **Persistence** | Not persisted (ephemeral) |

**Purpose:** Real-time alerts and notifications delivered via **broadcast** or **fan-out** to all subscribers. Supports **webhook** delivery for external integration.

**Examples:**
- `quality.gate_alert` — Quality gate approaching threshold
- `system.health_warning` — Engine health degraded
- `agent.status_change` — Agent went offline
- `pipeline.progress` — Pipeline progress update

### 5. Stream Bus

| Property | Value |
|----------|-------|
| **Pattern** | Continuous streaming, partitioned |
| **Delivery** | Ordered per partition |
| **Backpressure** | Supported via consumer lag detection |
| **Persistence** | Tailed from EventStore (replayable) |

**Purpose:** Long-lived **ordered streams** of events organized into **partitions** with **consumer groups** for load-balanced consumption. Supports **replay** from any point. Ideal for real-time dashboards, log tailing, and data export.

**Examples:**
- `audit.stream` — Live audit log tail
- `mission.stream` — Real-time mission updates
- `system.metrics` — Engine metrics stream

---

## Message Format

### Envelope (all buses)

```typescript
interface MessageEnvelope {
  /** Unique message ID (UUID v7) */
  id: string;

  /** Bus the message travels on */
  bus: 'command' | 'query' | 'event' | 'notification' | 'stream';

  /** Channel name within the bus */
  channel: string;

  /** Message type (e.g., 'mission.created') */
  type: string;

  /** Source component/engine */
  source: string;

  /** Target component (for point-to-point buses) */
  target?: string;

  /** Message payload */
  payload: unknown;

  /** Correlation ID for tracing across buses */
  correlationId?: string;

  /** Causation ID (previous message that caused this one) */
  causationId?: string;

  /** Timestamp (ISO 8601) */
  timestamp: string;

  /** Metadata for routing, tracing, debugging */
  metadata: Record<string, unknown>;
}
```

### Command Message

```typescript
interface CommandMessage<T = unknown> {
  envelope: MessageEnvelope & { bus: 'command' };
  payload: T;
  /** Expected result type for response routing */
  expectedResultType?: string;
}
```

### Query Message

```typescript
interface QueryMessage<T = unknown> {
  envelope: MessageEnvelope & { bus: 'query' };
  payload: T;
  /** Response channel for the reply */
  replyTo?: string;
}
```

### Event Message

```typescript
interface EventMessage<T = unknown> {
  envelope: MessageEnvelope & { bus: 'event' };
  payload: T;
  /** Event version for schema evolution */
  eventVersion: number;
  /** Aggregate this event belongs to */
  aggregateType: string;
  aggregateId: string;
}
```

### Notification Message

```typescript
interface NotificationMessage<T = unknown> {
  envelope: MessageEnvelope & { bus: 'notification' };
  payload: T;
  /** Severity level for UI display */
  severity: 'info' | 'warning' | 'error' | 'critical';
}
```

### Stream Message

```typescript
interface StreamMessage<T = unknown> {
  envelope: MessageEnvelope & { bus: 'stream' };
  payload: T;
  /** Partition key for ordered delivery */
  partitionKey: string;
  /** Sequence number within partition */
  sequenceNumber: number;
}
```

---

## Event Router

The Event Router is the central coordinator that:

1. Accepts messages from producers
2. Routes messages to the correct bus
3. Manages channel registrations
4. Delivers messages to subscribers
5. Persists events to the EventStore (when applicable)

### Interface

```typescript
interface EventRouter {
  /** Register a bus */
  registerBus(bus: BusDefinition): void;

  /** Register a channel on a bus */
  registerChannel(channel: ChannelDefinition): void;

  /** Publish a message to a bus/channel */
  publish<T>(message: MessageEnvelope): Promise<PublishResult>;

  /** Subscribe to a channel */
  subscribe<T>(subscription: Subscription): Promise<string>;

  /** Unsubscribe from a channel */
  unsubscribe(subscriptionId: string): Promise<void>;

  /** Get router health status */
  health(): RouterHealth;
}

interface PublishResult {
  messageId: string;
  deliveredTo: number;
  failedTo: number;
  persisted: boolean;
  timestamp: string;
}
```

### Router Behavior by Bus

| Bus | Router Behavior |
|-----|----------------|
| Command | Finds handler, invokes, returns result. Error → retry → fail |
| Query | Finds handler, invokes, returns result. Error → return error to caller |
| Event | Fans out to all subscribers, persists to EventStore |
| Notification | Broadcasts to all subscribers, no persistence |
| Stream | Appends to stream buffer, pushes to active consumers |

---

## Channels

### Definition

```typescript
interface ChannelDefinition {
  /** Channel name (unique per bus) */
  name: string;

  /** Bus this channel belongs to */
  bus: 'command' | 'query' | 'event' | 'notification' | 'stream';

  /** Optional description */
  description?: string;

  /** Schema for message validation (Zod) */
  schema?: string; // Zod schema name or path

  /** Retention policy for this channel */
  retention?: {
    maxMessages?: number;
    maxAge?: string; // e.g., '7d', '30d'
  };

  /** Security requirements */
  security?: {
    requiresAuth?: boolean;
    requiredAuthority?: string;
  };
}
```

### Standard Channels (Pre-defined)

#### Command Bus
| Channel | Description | Handler |
|---------|-------------|---------|
| `mission.command` | Mission lifecycle commands | MissionManager |
| `governance.command` | Governance evaluation | GovernanceEngine |
| `quality.command` | Quality gate execution | QualityEngine |
| `audit.command` | Audit pipeline commands | AuditEngine |
| `learning.command` | Learning event recording | LearningEngine |
| `pipeline.command` | Pipeline execution | PipelineEngine |
| `agent.command` | Agent management | AgentManager |

#### Query Bus
| Channel | Description | Handler |
|---------|-------------|---------|
| `mission.query` | Mission queries | MissionManager |
| `agent.query` | Agent queries | AgentManager |
| `governance.query` | Rule queries | GovernanceEngine |
| `quality.query` | Quality metric queries | QualityEngine |
| `audit.query` | Audit history queries | AuditEngine |
| `learning.query` | Learning queries | LearningEngine |
| `system.query` | System state queries | BehaviorOSEngine |

#### Event Bus
| Channel | Description | Published By |
|---------|-------------|--------------|
| `mission.event` | Domain events about missions | MissionEngine |
| `agent.event` | Domain events about agents | AgentManager |
| `governance.event` | Governance rule events | GovernanceEngine |
| `quality.event` | Quality gate events | QualityEngine |
| `audit.event` | Audit events | AuditEngine |
| `learning.event` | Learning events | LearningEngine |
| `pipeline.event` | Pipeline events | PipelineEngine |
| `system.event` | System-level events | BehaviorOSEngine |

#### Notification Bus
| Channel | Description |
|---------|-------------|
| `system.alert` | System health alerts |
| `governance.alert` | Governance violation alerts |
| `quality.alert` | Quality threshold warnings |
| `agent.alert` | Agent status changes |

#### Stream Bus
| Channel | Description |
|---------|-------------|
| `audit.stream` | Live audit events stream |
| `mission.stream` | Real-time mission updates |
| `system.metrics` | Metrics data stream |

---

## Subscription System

### Definition

```typescript
interface Subscription {
  /** Channel to subscribe to */
  channel: string;

  /** Consumer identifier */
  consumerId: string;

  /** Consumer group for load balancing */
  consumerGroup?: string;

  /** Message handler callback */
  handler: (message: MessageEnvelope) => Promise<MessageResult>;

  /** Optional filter predicate */
  filter?: (message: MessageEnvelope) => boolean;

  /** Subscription options */
  options?: {
    /** Buffer size for async consumers */
    bufferSize?: number;
    /** Concurrency limit */
    concurrency?: number;
    /** Auto-acknowledge on handler success */
    autoAck?: boolean;
  };
}

type MessageResult = {
  success: boolean;
  error?: string;
  /** For queries: the response payload */
  data?: unknown;
};
```

### Consumer Groups

Multiple subscribers with the same `consumerGroup` share the workload (competing consumers):

```
Channel: mission.event
  │
  ├── Consumer Group: audit-logger
  │     ├── instance-1 (receives mission.created)
  │     └── instance-2 (receives mission.completed)
  │
  └── Consumer Group: notification-sender
        └── instance-1 (receives ALL mission events)
```

### Delivery Semantics

| Bus | Delivery | Consumer Group |
|-----|----------|---------------|
| Command | Exactly one handler receives the command (exactly-once) | No (point-to-point) |
| Query | Exactly one handler processes the query | No (request-response) |
| Event | All subscribers receive the event (at-least-once) | Yes (competing consumers) |
| Notification | All subscribers receive the notification (best-effort) | Yes |
| Stream | One consumer per partition (ordered) | Yes (partition-based) |

---

## Delivery Guarantees

*Per ADR-003: Event Bus → at-least-once, Command Bus → exactly-once, Query Bus → at-most-once, Notification Bus → best-effort, Stream Bus → exactly-once per partition.*

| Level | Guarantee | Buses | Mechanism |
|-------|-----------|-------|-----------|
| **At-most-once** | Message delivered 0 or 1 times | Query, Notification | No retry, fire-and-forget |
| **At-least-once** | Message delivered 1+ times | Event | Retry with backoff, persistent store |
| **Exactly-once** | Message delivered exactly once | Command, Event (with dedup), Stream | Idempotency keys + dedup window, transactional outbox |

### Retry Policy

```typescript
interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  initialDelayMs: number;
  maxDelayMs: number;
  /** Which errors should trigger a retry */
  retryableErrors: string[];
}
```

**Default retry policies by bus:**

| Bus | Max Attempts | Strategy | Initial Delay |
|-----|-------------|----------|---------------|
| Command | 3 | Exponential | 200ms |
| Query | 1 | None | — |
| Event | 5 | Exponential | 100ms |
| Notification | 1 | None | — |
| Stream | ∞ (until success) | Exponential | 500ms |

### Exactly-Once Guarantee for Command Bus

The Command Bus achieves exactly-once delivery through:
1. **Idempotency keys** — Each command carries a unique idempotency key; duplicate deliveries are detected and dropped
2. **Transactional outbox** — Commands are written to an outbox table in the same transaction as the state change
3. **Deduplication window** — Duplicates within a configurable window (default: 5 minutes) are silently ignored

### Dead Letter Queue (DLQ)

Messages that exceed max retry attempts are moved to a DLQ:

```typescript
interface DeadLetterMessage {
  originalMessage: MessageEnvelope;
  error: string;
  attempts: number;
  lastAttempt: string;
  dlqReason: 'max_retries' | 'invalid_schema' | 'handler_not_found' | 'timeout';
}
```

DLQ channels:
- `system.dlq.command`
- `system.dlq.event`
- `system.dlq.stream`

---

## Integration with EventStore

The existing `EventStore` serves as the **persistence backend** for the Event Mesh:

```
Publisher → Event Router → Event Bus → EventStore.append()
                                    ↓
                              Subscribers ← EventStore.getEvents() (for replay)
```

### Write Path

1. Producer calls `router.publish(message)`
2. Router validates message schema
3. If `bus === 'event'`, router appends to EventStore
4. Router delivers message to all subscribers
5. Router returns `PublishResult` to producer

### Replay Path

1. Consumer subscribes with `replayFrom: 'latest' | 'beginning' | timestamp`
2. Router replays events from EventStore
3. Replayed events are sent to the consumer's handler
4. Consumer catches up to real-time stream

### Snapshot Integration

The EventStore's snapshot mechanism is leveraged for state recovery:

- Snapshot interval: every 100 events per aggregate
- Replay uses snapshot + subsequent events
- Bus routing state is snapshotted every 50 messages

---

## Routing Rules

### Automatic Bus Assignment

Messages can be assigned to a bus based on their type prefix:

| Type Prefix | Default Bus |
|-------------|-------------|
| `command.*` | Command Bus |
| `query.*` | Query Bus |
| `*` (domain events) | Event Bus |
| `notification.*` | Notification Bus |
| `stream.*` | Stream Bus |

### Inter-Bus Routing

The router supports chaining messages across buses:

```typescript
interface RoutingRule {
  /** Source pattern (type or channel) */
  source: string;
  /** Target bus */
  targetBus: 'command' | 'query' | 'event' | 'notification' | 'stream';
  /** Target channel */
  targetChannel: string;
  /** Optional payload transformation */
  transform?: (payload: unknown) => unknown;
}
```

**Example rules:**

| Source | Target Bus | Target Channel | Purpose |
|--------|------------|----------------|---------|
| `mission.event` → `mission.completed` | `notification` | `system.alert` | Alert when mission completes |
| `quality.event` → `quality.gate_failed` | `command` | `quality.command` | Retry quality gate on failure |
| `governance.event` → `governance.violation` | `notification` | `governance.alert` | Alert on governance violation |

---

## Inter-Bus Communication

### Command → Event

When a command succeeds, it may produce domain events:

```
Command: createMission
  → Handler: MissionManager
  → Success: { missionId, status }
  → Event: mission.created { missionId, title, type }
```

### Event → Command (Saga Pattern)

An event can trigger a follow-up command:

```
Event: mission.created
  → Subscriber: AgentAssigner
  → Command: assignAgentToMission { missionId, agentId }
  → Event: agent.assigned { agentId, missionId }
```

### Query → Event (Materialized View)

Queries can be served from materialized views built from events:

```
Event: mission.created
Event: mission.completed
  → Materialized View: missionStats { total, completed, active }
  → Query: getMissionStats → returns view
```

### Notification → Event (Alerting)

Notifications can be escalated to events for persistence:

```
Notification: quality.alert (ephemeral)
  → Routing Rule (if severity === 'critical')
  → Event: quality.gate_failed (persisted)
```

---

## Appendix: Existing Event Types

The Event Mesh should map to the existing types in `packages/core/src/events/event-types.ts`:

### BehaviorOSEvent (base)

```typescript
interface BehaviorOSEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: AggregateType; // 'mission' | 'agent' | 'pipeline' | ...
  timestamp: string;
  version: number;
  metadata: Record<string, unknown>;
  payload: unknown;
}
```

### Aggregate Types (9)

| Aggregate Type | Event Bus Channel | EventStore Mapping |
|----------------|-------------------|-------------------|
| `mission` | `mission.event` | `MissionEventType` → MissionCreatedPayload, etc. |
| `agent` | `agent.event` | Agent state change events |
| `pipeline` | `pipeline.event` | Pipeline execution events |
| `governance` | `governance.event` | Governance evaluation events |
| `quality` | `quality.event` | Quality gate events |
| `audit` | `audit.event` | Audit result events |
| `learning` | `learning.event` | Learning insight events |
| `dna` | `system.event` | DNA loading events |
| `skill` | `skill.event` | Skill resolution events |

### Connection: MCP Tools

The existing MCP event tools will route through the Event Mesh once implemented:

| MCP Tool | Current Implementation | Event Mesh Integration |
|----------|----------------------|----------------------|
| `bos-event-query` | Direct EventStore access | → Query Bus → `query.event` |
| `bos-event-stats` | Direct EventStore access | → Query Bus → `query.event` |
| `bos-event-replay` | Direct EventStore access | → Query Bus → `query.event` |
| `bos-system-health` | Engine health check | → Query Bus → `query.system` |

---

*This document describes the FUTURE ARCHITECTURE of the Event Mesh. The current implementation has the EventStore foundation plus MCP query tools. Implementation is planned for Phase 3 of the [ROADMAP](ROADMAP.md).*
