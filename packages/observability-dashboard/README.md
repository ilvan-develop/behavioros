# @behavioros/observability-dashboard

> Grafana dashboards and Prometheus rules for BehaviorOS observability — metrics, alerts, and audit trail visualization

## Installation

```bash
pnpm add @behavioros/observability-dashboard
```

## Quick Start

```bash
docker compose -f docker-compose.observability.yml up -d
```

Starts Prometheus (9090), Grafana (3002), Loki (3100), and Alertmanager (9093).

## API

### Dashboards

| Dashboard | Description |
|-----------|-------------|
| `behavioros-overview.json` | System health, mission throughput, engine status, DNA version |
| `agent-performance.json` | Agent action latency, rate limits, circuit breaker events |
| `governance-events.json` | Block/escalate/warn/log events, compliance violations |

### Prometheus Rules

| Rule | Description |
|------|-------------|
| `pipeline-failure` | Alert when any pipeline layer fails |
| `quality-gate-fail` | Alert when quality gate threshold is breached |
| `governance-violation` | Alert on critical governance rule violations |
| `high-error-rate` | Alert when agent error rate exceeds 5% threshold |

## License

MIT © Ilvan Joaquim
