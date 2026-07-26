/**
 * PackageType — Union type: pattern, plugin, engine, skill, template;.
 */
export type PackageType = 'pattern' | 'plugin' | 'engine' | 'skill' | 'template';

/**
 * PackageVersion — Configuration and options interface.
 */
export interface PackageVersion {
  version: string;
  publishedAt: string;
  description?: string;
  dependencies?: { packageId: string; version: string }[];
  changelog?: string;
}

/**
 * PackageInfo — Configuration and options interface.
 */
export interface PackageInfo {
  id: string;
  name: string;
  type: PackageType;
  latestVersion: string;
  versions: PackageVersion[];
  author?: string;
  license?: string;
  repository?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function parseSemver(v: string): number[] {
  return v
    .replace(/^\^|~|>=?|<=?|=/, '')
    .split('.')
    .map(Number);
}

function compareVersions(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function satisfies(version: string, range: string): boolean {
  if (range === 'latest' || range === '*') return true;
  if (range.startsWith('^')) {
    const target = range.slice(1);
    const tv = parseSemver(target);
    const vv = parseSemver(version);
    if (tv.length > 0 && vv.length > 0 && tv[0] !== vv[0]) return false;
    if (tv.length > 1 && vv.length > 1 && tv[1] > vv[1]) return false;
    return compareVersions(version, target) >= 0;
  }
  if (range.startsWith('~')) {
    const target = range.slice(1);
    const tv = parseSemver(target);
    const vv = parseSemver(version);
    if (tv.length > 0 && vv.length > 0 && tv[0] !== vv[0]) return false;
    if (tv.length > 1 && vv.length > 1 && tv[1] !== vv[1]) return false;
    return compareVersions(version, target) >= 0;
  }
  if (range.startsWith('>=')) return compareVersions(version, range.slice(2)) >= 0;
  if (range.startsWith('<=')) return compareVersions(version, range.slice(2)) <= 0;
  if (range.startsWith('>')) return compareVersions(version, range.slice(1)) > 0;
  if (range.startsWith('<')) return compareVersions(version, range.slice(1)) < 0;
  return compareVersions(version, range) === 0;
}

/**
 * PublishRequest — Type definition for publishrequest.
 */
export type PublishRequest = {
  id: string;
  name: string;
  type: PackageType;
  version: string;
  author?: string;
  license?: string;
  repository?: string;
  tags?: string[];
  description?: string;
  changelog?: string;
  dependencies?: { packageId: string; version: string }[];
};

/**
 * Registry — registry.
 *
 * Methods: publish, get, search, resolveVersion, getDependencies, list, and 3 more.
 */
export class Registry {
  private packages = new Map<string, PackageInfo>();
  private deprecated = new Map<string, string>();

  publish(info: PublishRequest): void {
    const now = new Date().toISOString();
    const versionEntry: PackageVersion = {
      version: info.version,
      publishedAt: now,
      description: info.description,
      changelog: info.changelog,
      dependencies: info.dependencies,
    };

    const existing = this.packages.get(info.id);
    if (existing) {
      existing.versions.push(versionEntry);
      existing.versions.sort((a, b) => compareVersions(b.version, a.version));
      if (compareVersions(info.version, existing.latestVersion) > 0) {
        existing.latestVersion = info.version;
      }
      existing.updatedAt = now;
    } else {
      this.packages.set(info.id, {
        id: info.id,
        name: info.name,
        type: info.type,
        latestVersion: info.version,
        versions: [versionEntry],
        author: info.author,
        license: info.license,
        repository: info.repository,
        tags: info.tags ?? [],
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  get(id: string): PackageInfo | undefined {
    return this.packages.get(id);
  }

  search(query: string, options?: { type?: PackageType; tags?: string[] }): PackageInfo[] {
    const lower = query.toLowerCase();
    return Array.from(this.packages.values()).filter((pkg) => {
      if (options?.type && pkg.type !== options.type) return false;
      if (options?.tags && options.tags.length > 0) {
        const hasTag = options.tags.some((t) => pkg.tags.includes(t));
        if (!hasTag) return false;
      }
      return (
        pkg.id.toLowerCase().includes(lower) ||
        pkg.name.toLowerCase().includes(lower) ||
        pkg.tags.some((t) => t.toLowerCase().includes(lower)) ||
        pkg.author?.toLowerCase().includes(lower)
      );
    });
  }

  resolveVersion(id: string, version: string): string {
    const pkg = this.packages.get(id);
    if (!pkg) throw new Error(`Package ${id} not found`);

    if (version === 'latest') return pkg.latestVersion;

    const candidates = pkg.versions.filter((v) => satisfies(v.version, version));
    if (candidates.length === 0) throw new Error(`No version of ${id} satisfies ${version}`);
    candidates.sort((a, b) => compareVersions(b.version, a.version));
    return candidates[0].version;
  }

  getDependencies(id: string, version: string): { packageId: string; version: string }[] {
    const pkg = this.packages.get(id);
    if (!pkg) throw new Error(`Package ${id} not found`);

    const ver = pkg.versions.find((v) => v.version === version);
    if (!ver) throw new Error(`Version ${version} of ${id} not found`);

    return ver.dependencies ?? [];
  }

  list(type?: PackageType): PackageInfo[] {
    const all = Array.from(this.packages.values());
    if (type) return all.filter((p) => p.type === type);
    return all;
  }

  deprecate(id: string, reason: string): void {
    if (!this.packages.has(id)) throw new Error(`Package ${id} not found`);
    this.deprecated.set(id, reason);
  }

  isDeprecated(id: string): { deprecated: boolean; reason?: string } {
    const reason = this.deprecated.get(id);
    return reason ? { deprecated: true, reason } : { deprecated: false };
  }

  latest(id: string): string | undefined {
    return this.packages.get(id)?.latestVersion;
  }
}
