# BehaviorOS Cloud Infrastructure Specification

> **Version:** 1.0.0
> **Status:** Architecture Stabilization — Phase 1
> **Last Updated:** July 2026
> **Source of Truth:** `packages/cloud/`
> **Architecture Level:** Level 3 — Enterprise Services

---

## Overview

The Cloud infrastructure layer provides distributed systems primitives for multi-node BehaviorOS deployments: cluster coordination, leader election, distributed locking, cross-node event bus, shared memory, Kubernetes operator, Helm charts, auto-scaling, and service discovery.

### Architecture Position

```
Level 1: Kernel              ← Event Sourcing, CQRS, Contracts, Event Mesh
Level 2: Cognitive Platforms  ← Observability, Intelligence, Governance
Level 3: Enterprise Services  ← YOU ARE HERE — Cloud, Runtime, Integration
Level 4: Ecosystem            ← SDKs, CLI, MCP Server, Dashboard
```

---

## Core Interfaces

### NodeMetadata

```typescript
interface NodeMetadata {
  id: string
  host: string
  port: number
  role: 'leader' | 'follower' | 'candidate'
  version: string
  startedAt: number
  lastHeartbeat: number
  capabilities: string[]
  labels: Record<string, string>
}
```

### ClusterEvent

```typescript
interface ClusterEvent {
  id: string
  type: 'node_joined' | 'node_left' | 'leader_elected' | 'health_change'
  nodeId: string
  timestamp: number
  payload: Record<string, unknown>
}
```

---

## 1. KernelCluster

```typescript
interface KernelCluster {
  join(token?: string): Promise<void>
  leave(): Promise<void>
  getNodes(filter?: NodeFilter): Promise<NodeMetadata[]>
  getNode(id: string): Promise<NodeMetadata | undefined>
  sendHeartbeat(): Promise<void>
  onNodeJoin(callback: (node: NodeMetadata) => void): void
  onNodeLeave(callback: (nodeId: string) => void): void
  health(): Promise<ClusterHealth>
}
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| Heartbeat interval | 5s | Periodic health signal |
| Heartbeat timeout | 15s | Node considered dead after |
| Join timeout | 10s | Max time to join cluster |
| Discovery | `gossip` | Protocol: gossip, DNS, static |

Multi-node coordination with gossip-based membership (SWIM protocol). Heartbeat failure detection triggers `node_left` events and automatic rebalancing.

---

## 2. LeaderElection

```typescript
interface LeaderElection {
  campaign(): Promise<void>
  resign(): Promise<void>
  getLeader(): Promise<NodeMetadata | undefined>
  isLeader(): boolean
  onElection(callback: (leader: NodeMetadata) => void): void
  getCurrentTerm(): number
  voteFor(candidateId: string): Promise<boolean>
}
```

**Raft-style algorithm:**

```
Each node starts as Follower
  → Election timeout (150-300ms random)
  → Becomes Candidate
  → Requests votes from peers
  → Majority wins → becomes Leader
  → Leader sends heartbeats (AppendEntries)
  → Followers reset election timer
```

| Term | Description |
|------|-------------|
| Term `N` | Current election round |
| Vote | One vote per node per term |
| Majority | `floor(N/2) + 1` nodes required |

---

## 3. DistributedLock

```typescript
interface DistributedLock {
  acquire(name: string, ttlMs?: number): Promise<Lock>
  release(lock: Lock): Promise<void>
  isHeld(lock: Lock): Promise<boolean>
  extend(lock: Lock, ttlMs: number): Promise<void>
}

interface Lock {
  id: string
  name: string
  holder: string
  acquiredAt: number
  expiresAt: number
  reentrant: boolean
  reentrantCount?: number
}
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| TTL | 30s | Lock auto-expiration |
| Retry interval | 100ms | Spin interval on contention |
| Max retries | 50 | Give up after |
| Reentrant | `false` | Allow same holder to re-acquire |

Backend: Redis (SET NX PX) or Postgres (advisory locks or `pg_try_advisory_lock`). Auto-extend via background watchdog.

---

## 4. DistributedEventBus

```typescript
interface DistributedEventBus {
  publish(channel: string, event: ClusterEvent): Promise<void>
  subscribe(channel: string, handler: (event: ClusterEvent) => void): Promise<string>
  unsubscribe(subscriptionId: string): Promise<void>
  forward(remoteUrl: string, filter?: EventFilter): Promise<void>
  getChannels(): Promise<string[]>
}
```

Cross-node pub/sub extending the local Event Mesh. Messages are serialized as protobuf and forwarded via gRPC streams. Supports multi-region forwarding with configurable filters (by event type, node, severity).

| Channel | Purpose |
|---------|---------|
| `cluster.nodes` | Node lifecycle events |
| `cluster.election` | Leader election events |
| `cluster.health` | Health status changes |
| `cluster.custom` | Application-defined events |

---

## 5. DistributedMemory

```typescript
interface DistributedMemory {
  get(key: string): Promise<unknown | undefined>
  set(key: string, value: unknown, ttlMs?: number): Promise<void>
  delete(key: string): Promise<void>
  merge(key: string, value: unknown, strategy: MergeStrategy): Promise<void>
  clear(): Promise<void>
  keys(pattern?: string): Promise<string[]>
}

type MergeStrategy =
  | { type: 'last_write_wins' }
  | { type: 'counter_merge' }
  | { type: 'set_union' }
  | { type: 'custom'; fn: (a: unknown, b: unknown) => unknown }
```

Shared KV store with CRDT-inspired merge strategies. TTL-based expiration with lazy cleanup. Backend: Redis cluster or in-memory with gossip replication.

**Merge strategies by use case:**

| Use Case | Strategy |
|----------|----------|
| Config values | `last_write_wins` |
| Hit counters | `counter_merge` |
| Active node set | `set_union` |
| Work queues | `custom` (priority merge) |

---

## 6. K8sOperator

```typescript
interface K8sOperator {
  registerCRD(crd: CustomResourceDefinition): Promise<void>
  watch(kind: string, handler: WatchHandler): Promise<string>
  reconcile(resource: Resource): Promise<ReconcileResult>
  getResource(kind: string, name: string): Promise<Resource>
  listResources(kind: string): Promise<Resource[]>
  updateStatus(resource: Resource, status: unknown): Promise<void>
}
```

| CRD | Purpose |
|-----|---------|
| `BehaviorOSCluster` | Cluster topology and configuration |
| `BehaviorOSAgent` | Agent deployment and scaling |
| `BehaviorOSDNA` | DNA package distribution |
| `BehaviorOSAudit` | Audit pipeline configuration |

**Reconciliation loop:**
```
Watch resource changes → enqueue → reconcile → diff desired vs actual → apply changes → update status
```

---

## 7. HelmChart

```typescript
interface HelmChart {
  render(values: Record<string, unknown>): Promise<string>
  install(name: string, namespace: string, values?: Record<string, unknown>): Promise<InstallResult>
  upgrade(name: string, values?: Record<string, unknown>): Promise<InstallResult>
  uninstall(name: string): Promise<void>
  getValues(name: string): Promise<Record<string, unknown>>
  list(): Promise<ReleaseSummary[]>
}
```

**Chart structure:**
```
behavioros/
├── Chart.yaml          # name, version, dependencies
├── values.yaml         # default configuration
├── templates/
│   ├── cluster.yaml    # KernelCluster deployment
│   ├── agents.yaml     # Agent deployment (StatefulSet)
│   ├── config.yaml     # ConfigMap
│   ├── secrets.yaml    # Secrets template
│   └── hpa.yaml        # HorizontalPodAutoscaler
└── charts/             # dependency charts
```

**Dependencies:** `postgresql`, `redis`, `minio`, `prometheus`, `grafana`.

---

## 8. AutoScaler

```typescript
interface AutoScaler {
  setRules(rules: ScalingRule[]): Promise<void>
  getRules(): Promise<ScalingRule[]>
  getCurrentScale(): Promise<ScaleState>
  triggerScale(delta: number): Promise<ScaleResult>
  suggestScale(): Promise<ScaleSuggestion>
}

interface ScalingRule {
  metric: 'cpu' | 'memory' | 'queue_depth' | 'request_rate' | 'latency_p95'
  threshold: number
  operator: 'gt' | 'lt'
  scaleDelta: number
  cooldownSeconds: number
}
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| Min replicas | 1 | Minimum node count |
| Max replicas | 10 | Maximum node count |
| Scale up cooldown | 60s | Wait between scale-ups |
| Scale down cooldown | 120s | Wait between scale-downs |
| Stabilization window | 300s | Lookback for metric avg |

---

## 9. ServiceDiscovery

```typescript
interface ServiceDiscovery {
  register(service: ServiceDefinition): Promise<void>
  deregister(serviceId: string): Promise<void>
  discover(name: string, tags?: string[]): Promise<ServiceInstance[]>
  discoverHealthy(name: string): Promise<ServiceInstance[]>
  watch(name: string, callback: (instances: ServiceInstance[]) => void): Promise<string>
  healthCheck(serviceId: string): Promise<HealthResult>
}

interface ServiceInstance {
  id: string
  name: string
  host: string
  port: number
  tags: string[]
  health: 'healthy' | 'unhealthy' | 'unknown'
  metadata: Record<string, string>
}
```

Backends: Consul, etcd, or built-in with gossip replication. Watch uses long-polling or WebSocket for real-time updates. Health checks via TCP, HTTP, or gRPC probes.

---

## Usage Examples

```typescript
// Join cluster and participate in election
const cluster = new KernelCluster({ heartbeatInterval: 5_000 })
await cluster.join()

const election = new LeaderElection(cluster)
election.onElection((leader) => {
  if (election.isLeader()) {
    console.log(`Node ${cluster.getNode(leader.id)} is now leader`)
  }
})
await election.campaign()

// Acquire distributed lock
const lock = await distLock.acquire('db-migration', 60_000)
try {
  await runMigration()
} finally {
  await distLock.release(lock)
}

// Publish cross-node event
await eventBus.publish('cluster.custom', {
  id: uuid(), type: 'config_changed', nodeId: 'node-1', timestamp: Date.now(), payload: {},
})

// Register service
await serviceDiscovery.register({
  id: 'api-v2', name: 'behavioros-api', host: '10.0.1.5', port: 3000,
  tags: ['api', 'production'], health: 'healthy', metadata: { version: '2.1.0' },
})

// Auto-scaling rule
await autoScaler.setRules([
  { metric: 'queue_depth', threshold: 100, operator: 'gt', scaleDelta: 1, cooldownSeconds: 60 },
  { metric: 'queue_depth', threshold: 10, operator: 'lt', scaleDelta: -1, cooldownSeconds: 120 },
])
```

---

## References

- [EVENT_MESH_SPEC.md](./EVENT_MESH_SPEC.md) — Local Event Mesh specification
- [PLATFORM_SPEC.md](./PLATFORM_SPEC.md) — Pipeline dispatcher and layer contracts
- [KERNEL_SPEC.md](./KERNEL_SPEC.md) — Kernel invariants and lifecycle
- [PACKAGE_ARCHITECTURE.md](./PACKAGE_ARCHITECTURE.md) — Package dependency DAG
- Raft Consensus Algorithm — Diego Ongaro, In Search of an Understandable Consensus Algorithm
