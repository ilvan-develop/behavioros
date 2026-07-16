import { randomUUID } from 'node:crypto';

// ============================================================
// Sandbox Engine — Isolated environments for DNA testing
// ============================================================

export type SandboxType = 'ephemeral' | 'persistent' | 'shadow';
export type SandboxStatus = 'active' | 'expired' | 'destroyed';

export interface SandboxEnvironment {
  id: string;
  name: string;
  type: SandboxType;
  dnaId: string;
  createdAt: number;
  expiresAt?: number;
  status: SandboxStatus;
}

const EXPIRY_DURATION: Record<SandboxType, number | undefined> = {
  ephemeral: undefined,
  persistent: 24 * 60 * 60 * 1000,
  shadow: 7 * 24 * 60 * 60 * 1000,
};

export class SandboxEngine {
  private environments: Map<string, SandboxEnvironment> = new Map();

  createEnvironment(type: SandboxType, dnaId: string): SandboxEnvironment {
    const id = `sandbox-${Date.now()}-${randomUUID().slice(0, 9)}`;
    const now = Date.now();

    const env: SandboxEnvironment = {
      id,
      name: `${type}-${dnaId}`,
      type,
      dnaId,
      createdAt: now,
      expiresAt: EXPIRY_DURATION[type] ? now + EXPIRY_DURATION[type]! : undefined,
      status: 'active',
    };

    this.environments.set(id, env);
    return env;
  }

  getEnvironment(id: string): SandboxEnvironment | undefined {
    return this.environments.get(id);
  }

  destroyEnvironment(id: string): boolean {
    const env = this.environments.get(id);
    if (!env) return false;

    env.status = 'destroyed';
    this.environments.delete(id);
    return true;
  }

  cleanupExpired(): number {
    let count = 0;
    const now = Date.now();

    for (const [id, env] of this.environments) {
      if (env.expiresAt && env.expiresAt < now) {
        env.status = 'expired';
        this.environments.delete(id);
        count++;
      }
    }

    return count;
  }

  listActive(): SandboxEnvironment[] {
    return Array.from(this.environments.values()).filter((env) => env.status === 'active');
  }

  getAll(): SandboxEnvironment[] {
    return Array.from(this.environments.values());
  }

  get count(): number {
    return this.environments.size;
  }
}
