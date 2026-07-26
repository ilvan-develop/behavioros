import { randomUUID } from 'node:crypto';
import type { MemoryItem, MemoryType } from './types';

/**
 * Procedure — Configuration and options interface.
 */
export interface Procedure {
  name: string;
  steps: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * ProceduralMemory — procedural memory.
 *
 * Methods: store, retrieve, list, clear.
 */
export class ProceduralMemory {
  readonly type: MemoryType = 'procedural';
  private procedures: Map<string, Procedure> = new Map();

  store(name: string, steps: string[], tags: string[] = []): MemoryItem {
    const now = new Date().toISOString();
    const existing = this.procedures.get(name);
    const procedure: Procedure = {
      name,
      steps,
      tags,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.procedures.set(name, procedure);

    return {
      id: randomUUID(),
      type: this.type,
      key: name,
      value: steps.join('\n'),
      context: { steps, tags },
      timestamp: now,
      importance: 0.9,
    };
  }

  retrieve(name: string): Procedure | null {
    return this.procedures.get(name) ?? null;
  }

  list(tag?: string): Procedure[] {
    const all = Array.from(this.procedures.values());
    if (!tag) return all;
    return all.filter((p) => p.tags.includes(tag));
  }

  delete(name: string): boolean {
    return this.procedures.delete(name);
  }

  clear(): void {
    this.procedures.clear();
  }
}
