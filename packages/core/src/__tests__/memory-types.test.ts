import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeGraph } from '../engines/knowledge/knowledge-graph';
import { EpisodicMemory } from '../engines/knowledge/memory/episodic-memory';
import { LongTermMemory } from '../engines/knowledge/memory/long-term-memory';
import { MemoryManager } from '../engines/knowledge/memory/memory-manager';
import { ProceduralMemory } from '../engines/knowledge/memory/procedural-memory';
import { SemanticMemory } from '../engines/knowledge/memory/semantic-memory';
import { ShortTermMemory } from '../engines/knowledge/memory/short-term-memory';
import { WorkingMemory } from '../engines/knowledge/memory/working-memory';
import type { StorageEntry, StorageProvider } from '../kernel/storage/types';

// ============================================================
// Helpers
// ============================================================

function storageProviderMock(): StorageProvider {
  const store = new Map<string, StorageEntry>();
  return {
    name: 'mock',
    async read(key: string) {
      return store.get(key) ?? null;
    },
    async write(key: string, value: string, metadata?: Record<string, unknown>) {
      const now = new Date().toISOString();
      const existing = store.get(key);
      store.set(key, {
        key,
        value,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        metadata,
      });
    },
    async delete(key: string) {
      return store.delete(key);
    },
    async list(prefix?: string) {
      const all = Array.from(store.values());
      if (!prefix) return all;
      return all.filter((e) => e.key.startsWith(prefix));
    },
    async exists(key: string) {
      return store.has(key);
    },
    async clear() {
      store.clear();
    },
  };
}

// ============================================================
// ShortTermMemory
// ============================================================

describe('ShortTermMemory', () => {
  let mem: ShortTermMemory;

  beforeEach(() => {
    vi.useFakeTimers();
    mem = new ShortTermMemory(3, 60_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes and reads an item', () => {
    const item = mem.write('k1', 'value1');
    expect(item.key).toBe('k1');
    expect(item.value).toBe('value1');
    expect(mem.read('k1')).not.toBeNull();
  });

  it('returns null for missing key', () => {
    expect(mem.read('nonexistent')).toBeNull();
  });

  it('evicts expired items by TTL', () => {
    mem.write('k1', 'v1', {}, 30_000);
    vi.advanceTimersByTime(31_000);
    expect(mem.read('k1')).toBeNull();
  });

  it('evicts LRU when exceeding maxItems', () => {
    mem.write('a', '1');
    mem.write('b', '2');
    mem.write('c', '3');
    mem.read('a');
    mem.read('b');
    mem.write('d', '4');
    expect(mem.read('a')).not.toBeNull();
    expect(mem.read('b')).not.toBeNull();
    expect(mem.read('c')).toBeNull();
    expect(mem.read('d')).not.toBeNull();
  });

  it('overwrites existing key', () => {
    mem.write('k1', 'original');
    mem.write('k1', 'updated');
    expect(mem.read('k1')!.value).toBe('updated');
    expect(mem.size).toBe(1);
  });

  it('delete removes item', () => {
    mem.write('k1', 'v1');
    expect(mem.delete('k1')).toBe(true);
    expect(mem.read('k1')).toBeNull();
  });

  it('delete returns false for missing key', () => {
    expect(mem.delete('nope')).toBe(false);
  });

  it('clear empties all items', () => {
    mem.write('a', '1');
    mem.write('b', '2');
    mem.clear();
    expect(mem.size).toBe(0);
  });
});

// ============================================================
// WorkingMemory
// ============================================================

describe('WorkingMemory', () => {
  let mem: WorkingMemory;

  beforeEach(() => {
    mem = new WorkingMemory(3);
  });

  it('writes and reads an item', () => {
    mem.write('ctx', 'active-mission');
    expect(mem.read('ctx')!.value).toBe('active-mission');
  });

  it('returns null for missing key', () => {
    expect(mem.read('missing')).toBeNull();
  });

  it('evicts FIFO when exceeding maxItems', () => {
    mem.write('a', '1');
    mem.write('b', '2');
    mem.write('c', '3');
    mem.write('d', '4');
    expect(mem.read('a')).toBeNull();
    expect(mem.read('b')).not.toBeNull();
    expect(mem.read('c')).not.toBeNull();
    expect(mem.read('d')).not.toBeNull();
  });

  it('overwrite does not count as new insertion for FIFO order', () => {
    mem.write('a', '1');
    mem.write('b', '2');
    mem.write('c', '3');
    mem.write('a', 'updated');
    mem.write('d', '4');
    expect(mem.read('b')).toBeNull();
    expect(mem.read('a')).not.toBeNull();
  });

  it('delete removes item and reduces size', () => {
    mem.write('k1', 'v1');
    expect(mem.delete('k1')).toBe(true);
    expect(mem.size).toBe(0);
  });

  it('clear empties everything', () => {
    mem.write('a', '1');
    mem.write('b', '2');
    mem.clear();
    expect(mem.size).toBe(0);
  });
});

// ============================================================
// LongTermMemory
// ============================================================

describe('LongTermMemory', () => {
  let storage: StorageProvider;
  let mem: LongTermMemory;

  beforeEach(() => {
    storage = storageProviderMock();
    mem = new LongTermMemory(storage);
  });

  it('writes and reads an item via storage provider', async () => {
    await mem.write('perm-key', 'persistent value');
    const item = await mem.read('perm-key');
    expect(item).not.toBeNull();
    expect(item!.value).toBe('persistent value');
  });

  it('returns null for missing key', async () => {
    expect(await mem.read('nope')).toBeNull();
  });

  it('deletes an item', async () => {
    await mem.write('k1', 'v1');
    expect(await mem.delete('k1')).toBe(true);
    expect(await mem.read('k1')).toBeNull();
  });

  it('getAll returns all stored items', async () => {
    await mem.write('a', '1');
    await mem.write('b', '2');
    const all = await mem.getAll();
    expect(all).toHaveLength(2);
  });

  it('clear removes all items', async () => {
    await mem.write('k1', 'v1');
    await mem.clear();
    expect(await mem.getAll()).toHaveLength(0);
  });
});

// ============================================================
// SemanticMemory
// ============================================================

describe('SemanticMemory', () => {
  let mem: SemanticMemory;

  beforeEach(() => {
    mem = new SemanticMemory(new KnowledgeGraph());
  });

  it('stores a fact and retrieves it', () => {
    mem.storeFact('BehaviorOS', 'supports', 'multi-agent governance');
    const facts = mem.queryFact('BehaviorOS');
    expect(facts).toHaveLength(1);
    expect(facts[0].object).toBe('multi-agent governance');
  });

  it('queries fact by predicate', () => {
    mem.storeFact('A', 'relates', 'B');
    mem.storeFact('A', 'depends', 'C');
    const results = mem.queryFact('A', 'relates');
    expect(results).toHaveLength(1);
    expect(results[0].object).toBe('B');
  });

  it('returns empty array for unknown subject', () => {
    expect(mem.queryFact('unknown')).toEqual([]);
  });

  it('getAllFacts returns all stored facts', () => {
    mem.storeFact('x', 'is', 'y');
    mem.storeFact('p', 'has', 'q');
    expect(mem.getAllFacts()).toHaveLength(2);
  });

  it('clear removes all facts', () => {
    mem.storeFact('a', 'is', 'b');
    mem.clear();
    expect(mem.getAllFacts()).toHaveLength(0);
  });
});

// ============================================================
// ProceduralMemory
// ============================================================

describe('ProceduralMemory', () => {
  let mem: ProceduralMemory;

  beforeEach(() => {
    mem = new ProceduralMemory();
  });

  it('stores and retrieves a procedure', () => {
    mem.store('deploy', ['build', 'test', 'push'], ['ci', 'production']);
    const proc = mem.retrieve('deploy');
    expect(proc).not.toBeNull();
    expect(proc!.steps).toEqual(['build', 'test', 'push']);
  });

  it('returns null for unknown procedure', () => {
    expect(mem.retrieve('nope')).toBeNull();
  });

  it('lists all procedures', () => {
    mem.store('a', ['s1'], ['tag1']);
    mem.store('b', ['s2'], ['tag2']);
    expect(mem.list()).toHaveLength(2);
  });

  it('lists procedures filtered by tag', () => {
    mem.store('deploy', ['build'], ['ci']);
    mem.store('lint', ['check'], ['ci', 'quality']);
    mem.store('docs', ['generate'], ['docs']);
    const ciProcs = mem.list('ci');
    expect(ciProcs).toHaveLength(2);
  });

  it('delete removes a procedure', () => {
    mem.store('proc', ['step1']);
    expect(mem.delete('proc')).toBe(true);
    expect(mem.retrieve('proc')).toBeNull();
  });

  it('preserves createdAt on overwrite', () => {
    mem.store('proc', ['v1']);
    const created = mem.retrieve('proc')!.createdAt;
    mem.store('proc', ['v2']);
    expect(mem.retrieve('proc')!.createdAt).toBe(created);
    expect(mem.retrieve('proc')!.steps).toEqual(['v2']);
  });

  it('clear removes all procedures', () => {
    mem.store('a', ['s1']);
    mem.store('b', ['s2']);
    mem.clear();
    expect(mem.list()).toHaveLength(0);
  });
});

// ============================================================
// EpisodicMemory
// ============================================================

describe('EpisodicMemory', () => {
  let mem: EpisodicMemory;

  beforeEach(() => {
    vi.useFakeTimers();
    mem = new EpisodicMemory();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records an episode', () => {
    const item = mem.record('agent-started', { agentId: 'a1' });
    expect(item.key).toBe('agent-started');
    expect(item.context.agentId).toBe('a1');
  });

  it('getTimeline returns episodes in chronological order', () => {
    mem.record('first', { order: 1 });
    vi.advanceTimersByTime(1000);
    mem.record('second', { order: 2 });
    vi.advanceTimersByTime(1000);
    mem.record('third', { order: 3 });
    const timeline = mem.getTimeline();
    expect(timeline).toHaveLength(3);
  });

  it('getTimeline filters by from/to', () => {
    const early = mem.record('early', {});
    vi.advanceTimersByTime(1000);
    const mid = mem.record('mid', {});
    vi.advanceTimersByTime(1000);
    mem.record('late', {});
    const from = early.timestamp;
    const to = mid.timestamp;
    const filtered = mem.getTimeline(from, to);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].label).toBe('early');
    expect(filtered[1].label).toBe('mid');
  });

  it('searchByContext filters episodes', () => {
    mem.record('login', { userId: 'u1', action: 'login' });
    mem.record('logout', { userId: 'u1', action: 'logout' });
    mem.record('signup', { userId: 'u2', action: 'signup' });
    const results = mem.searchByContext({ userId: 'u1' });
    expect(results).toHaveLength(2);
  });

  it('searchByContext returns empty when no match', () => {
    mem.record('event', { env: 'prod' });
    expect(mem.searchByContext({ env: 'dev' })).toEqual([]);
  });

  it('clear removes all episodes', () => {
    mem.record('e1', {});
    mem.record('e2', {});
    mem.clear();
    expect(mem.getAll()).toHaveLength(0);
  });
});

// ============================================================
// MemoryManager — Integration
// ============================================================

describe('MemoryManager', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
  });

  it('getByType returns items for short-term', () => {
    manager.shortTerm.write('st1', 'short value');
    const items = manager.getByType('short-term');
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('st1');
  });

  it('getByType returns items for working', () => {
    manager.working.write('wk1', 'working value');
    const items = manager.getByType('working');
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('wk1');
  });

  it('getByType returns items for semantic', () => {
    manager.semantic.storeFact('TS', 'is', 'typed');
    const items = manager.getByType('semantic');
    expect(items).toHaveLength(1);
    expect(items[0].value).toContain('typed');
  });

  it('getByType returns items for procedural', () => {
    manager.procedural.store('build', ['compile'], ['dev']);
    const items = manager.getByType('procedural');
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('build');
  });

  it('getByType returns items for episodic', () => {
    manager.episodic.record('deploy-event', { env: 'prod' });
    const items = manager.getByType('episodic');
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('deploy-event');
  });

  it('search finds across all memory types', () => {
    manager.shortTerm.write('cache-data', 'stored in cache');
    manager.working.write('active-data', 'searching data here');
    manager.semantic.storeFact('Database', 'stores', 'data');
    manager.procedural.store('data-flow', ['query', 'filter', 'data'], ['search']);
    const results = manager.search('data');
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('search filters by type', () => {
    manager.shortTerm.write('temp-data', 'temporary');
    manager.working.write('work-data', 'working');
    const results = manager.search('data', ['working']);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('working');
  });

  it('search returns empty when no match', () => {
    manager.shortTerm.write('only-key', 'only value');
    expect(manager.search('zzz_nonexistent')).toEqual([]);
  });

  it('clear empties all memory stores', () => {
    manager.shortTerm.write('a', '1');
    manager.working.write('b', '2');
    manager.semantic.storeFact('x', 'y', 'z');
    manager.procedural.store('p', ['s'], []);
    manager.episodic.record('e', {});
    manager.clear();
    expect(manager.shortTerm.size).toBe(0);
    expect(manager.working.size).toBe(0);
    expect(manager.semantic.getAllFacts()).toHaveLength(0);
    expect(manager.procedural.list()).toHaveLength(0);
    expect(manager.episodic.getAll()).toHaveLength(0);
  });
});
