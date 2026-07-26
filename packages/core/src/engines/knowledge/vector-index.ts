/**
 * VectorEntry — Configuration and options interface.
 */
export interface VectorEntry {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * SearchResult — Configuration and options interface.
 */
export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

/**
 * VectorIndex — Provides constructor, insert, remove, search, ... operations.
 */
export class VectorIndex {
  private entries: Map<string, VectorEntry> = new Map();

  constructor(private dimensions: number) {}

  insert(id: string, vector: number[], metadata?: Record<string, unknown>): void {
    this.validateVector(vector);
    const entry: VectorEntry = {
      id,
      vector,
      metadata: metadata ?? {},
      createdAt: new Date().toISOString(),
    };
    this.entries.set(id, entry);
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  search(query: number[], topK?: number): SearchResult[] {
    this.validateVector(query);
    if (this.entries.size === 0) return [];

    const results: SearchResult[] = [];
    for (const entry of this.entries.values()) {
      const score = this.cosineSimilarity(query, entry.vector);
      results.push({ id: entry.id, score, metadata: entry.metadata });
    }

    results.sort((a, b) => b.score - a.score);

    if (topK !== undefined && topK > 0) {
      return results.slice(0, topK);
    }

    return results;
  }

  update(id: string, vector: number[], metadata?: Record<string, unknown>): void {
    this.validateVector(vector);
    const existing = this.entries.get(id);
    if (!existing) {
      throw new Error(`Vector entry with id "${id}" not found`);
    }
    existing.vector = vector;
    if (metadata !== undefined) {
      existing.metadata = metadata;
    }
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  save(): string {
    const data = Array.from(this.entries.values());
    return JSON.stringify(data);
  }

  load(data: string): void {
    const parsed: VectorEntry[] = JSON.parse(data);
    const map = new Map<string, VectorEntry>();
    for (const entry of parsed) {
      this.validateVector(entry.vector);
      map.set(entry.id, entry);
    }
    this.entries = map;
  }

  get(id: string): VectorEntry | undefined {
    return this.entries.get(id);
  }

  private validateVector(vector: number[]): void {
    if (vector.length !== this.dimensions) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.dimensions}, got ${vector.length}`,
      );
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;
    return dot / magnitude;
  }
}
