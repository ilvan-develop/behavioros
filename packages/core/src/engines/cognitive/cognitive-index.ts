/**
 * IndexEntry — Configuration and options interface.
 */
export interface IndexEntry {
  id: string;
  type: 'evidence' | 'pattern' | 'fact' | 'observation' | 'hypothesis';
  key: string;
  value: unknown;
  confidence: number;
  timestamp: string;
  source: string;
}

/**
 * CognitiveIndex — cognitive index.
 *
 * Methods: index, search, getBySource, getByType, remove, clear.
 */
export class CognitiveIndex {
  private entries = new Map<string, IndexEntry>();

  index(entry: IndexEntry): void {
    this.entries.set(entry.id, { ...entry });
  }

  search(query: string, type?: string): IndexEntry[] {
    const q = query.toLowerCase();
    let results = Array.from(this.entries.values()).filter(
      (e) => e.key.toLowerCase().includes(q) || e.source.toLowerCase().includes(q),
    );
    if (type) {
      results = results.filter((e) => e.type === type);
    }
    return results;
  }

  getBySource(source: string): IndexEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.source === source);
  }

  getByType(type: string): IndexEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.type === type);
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  clear(): void {
    this.entries.clear();
  }
}
