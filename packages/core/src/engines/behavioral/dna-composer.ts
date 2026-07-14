import type { BehaviorPattern, DNAPackage } from '@behavioros/schemas';

// ============================================================
// DNA Composer — Combina e transforma padrões comportamentais
// ============================================================

export interface CompositionResult {
  patterns: BehaviorPattern[];
  metadata: {
    sourceDNAs: string[];
    totalPatterns: number;
    conflicts: string[];
  };
}

export class DNAComposer {
  /**
   * Compõe múltiplos pacotes DNA em um único conjunto de padrões
   */
  compose(
    dnas: DNAPackage[],
    options?: { resolveConflicts?: 'first' | 'last' | 'merge' },
  ): CompositionResult {
    const resolveConflicts = options?.resolveConflicts ?? 'last';
    const allPatterns: BehaviorPattern[] = [];
    const conflicts: string[] = [];
    const seen = new Map<string, BehaviorPattern>();

    for (const dna of dnas) {
      const patterns = dna.patterns ?? [];
      for (const pattern of patterns) {
        if (seen.has(pattern.id)) {
          conflicts.push(`Conflict: pattern ${pattern.id} defined in multiple DNAs`);
          switch (resolveConflicts) {
            case 'first':
              // Keep first — do nothing
              break;
            case 'last':
              seen.set(pattern.id, pattern);
              break;
            case 'merge': {
              const existing = seen.get(pattern.id)!;
              seen.set(pattern.id, this.mergePatterns(existing, pattern));
              break;
            }
          }
        } else {
          seen.set(pattern.id, pattern);
        }
      }
    }

    allPatterns.push(...seen.values());

    return {
      patterns: allPatterns,
      metadata: {
        sourceDNAs: dnas.map((d) => d.id),
        totalPatterns: allPatterns.length,
        conflicts,
      },
    };
  }

  /**
   * Compõe dois padrões mesclando propriedades
   */
  private mergePatterns(base: BehaviorPattern, override: BehaviorPattern): BehaviorPattern {
    return {
      ...base,
      triggers: [...(base.triggers ?? []), ...(override.triggers ?? [])],
      actions: [...(base.actions ?? []), ...(override.actions ?? [])],
      conditions: [...(base.conditions ?? []), ...(override.conditions ?? [])],
      config: { ...base.config, ...override.config },
    };
  }

  /**
   * Filtra padrões por tipo
   */
  filterByType(patterns: BehaviorPattern[], type: BehaviorPattern['type']): BehaviorPattern[] {
    return patterns.filter((p) => p.type === type);
  }

  /**
   * Filtra padrões por trigger
   */
  filterByTrigger(patterns: BehaviorPattern[], trigger: string): BehaviorPattern[] {
    return patterns.filter((p) => p.triggers?.some((t) => t.includes(trigger)));
  }

  /**
   * Ordena padrões por prioridade (baseado no tipo)
   */
  sortByPriority(patterns: BehaviorPattern[]): BehaviorPattern[] {
    const priority: Record<string, number> = {
      decision: 10,
      escalation: 9,
      collaboration: 8,
      review: 7,
      testing: 6,
      deployment: 5,
      monitoring: 4,
      learning: 3,
      communication: 2,
      custom: 1,
    };
    return [...patterns].sort(
      (a, b) => (priority[String(b.type)] ?? 0) - (priority[String(a.type)] ?? 0),
    );
  }

  /**
   * Gera um resumo da composição
   */
  summary(result: CompositionResult): string {
    const lines: string[] = [];
    lines.push(
      `Composition: ${result.metadata.sourceDNAs.length} DNAs → ${result.metadata.totalPatterns} patterns`,
    );

    const byType = new Map<string, number>();
    for (const pattern of result.patterns) {
      byType.set(String(pattern.type), (byType.get(String(pattern.type)) ?? 0) + 1);
    }

    lines.push('By type:');
    for (const [type, count] of byType) {
      lines.push(`  ${type}: ${count}`);
    }

    if (result.metadata.conflicts.length > 0) {
      lines.push(`\nConflicts: ${result.metadata.conflicts.length}`);
      for (const conflict of result.metadata.conflicts) {
        lines.push(`  ⚠️ ${conflict}`);
      }
    }

    return lines.join('\n');
  }
}
