# BehaviorOS DNA Catalog

DNA (Deoxyribonucleic Algorithm) packages define behavioral configurations for AI agent teams. Each DNA package specifies personas, governance rules, quality gates, patterns, and workflows.

## Enterprise Governance DNA

**MANDATORY for all production deployments.**

Enterprise-grade governance for regulated industries. Covers compliance, audit trails, access control, and change management.

### Personas

| Role | Authority | Name | Key Boundaries |
|---|---|---|---|
| Architect | Architect | Enterprise Architect | Max 10 modules/PR, require ADR |
| QA | Senior | Quality Assurance Lead | Min 80% coverage, require tests |
| Security | Architect | Security Architect | No secrets, review dependencies |
| Engineer | Senior | Senior Engineer | Max 15 files/PR, require review |
| DevOps | Senior | DevOps Engineer | No direct prod access, require change request |

### Governance Rules

- **Change Management** (medium/escalate) — Infrastructure and database changes require change request approval
- **Security Review Required** (medium/escalate) — Security-sensitive changes require security architect approval
- **Architecture Review** (medium/escalate) — Architecture changes require architect approval
- **Quality Gate** (medium/warn) — Features and bugfixes must pass quality gates before merge
- **Documentation Required** (low/warn) — Significant changes require documentation updates

### Quality Gates

| Gate | Threshold |
|---|---|
| Test Coverage | 80% minimum |
| Lint | Pass |
| Typecheck | Pass |
| Security Scan | No critical vulnerabilities |
| Performance | 90 threshold |

---

## Military Operations DNA

Military-grade operations for high-stakes AI agent coordination. Strict chain of command, mission-focused execution, and after-action review patterns.

### Personas

| Role | Authority | Name | Key Boundaries |
|---|---|---|---|
| Manager | C-Level | Commander | Max 3 concurrent missions |
| Manager | Lead | Operations Officer | Max 8 parallel tasks |
| Specialist | Senior | Tactical Specialist | Max 5 files, no unauthorized access |
| Analyst | Senior | Intelligence Analyst | Max 10 files, require review |
| Engineer | Senior | Logistics Coordinator | Max 6 modules, require approval |

### Governance Rules

- **Chain of Command** (critical/block) — All operational decisions follow established chain
- **Mission Priority** (critical/escalate) — Higher priority missions take precedence
- **Resource Allocation** (high/escalate) — Resource expenditure above threshold requires commander approval
- **After-Action Review** (medium/warn) — All completed missions require an after-action review
- **Communications Protocol** (medium/warn) — Standardized communication format for all messages

### Quality Gates

| Gate | Threshold |
|---|---|
| Mission Success Rate | 85% minimum |
| Response Time | 90 threshold |
| Resource Efficiency | 80% minimum |
| Intelligence Accuracy | 90% minimum |
| Security Clearance | Pass |

---

## Surgical Team DNA

Zero-defect operations for patient safety. Sterile field protocols, timeout verification, and structured handoff communication.

### Personas

| Role | Authority | Name | Key Boundaries |
|---|---|---|---|
| Architect | Architect | Lead Surgeon | Max 1 concurrent procedure |
| Engineer | Senior | Assistant Surgeon | Max 4 tasks, verbal confirmation |
| Specialist | Senior | Anesthesiologist | No surgical instrument manipulation |
| Specialist | Senior | Surgical Nurse | Must maintain sterile field integrity |
| Support | Senior | Circulating Nurse | No sterile field entry |

### Governance Rules

- **Sterile Field** (critical/block) — Strict adherence to sterile field protocols
- **Timeout Verification** (critical/block) — Mandatory time-out before any invasive procedure
- **Team Communication** (high/escalate) — Standardized closed-loop communication for critical events
- **Incident Reporting** (high/warn) — All adverse events and near-misses must be reported
- **Checklist Compliance** (critical/block) — All surgical safety checklists completed in full

### Quality Gates

| Gate | Threshold |
|---|---|
| Zero Defect Tolerance | Pass |
| Checklist Compliance | 100% |
| Patient Safety | Pass |
| Communication Clarity | Pass |
| Count Accuracy | 100% |

---

## Lean Factory DNA

Continuous improvement operations. Kaizen events, 5S methodology, value stream mapping, and standard work patterns.

### Personas

| Role | Authority | Name | Key Boundaries |
|---|---|---|---|
| Manager | Director | Plant Manager | Max 5 improvement projects |
| Engineer | Senior | Production Engineer | Max 6 process changes/cycle |
| QA | Senior | Quality Inspector | No shipment without quality clearance |
| Specialist | Senior | Maintenance Technician | Max 3 simultaneous repairs |
| Architect | Architect | Continuous Improvement Lead | Max 2 concurrent kaizen events |

### Governance Rules

- **Kaizen Approval** (high/escalate) — All kaizen events require CI lead and plant manager approval
- **Waste Elimination** (medium/warn) — Systematic identification and elimination of all eight wastes
- **Standard Work** (critical/block) — All production processes follow documented standard work
- **Visual Management** (medium/log) — All production areas maintain visual management boards
- **Safety Compliance** (critical/block) — Zero tolerance for safety violations

### Quality Gates

| Gate | Threshold |
|---|---|
| First Pass Yield | 95% minimum |
| Cycle Time | 90 threshold |
| Defect Rate | 98% minimum |
| Overall Equipment Effectiveness | 85% minimum |
| 5S Audit Score | 80% minimum |

---

## Enterprise Agent Architecture Review Guide (EAARG)

18-layer framework for comprehensive AI agent architecture review. Each layer maps to specialized enterprise skills.

### Personas

| Role | Authority | Name |
|---|---|---|
| Architect | Architect | Enterprise Architect |
| Engineer | Senior | Senior Engineer |
| QA | Senior | QA Lead |
| Security | Architect | Security Architect |
| DevOps | Senior | DevOps Engineer |

### Governance Rules

- **Change Management EAARG** (critical/block) — Architecture and infrastructure changes require review
- **Security Review** (critical/escalate) — Security-sensitive changes require security architect approval
- **Quality Gate** (high/block) — Features and bugfixes must pass quality gates

### Quality Gates

| Gate | Threshold |
|---|---|
| Test Coverage | 80% minimum |
| Lint | 100 threshold |
| Typecheck | 100 threshold |
| Security Scan | 100 threshold |
| Performance | 90 threshold |

### Workflow Layers

The EAARG defines 18 sequential review layers, each with specific objectives, questions, required evidence, and acceptance criteria:

| Layer | Name | Agent | Skills |
|---|---|---|---|
| 1 | Business | Architect | Enterprise Product, Enterprise Executive |
| 2 | Product | Architect | Enterprise Product, Enterprise UX Research |
| 3 | Requirements | Architect | Enterprise Product, Enterprise UX Research |
| 4 | Architecture | Architect | Enterprise Architecture |
| 5 | Frontend | Engineer | Enterprise Frontend, Enterprise Design QA, Enterprise Visual Design |
| 6 | Backend | Engineer | Enterprise Backend |
| 7 | APIs | Engineer | Enterprise Backend |
| 8 | Data | Engineer | Enterprise Database |
| 9 | Security | Security | Enterprise Security |
| 10 | Infrastructure | DevOps | Enterprise DevOps |
| 11 | DevOps | DevOps | Enterprise DevOps, Enterprise QA |
| 12 | QA | QA | Enterprise QA |
| 13 | Performance | Engineer | Enterprise Performance |
| 14 | Observability | DevOps | Enterprise DevOps, Enterprise Documentation |
| 15 | Documentation | Engineer | Enterprise Documentation |
| 16 | AI Governance | Architect | Enterprise AI Engineering |
| 17 | Enterprise Readiness | Architect | Enterprise Architecture, Enterprise Executive |
| 18 | Production Readiness | DevOps | Enterprise DevOps, Enterprise QA |

Each layer includes:
- **Objectives** — What needs to be validated
- **Questions** — Required questions to answer
- **Required Evidence** — Documents, tests, or diagrams needed
- **Acceptance Criteria** — Pass/fail conditions
- **Rejection Criteria** — Automatic failure conditions
- **Checklist** — Manual verification items

---

## Next.js + NestJS Fullstack DNA

Governance for a Next.js frontend + NestJS backend project. Splits frontend/backend ownership, protects the API contract between the two apps, and adds a frontend-specific accessibility/Lighthouse gate.

### Personas

| Role | Authority | Name | Key Boundaries |
|---|---|---|---|
| Architect | Architect | Fullstack Architect | Max 8 modules/PR, require ADR for contract changes |
| Engineer | Senior | Frontend Engineer (Next.js) | No `apps/api/src/**` access, max 15 files/PR |
| Engineer | Senior | Backend Engineer (NestJS) | No `apps/web/src/**` access, contract changes need approval |
| QA | Senior | Quality Assurance Lead | Min 80% coverage, require contract tests |
| DevOps | Senior | DevOps Engineer | No direct prod access, require change request |

### Governance Rules

- **API Contract Breaking Change** (critical/escalate) — Public DTO/route/OpenAPI changes require architect approval
- **Frontend/Backend Boundary** (high/block) — Frontend and backend engineers must not edit each other's app directly
- **Quality Gate** (medium/warn) — Features and bugfixes must pass quality gates before merge
- **Orchestrator Must Not Execute Directly** (critical/block) — All implementation work must be delegated

### Quality Gates

| Gate | Threshold |
|---|---|
| Test Coverage | 80% minimum |
| Lint | Pass |
| Typecheck | Pass |
| Accessibility / Lighthouse | 90 threshold |
| Security Scan | No critical vulnerabilities |

File: [`dnas/nextjs-nestjs-fullstack.yaml`](../dnas/nextjs-nestjs-fullstack.yaml)

---

## Python/Go Microservices DNA

Governance for a polyglot microservices architecture (Python and/or Go services over gRPC/REST). Protects service boundaries, treats shared protobuf/OpenAPI schemas as high-risk changes, and adds canary-release and incident-response patterns.

### Personas

| Role | Authority | Name | Key Boundaries |
|---|---|---|---|
| Architect | Architect | Distributed Systems Architect | Max 2 services/PR, require ADR for new boundaries |
| Engineer | Senior | Service Owner | No cross-service internals/DB access, max 12 files/PR |
| QA | Senior | Contract & Reliability QA | Min 75% coverage, require contract tests for schema changes |
| Security | Architect | Security Architect | No secrets, review service-to-service auth |
| DevOps | Senior | SRE / Platform Engineer | No direct prod access, require change request for mesh changes |

### Governance Rules

- **Shared Contract Breaking Change** (critical/escalate) — Protobuf/OpenAPI schema changes require architect approval
- **Service Boundary** (critical/block) — Services must not directly access another service's internals or database
- **Service Mesh / Infra Change** (medium/escalate) — Mesh and infrastructure changes require SRE approval
- **Quality Gate** (medium/warn) — Features and bugfixes must pass quality gates before merge
- **Orchestrator Must Not Execute Directly** (critical/block) — All implementation work must be delegated

### Quality Gates

| Gate | Threshold |
|---|---|
| Test Coverage | 75% minimum |
| Lint | Pass |
| Static Type Check | Pass |
| Security Scan | No critical vulnerabilities |
| Latency SLO | 90 threshold |

File: [`dnas/python-go-microservices.yaml`](../dnas/python-go-microservices.yaml)

---

## Complex Monorepo DNA

Governance for a large pnpm/turborepo-style monorepo with many independently-owned packages. Caps blast radius per change, requires impact analysis before touching shared tooling or another package's internals, and coordinates releases via changesets instead of per-PR publishing.

### Personas

| Role | Authority | Name | Key Boundaries |
|---|---|---|---|
| Architect | Architect | Monorepo Maintainer | Max 3 packages/PR, require approval for shared tooling changes |
| Engineer | Senior | Package Owner | No access to another package's internals or shared tooling, max 20 files/PR |
| QA | Senior | Quality Assurance Lead | Min 80% coverage, require a changeset per publish |
| DevOps | Senior | Release Engineer | No direct publish access, require change request for CI changes |

### Governance Rules

- **Shared Tooling Change** (critical/escalate) — Root build/CI config changes require architect approval
- **Cross-Package Boundary** (high/block) — Package owners must not directly edit another package's internal source
- **Changeset Required** (high/escalate) — Any published-package change needs a changeset for correct versioning
- **Quality Gate** (medium/warn) — Features and bugfixes must pass quality gates before merge
- **Orchestrator Must Not Execute Directly** (critical/block) — All implementation work must be delegated

### Quality Gates

| Gate | Threshold |
|---|---|
| Test Coverage | 80% minimum |
| Lint | Pass |
| Typecheck | Pass |
| Security Scan | No critical vulnerabilities |
| Dependency Graph Integrity | Pass (no circular deps) |

File: [`dnas/complex-monorepo.yaml`](../dnas/complex-monorepo.yaml)

---

## Custom DNAs

You can create custom DNA packages by combining patterns from existing DNAs or defining your own. Place YAML files in the `dnas/` directory and reference them via the `dnaPath` configuration option.

```yaml
id: my-custom-dna
name: Custom DNA
version: '1.0.0'
description: My custom behavioral configuration

personas:
  - role: engineer
    authority: senior
    name: Lead Developer
    boundaries:
      - id: max-files
        name: Max files per change
        type: max_files
        value: 10
        scope: per_pr

governance:
  - id: require-review
    name: Code Review Required
    level: high
    action: block
    conditions:
      - type:feature
```
