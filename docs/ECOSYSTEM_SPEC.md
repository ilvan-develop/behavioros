# BehaviorOS Ecosystem Specification

> **Version:** 1.0.0
> **Status:** Architecture Stabilization — Phase 1
> **Last Updated:** July 2026
> **Source of Truth:** `packages/ecosystem/`
> **Architecture Level:** Level 4 — Ecosystem

---

## Overview

The Ecosystem layer provides the platform infrastructure for third-party extensibility, multi-tenancy, commerce, and developer tooling: plugin lifecycle management, digital twins, tenant and workspace management, billing, SDK generation, CLI engine, package registry, and marketplace.

### Architecture Position

```
Level 1: Kernel              ← Event Sourcing, CQRS, Contracts, Event Mesh
Level 2: Cognitive Platforms  ← Observability, Intelligence, Governance
Level 3: Enterprise Services  ← Cloud, Runtime, Integration
Level 4: Ecosystem            ← YOU ARE HERE — SDKs, CLI, Registry, Marketplace
```

---

## Core Interfaces

### PluginManifest

```typescript
interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  license: string
  entrypoint: string
  capabilities: string[]
  dependencies: { id: string; version: string; optional?: boolean }[]
  permissions: string[]
  hooks: string[]
  configSchema?: Record<string, unknown>
}
```

### PackageVersion

```typescript
interface PackageVersion {
  id: string
  packageId: string
  version: string
  manifest: Record<string, unknown>
  checksum: string
  signature?: string
  publishedAt: string
  downloads: number
  deprecation?: { message: string; alternative?: string }
}
```

---

## 1. PluginLifecycle

```typescript
interface PluginLifecycle {
  register(manifest: PluginManifest): Promise<string>
  load(pluginId: string): Promise<void>
  enable(pluginId: string): Promise<void>
  disable(pluginId: string): Promise<void>
  uninstall(pluginId: string): Promise<void>
  getStatus(pluginId: string): Promise<PluginStatus>
  list(): Promise<PluginInfo[]>
}

interface PluginStatus {
  id: string
  state: 'registered' | 'loaded' | 'enabled' | 'disabled' | 'error'
  memoryUsage?: number
  uptime?: number
  error?: string
}
```

**Manifest validation:** Required fields present, SemVer version, entrypoint file exists, dependencies resolvable, hooks reference valid extension points. Permissions checked against allowlist at `enable()` time.

**Lifecycle:**
```
registered → loaded → enabled ↔ disabled
    ↓                                    ↓
  error ←──────────────────────────── uninstall
```

---

## 2. DigitalTwin

```typescript
interface DigitalTwin {
  create(spec: TwinSpec): Promise<string>
  simulate(twinId: string, scenario: SimulationScenario): Promise<SimulationResult>
  forecast(twinId: string, horizon: string): Promise<ForecastResult>
  injectChaos(twinId: string, experiment: ChaosExperiment): Promise<ChaosResult>
  sync(twinId: string): Promise<void>
  getState(twinId: string): Promise<TwinState>
  compare(twinIdA: string, twinIdB: string): Promise<TwinDiff>
}

interface TwinSpec {
  name: string
  source: 'behavioros' | 'external' | 'synthetic'
  model: string
  parameters: Record<string, unknown>
  syncInterval?: string
}
```

**Use cases:** Simulation of agent behavior before deployment, forecasting resource needs, chaos injection for resilience testing, what-if analysis. **Sync** pulls real-world state into the twin for drift detection. **Compare** highlights divergence between twin and reality.

| Scenario Type | Description | Example |
|---------------|-------------|---------|
| `load_test` | Traffic simulation | 10K concurrent missions |
| `failure_injection` | Component failure | DB connection drop |
| `scale_test` | Horizontal scaling | Agent pool grows 10x |
| `what_if` | Parameter tuning | Change DNA governance level |

---

## 3. TenantManager

```typescript
interface TenantManager {
  create(config: TenantConfig): Promise<Tenant>
  get(tenantId: string): Promise<Tenant | undefined>
  update(tenantId: string, config: Partial<TenantConfig>): Promise<void>
  delete(tenantId: string): Promise<void>
  list(): Promise<Tenant[]>
  setQuota(tenantId: string, quota: Quota): Promise<void>
  getQuota(tenantId: string): Promise<Quota>
  trackUsage(tenantId: string, usage: UsageRecord): Promise<void>
  getUsage(tenantId: string, period: TimeRange): Promise<UsageSummary>
}

interface Quota {
  maxAgents: number
  maxMissions: number
  maxStorageGb: number
  maxTokensPerDay: number
  maxConcurrentPipelines: number
}
```

**Isolation:** Data partitioned by `tenantId` at the storage layer. Resources capped by quotas with per-tenant overage policies (`block`, `warn`, `allow-billable`). Usage tracked per resource type for chargeback.

---

## 4. WorkspaceManager

```typescript
interface WorkspaceManager {
  create(name: string, config?: WorkspaceConfig): Promise<Workspace>
  get(workspaceId: string): Promise<Workspace | undefined>
  update(workspaceId: string, config: Partial<WorkspaceConfig>): Promise<void>
  delete(workspaceId: string): Promise<void>
  addMember(workspaceId: string, member: Member): Promise<void>
  removeMember(workspaceId: string, userId: string): Promise<void>
  listMembers(workspaceId: string): Promise<Member[]>
  listByTenant(tenantId: string): Promise<Workspace[]>
}

interface WorkspaceConfig {
  tenantId: string
  settings: Record<string, unknown>
  features: string[]
  allowedDnas: string[]
  maxMembers: number
}
```

**Roles:** `owner`, `admin`, `member`, `viewer`. Each workspace has its own DNA configuration, feature flags, and member list. Isolation boundary within a tenant — workspaces cannot see each other's data.

---

## 5. BillingEngine

```typescript
interface BillingEngine {
  createPlan(plan: PricingPlan): Promise<string>
  getPlan(planId: string): Promise<PricingPlan | undefined>
  subscribe(tenantId: string, planId: string): Promise<Subscription>
  cancelSubscription(tenantId: string): Promise<void>
  generateInvoice(tenantId: string, period: TimeRange): Promise<Invoice>
  getUsageSummary(tenantId: string, period: TimeRange): Promise<UsageSummary>
  previewInvoice(tenantId: string, planId: string): Promise<InvoicePreview>
}

interface PricingPlan {
  name: string
  tier: 'free' | 'pro' | 'enterprise' | 'custom'
  basePrice: number
  inclusions: { resource: string; limit: number }[]
  overage: { resource: string; pricePerUnit: number }[]
  billingCycle: 'monthly' | 'annual'
}
```

**Metering:** Tracks `tokens_consumed`, `missions_executed`, `storage_gb`, `api_calls`, `agent_minutes`. Invoices generated at end of billing cycle with line-item breakdown. Supports credits, coupons, and usage caps.

---

## 6. SDKGenerator

```typescript
interface SDKGenerator {
  generate(options: SDKOptions): Promise<GeneratedSDK>
  getLanguages(): string[]
  getVersion(): string
}

interface SDKOptions {
  language: 'typescript' | 'python' | 'go' | 'java' | 'csharp' | 'rust' | 'ruby' | 'php'
  version: string
  outputDir: string
  includeEndpoints: string[]
  clientName?: string
  packageConfig?: Record<string, unknown>
}

interface GeneratedSDK {
  language: string
  outputPath: string
  files: string[]
  clientClass: string
  packageManager: string
  installCmd: string
}
```

**Generated artifacts per language:** Client class with typed methods, request/response type definitions, error classes, package config (`package.json`, `pyproject.toml`, `go.mod`, etc.), README with quickstart. Generator reads OpenAPI spec from `@behavioros/schemas`.

| Language | Client Class | Package Manager |
|----------|-------------|-----------------|
| TypeScript | `BehaviorOSClient` | npm / pnpm |
| Python | `BehaviorOSClient` | pip / poetry |
| Go | `behavioros.Client` | go modules |
| Java | `BehaviorOSClient` | maven / gradle |
| C# | `BehaviorOSClient` | NuGet |
| Rust | `BehaviorOSClient` | cargo |
| Ruby | `BehaviorOS::Client` | gem |
| PHP | `BehaviorOS\\Client` | composer |

---

## 7. CLIEngine

```typescript
interface CLIEngine {
  register(command: CommandDefinition): void
  execute(argv: string[]): Promise<CommandResult>
  getHelp(command?: string): string
  autocomplete(shell: 'bash' | 'zsh' | 'powershell'): string
  listCommands(): CommandDefinition[]
}

interface CommandDefinition {
  name: string
  description: string
  usage: string
  args: ArgDefinition[]
  flags: FlagDefinition[]
  subcommands?: CommandDefinition[]
  handler: (args: Record<string, unknown>, flags: Record<string, unknown>) => Promise<void>
}
```

**Built-in commands:** `init`, `compile`, `validate`, `status`, `version`, `doctor`, `pipeline`, `audit`, `mission`, `agent`, `dna`, `plugin`, `sdk`, `login`, `config`. Help system with hierarchical subcommand support and shell completion generation.

---

## 8. Registry

```typescript
interface Registry {
  publish(pkg: PackageDefinition): Promise<string>
  get(packageId: string, version?: string): Promise<PackageVersion | undefined>
  search(query: string, filters?: SearchFilters): Promise<SearchResult[]>
  resolve(name: string, version: string): Promise<ResolvedVersion>
  deprecate(packageId: string, version: string, message: string, alternative?: string): Promise<void>
  yank(packageId: string, version: string): Promise<void>
  listVersions(packageId: string): Promise<PackageVersion[]>
  getStats(packageId: string): Promise<PackageStats>
}

interface SearchFilters {
  type?: string
  author?: string
  minDownloads?: number
  maxLatency?: number
  tags?: string[]
}
```

**Version resolution:** SemVer range matching with latest, caret, tilde, and exact. Dependency graph resolution with conflict detection. **Stats:** total downloads, version downloads, daily trend, dependents count.

---

## 9. Marketplace

```typescript
interface Marketplace {
  list(category?: string, filters?: ListingFilters): Promise<Listing[]]
  get(listingId: string): Promise<ListingDetail | undefined>
  publish(listing: ListingDraft): Promise<string>
  install(listingId: string, target?: InstallTarget): Promise<InstallResult>
  uninstall(listingId: string): Promise<void>
  submitRating(listingId: string, rating: Rating): Promise<void>
  getRatings(listingId: string): Promise<RatingsSummary>
  getReviews(listingId: string): Promise<Review[]>
}

interface Listing {
  id: string
  packageId: string
  name: string
  description: string
  category: string
  author: string
  version: string
  downloads: number
  rating: number
  verified: boolean
  pricing: 'free' | 'paid' | 'freemium'
  tags: string[]
}
```

**Categories:** `agents`, `tools`, `dnas`, `plugins`, `connectors`, `workflows`, `skills`, `templates`. **Verification** badge for packages that pass security review and quality gates. Rating 1-5 stars with review text. Paid listings integrate with BillingEngine for revenue sharing.

---

## Usage Examples

```typescript
// Register a plugin
const pluginId = await plugins.register({
  id: 'custom-exporter',
  name: 'Custom Exporter',
  version: '1.0.0',
  description: 'Exports audit logs to custom sink',
  entrypoint: './dist/index.js',
  capabilities: ['audit:export'],
  dependencies: [],
  permissions: ['audit:read'],
  hooks: ['audit:after-export'],
})

// Create a digital twin
const twinId = await digitalTwin.create({
  name: 'prod-clone',
  source: 'behavioros',
  model: 'production',
  parameters: { replicas: 5, region: 'us-east-1' },
  syncInterval: '5m',
})
const result = await digitalTwin.simulate(twinId, {
  type: 'load_test',
  params: { concurrentMissions: 1000, duration: '10m' },
})

// Manage tenant
const tenant = await tenants.create({ name: 'Acme Corp', plan: 'enterprise' })
await tenants.setQuota(tenant.id, {
  maxAgents: 50, maxMissions: 10000, maxStorageGb: 100, maxTokensPerDay: 10_000_000, maxConcurrentPipelines: 20,
})

// Generate SDK
await sdk.generate({
  language: 'python', version: '1.0.0', outputDir: './sdk/python',
  includeEndpoints: ['missions', 'agents', 'audit'],
  clientName: 'BehaviorOSClient',
  packageConfig: { name: 'behavioros-sdk', author: 'Acme Corp' },
})

// Publish to registry
const pkgId = await registry.publish({
  id: 'my-agent', name: 'Code Reviewer', type: 'agent', version: '1.0.0',
  description: 'AI code review agent', author: 'Acme Corp',
  manifest: { entrypoint: 'agent.js', ... },
})

// Marketplace listing
await marketplace.publish({
  packageId: pkgId, name: 'Code Reviewer', category: 'agents',
  description: 'Automated PR code review agent', pricing: 'freemium', tags: ['review', 'github'],
})
```

---

## References

- [CAPABILITY_SPEC.md](./CAPABILITY_SPEC.md) — Capability system and lifecycle
- [PLATFORM_SPEC.md](./PLATFORM_SPEC.md) — Pipeline dispatcher layers
- [KERNEL_SPEC.md](./KERNEL_SPEC.md) — Kernel invariants and lifecycle
- [PACKAGE_ARCHITECTURE.md](./PACKAGE_ARCHITECTURE.md) — Package dependency DAG
- [CLI.md](./CLI.md) — CLI command reference
