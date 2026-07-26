import type { CapabilityMarketplace, MarketplaceEntry } from './capability-marketplace';

/**
 * SemanticSearchResult — Configuration and options interface.
 */
export interface SemanticSearchResult {
  entry: MarketplaceEntry;
  similarity: number;
  matchedTags: string[];
}

/**
 * SemanticRegistry — semantic registry.
 *
 * Methods: searchBySimilarity, searchByTags, searchByProvider, compare.
 */
export class SemanticRegistry {
  constructor(private marketplace: CapabilityMarketplace) {}

  searchBySimilarity(query: string, minSimilarity = 0): SemanticSearchResult[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const results: SemanticSearchResult[] = [];

    for (const entry of this.marketplace.search(query)) {
      const entryTokens = this.tokenize(
        `${entry.description} ${entry.capabilityId} ${entry.publisher} ${entry.tags.join(' ')}`,
      );
      const similarity = this.jaccardSimilarity(queryTokens, entryTokens);
      if (similarity >= minSimilarity) {
        const matchedTags = entry.tags.filter((t) =>
          queryTokens.some((qt) => t.toLowerCase().includes(qt)),
        );
        results.push({ entry, similarity, matchedTags });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }

  private jaccardSimilarity(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  searchByTags(tags: string[]): MarketplaceEntry[] {
    const lower = tags.map((t) => t.toLowerCase());
    return this.marketplace
      .search('')
      .filter((e) => e.tags.some((t) => lower.includes(t.toLowerCase())));
  }

  searchByProvider(provider: string): MarketplaceEntry[] {
    return this.marketplace.search(provider);
  }

  compare(capabilityIds: string[]): Record<string, MarketplaceEntry[]> {
    const groups: Record<string, MarketplaceEntry[]> = {};
    for (const entry of this.marketplace.search('')) {
      if (capabilityIds.includes(entry.capabilityId)) {
        const key = entry.tags[0] ?? 'uncategorized';
        if (!groups[key]) groups[key] = [];
        groups[key].push(entry);
      }
    }
    return groups;
  }
}
