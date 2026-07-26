/**
 * MarketplaceEntry — Configuration and options interface.
 */
export interface MarketplaceEntry {
  id: string;
  capabilityId: string;
  publisher: string;
  version: string;
  rating: number;
  downloads: number;
  publishedAt: string;
  tags: string[];
  description: string;
}

/**
 * MarketplaceInstallation — Configuration and options interface.
 */
export interface MarketplaceInstallation {
  id: string;
  entryId: string;
  installedAt: string;
  status: 'installed' | 'failed' | 'pending';
  error?: string;
}

/**
 * CapabilityMarketplace — capability marketplace.
 *
 * Methods: publish, install, uninstall, search, getEntry, getInstallations, rate, resolveDependencies.
 */
export class CapabilityMarketplace {
  private entries = new Map<string, MarketplaceEntry>();
  private installations = new Map<string, MarketplaceInstallation>();
  private ratings = new Map<string, number[]>();

  publish(capabilityId: string, publisher: string, description: string, tags?: string[]): string {
    const id = `entry-${crypto.randomUUID()}`;
    const entry: MarketplaceEntry = {
      id,
      capabilityId,
      publisher,
      version: '1.0.0',
      rating: 0,
      downloads: 0,
      publishedAt: new Date().toISOString(),
      tags: tags ?? [],
      description,
    };
    this.entries.set(id, entry);
    return id;
  }

  install(entryId: string): MarketplaceInstallation {
    const entry = this.entries.get(entryId);
    if (!entry) throw new Error(`Entry '${entryId}' not found`);
    const id = `install-${crypto.randomUUID()}`;
    const installation: MarketplaceInstallation = {
      id,
      entryId,
      installedAt: new Date().toISOString(),
      status: 'installed',
    };
    entry.downloads++;
    this.installations.set(id, installation);
    return installation;
  }

  uninstall(installationId: string): void {
    if (!this.installations.has(installationId)) {
      throw new Error(`Installation '${installationId}' not found`);
    }
    this.installations.delete(installationId);
  }

  search(query: string): MarketplaceEntry[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (e) =>
        e.description.toLowerCase().includes(lower) ||
        e.publisher.toLowerCase().includes(lower) ||
        e.tags.some((t) => t.toLowerCase().includes(lower)) ||
        e.capabilityId.toLowerCase().includes(lower),
    );
  }

  getEntry(id: string): MarketplaceEntry | undefined {
    return this.entries.get(id);
  }

  getInstallations(): MarketplaceInstallation[] {
    return Array.from(this.installations.values());
  }

  rate(entryId: string, rating: number): void {
    if (rating < 0 || rating > 5) throw new Error('Rating must be between 0 and 5');
    const entry = this.entries.get(entryId);
    if (!entry) throw new Error(`Entry '${entryId}' not found`);
    this.ratings.set(entryId, [...(this.ratings.get(entryId) ?? []), rating]);
    const all = this.ratings.get(entryId)!;
    entry.rating = all.reduce((a, b) => a + b, 0) / all.length;
  }

  resolveDependencies(entryId: string): string[] {
    const entry = this.entries.get(entryId);
    if (!entry) throw new Error(`Entry '${entryId}' not found`);
    return [entry.capabilityId];
  }

  private getAll(): MarketplaceEntry[] {
    return Array.from(this.entries.values());
  }
}
