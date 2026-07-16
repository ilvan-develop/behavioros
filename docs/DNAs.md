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
