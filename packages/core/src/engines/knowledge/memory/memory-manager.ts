import type { StorageProvider } from '../../../kernel/storage/types';
import { KnowledgeGraph } from '../knowledge-graph';
import { EpisodicMemory } from './episodic-memory';
import { LongTermMemory } from './long-term-memory';
import { ProceduralMemory } from './procedural-memory';
import { SemanticMemory } from './semantic-memory';
import { ShortTermMemory } from './short-term-memory';
import type { MemoryItem, MemoryType } from './types';
import { WorkingMemory } from './working-memory';

/**
 * MemoryManager — memory manager.
 *
 * Methods: getByType, search, clear.
 */
export class MemoryManager {
  readonly shortTerm: ShortTermMemory;
  readonly working: WorkingMemory;
  readonly longTerm: LongTermMemory;
  readonly semantic: SemanticMemory;
  readonly procedural: ProceduralMemory;
  readonly episodic: EpisodicMemory;

  constructor(storageProvider?: StorageProvider, knowledgeGraph?: KnowledgeGraph) {
    this.shortTerm = new ShortTermMemory();
    this.working = new WorkingMemory();
    this.longTerm = new LongTermMemory(
      storageProvider ?? {
        name: 'ephemeral',
        read: async () => null,
        write: async () => {},
        delete: async () => true,
        list: async () => [],
        exists: async () => false,
        clear: async () => {},
      },
    );
    this.semantic = new SemanticMemory(knowledgeGraph ?? new KnowledgeGraph());
    this.procedural = new ProceduralMemory();
    this.episodic = new EpisodicMemory();
  }

  getByType(type: MemoryType): MemoryItem[] {
    switch (type) {
      case 'short-term':
        return this.shortTerm.getAll();
      case 'working':
        return this.working.getAll();
      case 'long-term':
        return []; // async; use longTerm.getAll()
      case 'semantic': {
        const facts = this.semantic.getAllFacts();
        return facts.map((f) => ({
          id: '',
          type: 'semantic' as MemoryType,
          key: `${f.subject}:${f.predicate}:${f.object}`,
          value: `${f.subject} ${f.predicate} ${f.object}`,
          context: { subject: f.subject, predicate: f.predicate, object: f.object },
          timestamp: new Date().toISOString(),
          importance: 0.6,
        }));
      }
      case 'procedural': {
        const procs = this.procedural.list();
        return procs.map((p) => ({
          id: '',
          type: 'procedural' as MemoryType,
          key: p.name,
          value: p.steps.join('\n'),
          context: { steps: p.steps, tags: p.tags },
          timestamp: p.createdAt,
          importance: 0.9,
        }));
      }
      case 'episodic': {
        const episodes = this.episodic.getAll();
        return episodes.map((e) => ({
          id: e.id,
          type: 'episodic' as MemoryType,
          key: e.label,
          value: e.label,
          context: e.context,
          timestamp: e.timestamp,
          importance: 0.4,
        }));
      }
    }
  }

  search(query: string, types?: MemoryType[]): MemoryItem[] {
    const lowerQuery = query.toLowerCase();
    const allTypes: MemoryType[] = types ?? [
      'short-term',
      'working',
      'semantic',
      'procedural',
      'episodic',
    ];
    const results: MemoryItem[] = [];

    for (const t of allTypes) {
      const items = this.getByType(t);
      for (const item of items) {
        if (
          item.key.toLowerCase().includes(lowerQuery) ||
          item.value.toLowerCase().includes(lowerQuery)
        ) {
          results.push(item);
        }
      }
    }

    return results;
  }

  clear(): void {
    this.shortTerm.clear();
    this.working.clear();
    this.semantic.clear();
    this.procedural.clear();
    this.episodic.clear();
  }
}
