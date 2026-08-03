# EAARG — The 18-Layer Enterprise Agent Architecture Review

> **Note on naming**: if you came here looking for "the 18 prompts," this is the closest thing that actually exists in the codebase as a numbered set of 18 — the **Enterprise Agent Architecture Review Guide (EAARG)**, a DNA-driven, 18-gate SDLC review pipeline. It's a different (and larger) thing than the [7-step delegation protocol](PROTOCOL.md), which governs individual missions. Think of EAARG as the deep, whole-project architecture review, and the 7-step protocol as the per-task governance loop that runs constantly underneath it.

## What EAARG is

EAARG is defined as a DNA package — [`dnas/enterprise-agent-review.yaml`](../dnas/enterprise-agent-review.yaml) (1,386 lines) — where each of its 18 `workflows` entries is a `gate`-type step covering one layer of the SDLC, from business discovery through production readiness. Each layer carries, per `EAARGStepSchema` (`packages/schemas/src/index.ts`):

- **`objectives`** — what the layer needs to validate
- **`questions`** — required questions to answer, each tagged `functional` / `non_functional` / `business` etc. and marked `required: true/false`
- **`requiredEvidence`** — documents, tests, or diagrams that must exist
- **`acceptanceCriteria`** / **`rejectionCriteria`** — weighted pass/fail conditions
- **`checklist`** — manual verification items
- **`skills`** — which BehaviorOS skill(s) (with a weight) are needed to execute the layer, and which persona (`agent`) owns it

This is a genuinely large, detailed spec — this document summarizes each layer's objectives, a representative question, and its owning skill(s)/agent so you can navigate it without opening the full YAML. For the complete question set, evidence list, and full acceptance/rejection criteria per layer, read the YAML directly.

## The 18 Layers

| # | Layer | Agent | Objectives | Sample Question | Skill(s) |
|---|---|---|---|---|---|
| 1 | Business | architect | Validate business alignment, identify stakeholders, define success metrics | "What business problem are we solving?" | Enterprise Product, Enterprise Executive |
| 2 | Product | architect | Define product scope, validate value proposition, identify user personas | "Is the product scope complete?" | Enterprise Product, Enterprise UX Research |
| 3 | Requirements | architect | Document functional requirements, define non-functional requirements, validate acceptance criteria | "Are all functional requirements documented?" | Enterprise Product, Enterprise UX Research |
| 4 | Architecture | architect | Define system architecture, validate design patterns, document ADRs | "Is the system architecture documented?" | Enterprise Architecture |
| 5 | Frontend | engineer | Validate UI/UX design, verify accessibility, test responsiveness | "Is the UI/UX design approved?" | Enterprise Frontend, Enterprise Design QA, Enterprise Visual Design |
| 6 | Backend | engineer | Validate backend architecture, verify code patterns, test business logic | "Is the backend architecture documented?" | Enterprise Backend |
| 7 | APIs | engineer | Validate API contracts, verify versioning, test integrations | "Are API contracts documented?" | Enterprise Backend |
| 8 | Data | engineer | Validate data model, verify query performance, test migrations | "Is the data model documented?" | Enterprise Database |
| 9 | Security | security | Perform security analysis, verify OWASP compliance, validate auth | "Was an OWASP Top 10 analysis performed?" | Enterprise Security |
| 10 | Infrastructure | devops | Validate infrastructure-as-code, verify container config, test provisioning | "Is infrastructure-as-code documented?" | Enterprise DevOps |
| 11 | DevOps | devops | Validate CI/CD pipeline, verify deploy automation, test rollback | "Is the CI/CD pipeline configured?" | Enterprise DevOps, Enterprise QA |
| 12 | QA | qa | Run E2E tests, verify test coverage, validate code quality | "Were E2E tests executed?" | Enterprise QA |
| 13 | Performance | engineer | Run load tests, verify Core Web Vitals, optimize queries | "Were load tests performed?" | Enterprise Performance |
| 14 | Observability | devops | Configure monitoring, implement logging, configure alerts | "Is monitoring configured?" | Enterprise DevOps, Enterprise Documentation |
| 15 | Documentation | engineer | Create technical docs, document the API, create usage guides | "Was technical documentation created?" | Enterprise Documentation |
| 16 | AI Governance | architect | Validate AI governance, verify ethics/transparency, assess explainability | "Is the AI policy documented?" | Enterprise AI Engineering |
| 17 | Enterprise Readiness | architect | Verify enterprise compliance, validate processes, assess maturity | "Are enterprise processes documented?" | Enterprise Architecture, Enterprise Executive |
| 18 | Production Readiness | devops | Verify production readiness, validate deploy checklists, confirm final sign-off | "Is the readiness checklist complete?" | Enterprise DevOps, Enterprise QA |

Layers run sequentially (`next:` chains layer 1 → 2 → … → 18) and each is a `gate` — per `PipelineEngine`'s pipeline model, a layer only proceeds once its acceptance criteria are met, or an escalation/rejection is recorded.

## How to run it today

There is **no dedicated `eaarg` CLI subcommand** yet, despite one being referenced in `docs/MANUAL-INTEGRACAO.md` (`npx @behavioros/cli eaarg start`) — it isn't implemented in `packages/cli/src/commands/`. Today, EAARG is just a DNA like any other:

```bash
# Point the MCP server at it
export BEHAVIOROS_DNA_PATH=./dnas/enterprise-agent-review.yaml
```

or programmatically:

```typescript
import { BehaviorOS } from '@behavioros/sdk'

const bos = new BehaviorOS({ dnaPath: './dnas/enterprise-agent-review.yaml' })
// bos.getPatternsByType(...), bos.evaluateGovernance(...), etc. now operate against
// the 18-layer workflow chain instead of a simpler DNA's 3-4 step workflow.
```

Each layer's `input` block (objectives/questions/evidence/criteria) is the payload your agent (or a human reviewer) works through before the gate advances — nothing currently automates walking the chain end-to-end for you; that orchestration is on you (or a future `eaarg` CLI command) until it's built.

## Where this fits with the 7-step protocol

They're not mutually exclusive. A large project can run **both**: the [7-step protocol](PROTOCOL.md) governs each individual mission's execution (select DNA → resolve truth → create mission → delegate → audit → learn), while EAARG is a separate, much heavier-weight review you'd run at milestone boundaries (e.g., before a major release, or as a one-time architecture audit) — it's the DNA you select in step 1 of the protocol when the task at hand *is* "review our architecture end-to-end," not the DNA you'd use for routine feature work.
