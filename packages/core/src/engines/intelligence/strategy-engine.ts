import { randomUUID } from 'node:crypto';

/**
 * StrategyLevel — Union type: vision, strategic, tactical;.
 */
export type StrategyLevel = 'vision' | 'strategic' | 'tactical';

/**
 * Strategy — Configuration and options interface.
 */
export interface Strategy {
  id: string;
  level: StrategyLevel;
  name: string;
  description: string;
  objectives: string[];
  constraints: string[];
  parentId?: string;
  priority: number;
  status: 'active' | 'completed' | 'superseded' | 'cancelled';
  createdAt: string;
}

/**
 * StrategyEngine — Provides create, get, getByLevel, getTree, ... operations.
 */
export class StrategyEngine {
  private strategies: Map<string, Strategy> = new Map();

  create(
    level: StrategyLevel,
    name: string,
    description: string,
    objectives: string[],
    constraints?: string[],
    parentId?: string,
  ): string {
    const id = randomUUID();
    const strategy: Strategy = {
      id,
      level,
      name,
      description,
      objectives,
      constraints: constraints ?? [],
      parentId,
      priority: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.strategies.set(id, strategy);
    return id;
  }

  get(id: string): Strategy | undefined {
    return this.strategies.get(id);
  }

  getByLevel(level: StrategyLevel): Strategy[] {
    return [...this.strategies.values()].filter((s) => s.level === level);
  }

  getTree(rootId: string): Strategy[] {
    const root = this.strategies.get(rootId);
    if (!root) return [];

    const result: Strategy[] = [root];

    function collect(engine: StrategyEngine, parentId: string) {
      for (const strategy of engine.strategies.values()) {
        if (strategy.parentId === parentId) {
          result.push(strategy);
          collect(engine, strategy.id);
        }
      }
    }

    collect(this, rootId);
    return result;
  }

  supersede(id: string, _newStrategyId: string): void {
    const strategy = this.strategies.get(id);
    if (strategy) {
      strategy.status = 'superseded';
    }
  }

  complete(id: string): void {
    const strategy = this.strategies.get(id);
    if (strategy) {
      strategy.status = 'completed';
    }
  }

  cancel(id: string): void {
    const strategy = this.strategies.get(id);
    if (strategy) {
      strategy.status = 'cancelled';
    }
  }

  list(): Strategy[] {
    return [...this.strategies.values()];
  }
}
