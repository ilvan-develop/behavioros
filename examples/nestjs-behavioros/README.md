# NestJS + BehaviorOS — Example Integration

This example demonstrates how to integrate [BehaviorOS](https://github.com/anomalyco/behavioros) into a [NestJS](https://nestjs.com) application.

## How to Integrate

### 1. Install SDK

```bash
npm install @behavioros/core
```

### 2. Configure DNA

Create a `behavioros.yaml` file in your project root defining personas, governance rules, and quality gates. The DNA file is loaded at bootstrap and validated by the Behavioral Engine.

```yaml
# behavioros.yaml
personas:
  - id: payment-service
    name: Payment Service Agent
    role: Execute payment transactions
governanceRules:
  - id: no-direct-prod
    name: No Direct Production Access
    severity: block
    action: block
```

### 3. Use Governance Engine

Import `GovernanceEngine` from `@behavioros/core` and evaluate actions before executing them:

```typescript
import { GovernanceEngine } from '@behavioros/core'

const engine = new GovernanceEngine(dnaConfig)
const result = await engine.evaluate({ action: 'deploy', target: 'production' })
if (result.action === 'block') throw new Error('Action blocked by governance')
```

## Running

```bash
npm install
npm run start:dev
```

The server starts at `http://localhost:3000`.
