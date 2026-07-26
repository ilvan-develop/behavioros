# BehaviorOS Integrations

> **Version:** 1.0.0  
> **Status:** Canonical  
> **Last Updated:** July 2026

---

BehaviorOS integrates with three major external ecosystems to provide skills, MCP servers, design systems, and UX resources out of the box.

---

## AITMPL

**Website:** [aitmpl.com](https://aitmpl.com)  
**Adapter:** `AITMPLAdapter` (`packages/core/src/engines/adapters/aitmpl-adapter.ts`)

The AITMPL marketplace provides the largest collection of community-contributed AI agent skills, MCP servers, and prompt templates.

### Statistics

| Resource | Count |
|----------|-------|
| Skills | 2,800+ |
| MCP Servers | 65+ |
| Prompt Templates | 500+ |
| Categories | 40+ |

### How the Adapter Works

The `AITMPLAdapter` bridges BehaviorOS with the AITMPL marketplace via the `claude-code-templates` CLI:

```typescript
// Install a skill from AITMPL
const result = await aitmplAdapter.installSkill('development', 'enterprise-backend')
// → Runs: npx claude-code-templates@latest --skill development/enterprise-backend
```

**Installation flow:**

1. User calls `behavioros ecosystem install --type skill --id enterprise-backend --source aitmpl --category development`
2. EcosystemRegistry delegates to `AITMPLAdapter.installSkill(category, skillId)`
3. Adapter executes `npx claude-code-templates@latest --skill {category}/{skillId}`
4. After install, adapter reads skill metadata from the installed files
5. Registry updates its database and returns the installed component info

### MCP Installation

AITMPL also provides MCP servers that can be installed:

```bash
# Via CLI
behavioros ecosystem install --type mcp --id github-mcp --source aitmpl

# Via adapter directly
const result = await aitmplAdapter.installMCP('github-mcp')
```

### Search

```typescript
const results = await aitmplAdapter.search('typescript', 'development')
// Returns: [{ id: 'enterprise-backend', name: 'Enterprise Backend', category: 'development', stars: 245 }]
```

### CLI Usage

```bash
# Install a skill from AITMPL
behavioros ecosystem install --type skill --id enterprise-backend --source aitmpl --category development

# Install an MCP from AITMPL
behavioros ecosystem install --type mcp --id github-mcp --source aitmpl

# Sync registry with AITMPL
behavioros ecosystem sync --source aitmpl
```

---

## Open Design

**Adapter:** `OpenDesignAdapter` (`packages/core/src/engines/adapters/open-design-adapter.ts`)

The Open Design ecosystem provides design systems, UI component libraries, and design tokens that can be imported into any project.

### Statistics

| Resource | Count |
|----------|-------|
| Design Systems | 151 |
| Skills | 100+ |
| Plugins | 277 |

### How the Adapter Works

The `OpenDesignAdapter` integrates with the Open Design CLI tool:

```typescript
// Detect if Open Design CLI is available
const available = await openDesignAdapter.detect()
// → Runs: open-design --version

// Install MCP for a given agent type
const result = await openDesignAdapter.installMCP('cursor')
// → Runs: open-design install-mcp --agent cursor
```

**Detection flow:**

1. Adapter checks if `open-design` CLI is available via `open-design --version`
2. If available, it can install MCPs and list design systems
3. If not available, installation falls back gracefully with a clear error message

### Listing Design Systems

```typescript
const systems = await openDesignAdapter.listDesignSystems()
// Returns: [{ id: 'shadcn-ui', name: 'shadcn/ui', tokens: 285 }, ...]
```

### Importing Design Systems

```typescript
const result = await openDesignAdapter.importDesignSystem('shadcn-ui')
// Returns: { success: true, system: { id: 'shadcn-ui', ... } }
```

### CLI Usage

```bash
# Install a design system from Open Design
behavioros ecosystem install --type design-system --id shadcn-ui --source open-design

# Sync registry with Open Design
behavioros ecosystem sync --source aitmpl
```

---

## UI-UX Pro Max

**Adapter:** `UIUXProMaxAdapter` (`packages/core/src/engines/adapters/ui-ux-adapter.ts`)

UI-UX Pro Max is a comprehensive design skill that provides UI/UX design intelligence for web and mobile applications. It ships as a local skill at `~/.opencode/skills/ui-ux-pro-max/`.

### Statistics

| Resource | Count |
|----------|-------|
| Visual Styles | 50+ |
| Color Palettes | 161 |
| Font Pairings | 57 |
| UX Guidelines | 99 |
| Chart Types | 25 |
| Product Types | 161 |

### How the Adapter Works

The `UIUXProMaxAdapter` reads data directly from the installed skill directory:

```typescript
// Detect if the skill is installed
const installed = await uiUxAdapter.detect()
// Checks: ~/.opencode/skills/ui-ux-pro-max/
//         .opencode/skills/ui-ux-pro-max/

// List available color palettes
const palettes = await uiUxAdapter.listPalettes()
// Returns: [{ name: 'Ocean Breeze', colors: ['#...'], category: 'modern' }, ...]

// List available font pairings
const fonts = await uiUxAdapter.listFontPairings()
// Returns: [{ name: 'Inter + Roboto Mono', headings: 'Inter', body: 'Roboto Mono', category: 'modern' }, ...]

// List visual styles
const styles = await uiUxAdapter.listStyles()
// Returns: [{ name: 'Neumorphism', description: '...', characteristics: ['...'] }, ...]

// Get UX guidelines for a specific product type
const guidelines = await uiUxAdapter.getGuidelines('fintech')
// Returns: [{ category: 'security', guideline: '...', }, ...]
```

### Data Organization

The adapter reads from structured JSON files in the skill directory:

```
~/.opencode/skills/ui-ux-pro-max/
├── palettes.json          # 161 color palettes
├── fonts.json             # 57 font pairings
├── styles.json            # 50+ visual styles
├── guidelines.json        # 99 UX guidelines
├── charts.json            # 25 chart type configurations
└── product-types.json     # 161 product type definitions
```

### Supported Stacks

The adapter provides stack-specific output (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui, HTML/CSS).

### CLI Usage

UI-UX Pro Max is detected automatically by the ecosystem. To install:

```bash
# Install via ecosystem
behavioros ecosystem install --type skill --id ui-ux-pro-max --source local

# Sync to refresh data
behavioros ecosystem sync
```

---

## Adapter Architecture

All three adapters follow the same pattern for consistency:

```typescript
interface EcosystemAdapter {
  // Detection
  detect(): Promise<boolean>

  // Installation
  install(type: string, id: string): Promise<InstallResult>

  // Status
  status(): Promise<AdapterStatus>
}
```

### Unified Registry

The `EcosystemRegistry` ties all adapters together:

```
EcosystemRegistry
  ├── SkillEngine (DNA + local skills)
  ├── AITMPLAdapter (community marketplace)
  ├── OpenDesignAdapter (design systems)
  └── UIUXProMaxAdapter (design intelligence)
```

When you run `behavioros ecosystem status`, it queries all sources and aggregates the results into a single report:

| Metric | AITMPL | Open Design | UI-UX Pro Max | Local |
|--------|--------|-------------|---------------|-------|
| Skills | 2,800+ | 100+ | — | Configured |
| MCPs | 65+ | — | — | Connected |
| Design Systems | — | 151 | — | — |
| Palettes | — | — | 161 | — |
| Font Pairings | — | — | 57 | — |
| Styles | — | — | 50+ | — |

---

## Adding New Integrations

To add a new external integration:

1. Create an adapter class in `packages/core/src/engines/adapters/`
2. Implement the `detect`, `install`, and `status` methods
3. Register the adapter in `EcosystemRegistry`
4. Add the adapter to `ecosystem doctor` diagnostics
5. Update `ecosystem report` to include the new source

---

## Troubleshooting

### AITMPL
```bash
# Check if CLI is available
npx claude-code-templates@latest --help

# Common issues:
# - "command not found" → Ensure Node.js >= 18 is installed
# - "network error" → Check internet connectivity
```

### Open Design
```bash
# Check if CLI is available
open-design --version

# Common issues:
# - "command not found" → Install via npm: npm install -g open-design
```

### UI-UX Pro Max
```bash
# Check if skill is installed
ls ~/.opencode/skills/ui-ux-pro-max/

# Common issues:
# - "not found" → Install the skill: copy to ~/.opencode/skills/ui-ux-pro-max/
```
