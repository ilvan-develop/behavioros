import path from 'node:path';
import { BehaviorOS } from '@behavioros/sdk';

// ============================================================
// BehaviorOS Singleton — Shared instance for all API routes
// ============================================================

const DNA_PATH = path.resolve(process.cwd(), '../../dnas/enterprise-governance.yaml');

let instance: BehaviorOS | null = null;

export function getBehaviorOS(): BehaviorOS {
  if (!instance) {
    try {
      instance = new BehaviorOS({
        dnaPath: DNA_PATH,
        governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
        quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
        learning: { enabled: true, autoApply: false },
        audit: { enabled: true },
      });
    } catch {
      // Fallback: create instance without DNA for environments where file isn't available
      instance = new BehaviorOS();
    }
  }
  return instance;
}

export { BehaviorOS };
