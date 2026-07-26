import type { OntologyManager } from '../knowledge/ontology-manager';

/**
 * ImplicitRelation — Configuration and options interface.
 */
export interface ImplicitRelation {
  source: string;
  target: string;
  relation: string;
  confidence: number;
}

interface Fact {
  subject: string;
  predicate: string;
  object: string;
}

/**
 * SemanticReasoning — semantic reasoning.
 *
 * Methods: inferRelations, detectContradictions, queryKnowledge, addFact.
 */
export class SemanticReasoning {
  private ontologyManager?: OntologyManager;
  private knowledgeBase: Fact[] = [];

  constructor(ontologyManager?: OntologyManager) {
    this.ontologyManager = ontologyManager;
  }

  inferRelations(
    subject: string,
    knownRelations: { predicate: string; object: string }[],
  ): ImplicitRelation[] {
    const results: ImplicitRelation[] = [];

    for (const rel of knownRelations) {
      const isTransitive = this.isTransitive(rel.predicate);
      if (!isTransitive) continue;

      const chainTargets = this.knowledgeBase.filter(
        (f) => f.subject === rel.object && f.predicate === rel.predicate && f.object !== subject,
      );

      for (const target of chainTargets) {
        results.push({
          source: subject,
          target: target.object,
          relation: rel.predicate,
          confidence: 0.6,
        });
      }
    }

    if (this.ontologyManager) {
      const hierarchyResults = this.inferFromHierarchy(subject, knownRelations);
      results.push(...hierarchyResults);
    }

    return results;
  }

  detectContradictions(
    facts: { subject: string; predicate: string; object: string }[],
  ): { factA: string; factB: string; reason: string }[] {
    const contradictions: { factA: string; factB: string; reason: string }[] = [];
    const opposites = this.getOpposites();

    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        const a = facts[i];
        const b = facts[j];

        if (a.subject !== b.subject) continue;

        if (a.predicate === b.predicate && a.object !== b.object) {
          contradictions.push({
            factA: `${a.subject} ${a.predicate} ${a.object}`,
            factB: `${b.subject} ${b.predicate} ${b.object}`,
            reason: `Conflicting values for "${a.predicate}": "${a.object}" vs "${b.object}"`,
          });
        }

        const opp = opposites.find(
          (o) =>
            (a.predicate === o.a && b.predicate === o.b) ||
            (a.predicate === o.b && b.predicate === o.a),
        );
        if (opp && a.object === b.object) {
          contradictions.push({
            factA: `${a.subject} ${a.predicate} ${a.object}`,
            factB: `${b.subject} ${b.predicate} ${b.object}`,
            reason: `"${opp.a}" contradicts "${opp.b}"`,
          });
        }

        for (const rel of this.knowledgeBase) {
          if (
            a.predicate === b.predicate &&
            a.object === rel.subject &&
            b.object === rel.object &&
            a.subject === b.subject
          ) {
            contradictions.push({
              factA: `${a.subject} ${a.predicate} ${a.object}`,
              factB: `${b.subject} ${b.predicate} ${b.object}`,
              reason: `Transitive contradiction via "${rel.predicate}" relation on "${rel.subject}"`,
            });
          }
        }
      }
    }

    return contradictions;
  }

  queryKnowledge(subject: string, predicate?: string): string[] {
    return this.knowledgeBase
      .filter(
        (f) => f.subject === subject && (predicate === undefined || f.predicate === predicate),
      )
      .map((f) => f.object);
  }

  addFact(subject: string, predicate: string, object: string): void {
    this.knowledgeBase.push({ subject, predicate, object });
  }

  private isTransitive(predicate: string): boolean {
    const transitivePredicates = ['is-a', 'part-of', 'located-in', 'reports-to', 'contains'];
    return transitivePredicates.includes(predicate);
  }

  private getOpposites(): { a: string; b: string }[] {
    return [
      { a: 'is-active', b: 'is-inactive' },
      { a: 'is-enabled', b: 'is-disabled' },
      { a: 'is-valid', b: 'is-invalid' },
      { a: 'has-access', b: 'deny-access' },
    ];
  }

  private inferFromHierarchy(
    subject: string,
    knownRelations: { predicate: string; object: string }[],
  ): ImplicitRelation[] {
    const results: ImplicitRelation[] = [];

    if (!this.ontologyManager) return results;

    for (const rel of knownRelations) {
      const cls = this.ontologyManager.getClass(rel.object);
      if (!cls?.parentId) continue;

      const parentHierarchy = this.ontologyManager.getClassHierarchy(rel.object);
      for (const ancestorId of parentHierarchy) {
        if (ancestorId === rel.object) continue;
        results.push({
          source: subject,
          target: ancestorId,
          relation: `${rel.predicate}-via-hierarchy`,
          confidence: 0.5,
        });
      }
    }

    return results;
  }
}
