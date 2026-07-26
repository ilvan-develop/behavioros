import type { KnowledgeGraph } from '../knowledge-graph';
import type { MemoryItem, MemoryType } from './types';

/**
 * Fact — Configuration and options interface.
 */
export interface Fact {
  subject: string;
  predicate: string;
  object: string;
}

/**
 * SemanticMemory — Provides constructor, storeFact, queryFact, getAllFacts, ... operations.
 */
export class SemanticMemory {
  readonly type: MemoryType = 'semantic';
  private graph: KnowledgeGraph;
  private facts: Fact[] = [];

  constructor(graph: KnowledgeGraph) {
    this.graph = graph;
  }

  storeFact(subject: string, predicate: string, object: string): MemoryItem {
    const fact: Fact = { subject, predicate, object };
    this.facts.push(fact);

    const subjId = this.graph.addNode({
      type: 'fact',
      label: subject,
      properties: { predicate, object, kind: 'subject' },
    });

    const objId = this.graph.addNode({
      type: 'fact',
      label: object,
      properties: { predicate, subject, kind: 'object' },
    });

    this.graph.addEdge({
      sourceId: subjId,
      targetId: objId,
      relation: 'derived_from',
      weight: 1,
      properties: { predicate, factId: subjId },
    });

    return {
      id: subjId,
      type: this.type,
      key: `${subject}:${predicate}:${object}`,
      value: `${subject} ${predicate} ${object}`,
      context: { subject, predicate, object },
      timestamp: new Date().toISOString(),
      importance: 0.6,
    };
  }

  queryFact(subject: string, predicate?: string): Fact[] {
    return this.facts.filter(
      (f) => f.subject === subject && (!predicate || f.predicate === predicate),
    );
  }

  getAllFacts(): Fact[] {
    return [...this.facts];
  }

  clear(): void {
    this.facts = [];
    this.graph.clear();
  }
}
