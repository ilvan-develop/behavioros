import { randomUUID } from 'node:crypto';

/**
 * CatalogEntry — Configuration and options interface.
 */
export interface CatalogEntry {
  id: string;
  capabilityId: string;
  name: string;
  description: string;
  tags: string[];
  provider: string;
  version: string;
  rating: number;
  createdAt: string;
}

/**
 * CapabilityCatalog — capability catalog.
 *
 * Methods: add, search, filter, get, compare.
 */
export class CapabilityCatalog {
  private entries = new Map<string, CatalogEntry>();

  add(entry: Omit<CatalogEntry, 'id' | 'createdAt' | 'rating'>): string {
    const id = randomUUID();
    const catalogEntry: CatalogEntry = {
      ...entry,
      id,
      rating: 0,
      createdAt: new Date().toISOString(),
    };
    this.entries.set(id, catalogEntry);
    return id;
  }

  search(query: string): CatalogEntry[] {
    const lower = query.toLowerCase();
    const results: CatalogEntry[] = [];
    for (const entry of this.entries.values()) {
      if (
        entry.name.toLowerCase().includes(lower) ||
        entry.description.toLowerCase().includes(lower) ||
        entry.capabilityId.toLowerCase().includes(lower) ||
        entry.tags.some((t) => t.toLowerCase().includes(lower))
      ) {
        results.push(entry);
      }
    }
    return results;
  }

  filter(tags?: string[], provider?: string): CatalogEntry[] {
    const results: CatalogEntry[] = [];
    for (const entry of this.entries.values()) {
      if (tags && tags.length > 0) {
        const hasTags = tags.every((t) => entry.tags.includes(t));
        if (!hasTags) continue;
      }
      if (provider && entry.provider !== provider) continue;
      results.push(entry);
    }
    return results;
  }

  get(id: string): CatalogEntry | undefined {
    return this.entries.get(id);
  }

  compare(ids: string[]): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];
    for (const id of ids) {
      const entry = this.entries.get(id);
      if (entry) {
        results.push({
          id: entry.id,
          capabilityId: entry.capabilityId,
          name: entry.name,
          provider: entry.provider,
          version: entry.version,
          rating: entry.rating,
          tags: entry.tags,
        });
      }
    }
    return results;
  }
}
