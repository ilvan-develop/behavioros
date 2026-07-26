/**
 * Rule — Configuration and options interface.
 */
export interface Rule {
  id: string;
  name: string;
  condition: (context: Record<string, unknown>) => boolean;
  priority: number;
  effect: 'allow' | 'deny' | 'warn' | 'escalate';
  metadata?: Record<string, unknown>;
}

/**
 * RuleEngine — rule engine.
 *
 * Methods: register, evaluate, list, remove, clear.
 */
export class RuleEngine {
  private rules: Rule[] = [];

  register(rule: Rule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  evaluate(context: Record<string, unknown>): { decision: string; matchedRule?: Rule } {
    for (const rule of this.rules) {
      if (rule.condition(context)) {
        if (rule.effect === 'deny') {
          return { decision: 'deny', matchedRule: rule };
        }
        if (rule.effect === 'warn') {
          return { decision: 'warn', matchedRule: rule };
        }
        if (rule.effect === 'escalate') {
          return { decision: 'escalate', matchedRule: rule };
        }
        if (rule.effect === 'allow') {
          return { decision: 'allow', matchedRule: rule };
        }
      }
    }
    return { decision: 'allow' };
  }

  list(): Rule[] {
    return [...this.rules];
  }

  remove(id: string): void {
    const idx = this.rules.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Rule '${id}' not found`);
    this.rules.splice(idx, 1);
  }

  clear(): void {
    this.rules = [];
  }
}
