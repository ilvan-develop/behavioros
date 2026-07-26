import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// ============================================================
// Types
// ============================================================

/**
 * MemoryEntry — Configuration and options interface.
 */
export interface MemoryEntry {
  key: string;
  value: string;
  category: 'context' | 'decision' | 'domain' | 'architecture' | 'quality' | 'governance';
  timestamp: string;
  source?: string;
}

/**
 * MemoryFile — Configuration and options interface.
 */
export interface MemoryFile {
  path: string;
  entries: MemoryEntry[];
  lastModified: string;
}

/**
 * MemoryEngineOptions — Configuration and options interface.
 */
export interface MemoryEngineOptions {
  basePath?: string;
}

// ============================================================
// Constants
// ============================================================

const CATEGORY_FILES: Record<MemoryEntry['category'], string> = {
  context: 'memory.md',
  decision: 'decisions.md',
  domain: 'domains.md',
  architecture: 'architecture.md',
  quality: 'quality.md',
  governance: 'governance.md',
};

const CATEGORY_ORDER: MemoryEntry['category'][] = [
  'context',
  'decision',
  'domain',
  'architecture',
  'quality',
  'governance',
];

// ============================================================
// Memory Engine
// ============================================================

/**
 * MemoryEngine — Persistent memory management for agent context.
 *
 * Stores and retrieves categorized memory entries (context, decisions, domain,
 * architecture, quality, governance) as Markdown files on disk. Provides
 * read, write, batch, search, import/export, and summary operations.
 */
export class MemoryEngine {
  private basePath: string;
  private writeLock: Promise<void> = Promise.resolve();

  /**
   * Creates a MemoryEngine with an optional base path for storage.
   *
   * @param options - Configuration options (basePath defaults to .behavioros/)
   */
  constructor(options?: MemoryEngineOptions) {
    this.basePath = options?.basePath ?? join(process.cwd(), '.behavioros');
  }

  // ----------------------------------------------------------
  // Read operations
  // ----------------------------------------------------------

  /**
   * Reads all memory entries across all categories.
   *
   * @returns Array of MemoryFile objects, one per category
   */
  async readAll(): Promise<MemoryFile[]> {
    await this.ensureDirectory();
    const files: MemoryFile[] = [];

    for (const category of CATEGORY_ORDER) {
      const fileName = CATEGORY_FILES[category];
      const filePath = join(this.basePath, fileName);
      try {
        const content = await readFile(filePath, 'utf-8');
        const stat = await import('node:fs/promises').then((fs) => fs.stat(filePath));
        files.push({
          path: filePath,
          entries: this.parseMarkdown(content, category),
          lastModified: stat.mtime.toISOString(),
        });
      } catch {
        files.push({
          path: filePath,
          entries: [],
          lastModified: new Date(0).toISOString(),
        });
      }
    }

    return files;
  }

  /**
   * Reads all memory entries for a specific category.
   *
   * @param category - The category to read (context, decision, domain, etc.)
   * @returns Array of MemoryEntry objects for that category
   */
  async read(category: MemoryEntry['category']): Promise<MemoryEntry[]> {
    await this.ensureDirectory();
    const filePath = join(this.basePath, CATEGORY_FILES[category]);

    try {
      const content = await readFile(filePath, 'utf-8');
      return this.parseMarkdown(content, category);
    } catch {
      return [];
    }
  }

  // ----------------------------------------------------------
  // Write operations
  // ----------------------------------------------------------

  /**
   * Writes a single memory entry, upserting by key.
   *
   * @param entry - The memory entry to write
   */
  async write(entry: MemoryEntry): Promise<void> {
    await this.ensureDirectory();
    await this.withLock(async () => {
      const entries = await this.read(entry.category);

      const existingIndex = entries.findIndex((e) => e.key === entry.key);
      if (existingIndex >= 0) {
        entries[existingIndex] = { ...entries[existingIndex], ...entry };
      } else {
        entries.push(entry);
      }

      await this.writeCategoryFile(entry.category, entries);
    });
  }

  /**
   * Writes multiple memory entries atomically, grouped by category.
   *
   * @param entries - Array of memory entries to write
   */
  async writeBatch(entries: MemoryEntry[]): Promise<void> {
    await this.ensureDirectory();
    await this.withLock(async () => {
      const grouped = new Map<MemoryEntry['category'], MemoryEntry[]>();

      for (const entry of entries) {
        if (!grouped.has(entry.category)) {
          grouped.set(entry.category, await this.read(entry.category));
        }
        const categoryEntries = grouped.get(entry.category)!;
        const existingIndex = categoryEntries.findIndex((e) => e.key === entry.key);

        if (existingIndex >= 0) {
          categoryEntries[existingIndex] = { ...categoryEntries[existingIndex], ...entry };
        } else {
          categoryEntries.push(entry);
        }
      }

      for (const [category, catEntries] of grouped) {
        await this.writeCategoryFile(category, catEntries);
      }
    });
  }

  // ----------------------------------------------------------
  // Search
  // ----------------------------------------------------------

  /**
   * Searches memory entries by keyword across categories.
   *
   * @param query - The search query string
   * @param category - Optional category to restrict the search to
   * @returns Array of matching MemoryEntry objects
   */
  async search(query: string, category?: MemoryEntry['category']): Promise<MemoryEntry[]> {
    const categories = category ? [category] : CATEGORY_ORDER;
    const results: MemoryEntry[] = [];
    const lowerQuery = query.toLowerCase();

    for (const cat of categories) {
      const entries = await this.read(cat);
      for (const entry of entries) {
        if (
          entry.key.toLowerCase().includes(lowerQuery) ||
          entry.value.toLowerCase().includes(lowerQuery)
        ) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  // ----------------------------------------------------------
  // Summary
  // ----------------------------------------------------------

  /**
   * Returns a summary of all stored memory entries.
   *
   * @returns Object with totalEntries count, byCategory breakdown, and lastUpdated timestamp
   */
  async getSummary(): Promise<{
    totalEntries: number;
    byCategory: Record<string, number>;
    lastUpdated: string;
  }> {
    const files = await this.readAll();
    const byCategory: Record<string, number> = {};
    let totalEntries = 0;
    let lastUpdated = new Date(0).toISOString();

    for (const file of files) {
      const count = file.entries.length;
      const category = this.categoryFromPath(file.path);
      byCategory[category] = count;
      totalEntries += count;

      if (file.lastModified > lastUpdated && count > 0) {
        lastUpdated = file.lastModified;
      }
    }

    return { totalEntries, byCategory, lastUpdated };
  }

  // ----------------------------------------------------------
  // Import / Export
  // ----------------------------------------------------------

  /**
   * Exports all memory entries as a JSON string.
   *
   * @returns JSON string of all MemoryEntry objects
   */
  async exportJson(): Promise<string> {
    const files = await this.readAll();
    const allEntries: MemoryEntry[] = [];
    for (const file of files) {
      allEntries.push(...file.entries);
    }
    return JSON.stringify(allEntries, null, 2);
  }

  /**
   * Imports memory entries from a JSON string.
   *
   * @param json - JSON string containing an array of MemoryEntry objects
   * @throws If the JSON is invalid or not an array
   */
  async importJson(json: string): Promise<void> {
    let entries: MemoryEntry[];
    try {
      entries = JSON.parse(json);
    } catch {
      throw new Error('Invalid JSON: unable to parse memory import data');
    }

    if (!Array.isArray(entries)) {
      throw new Error('Invalid memory import: expected an array of entries');
    }

    await this.writeBatch(entries);
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private async ensureDirectory(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
  }

  private parseMarkdown(content: string, category: MemoryEntry['category']): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const sections = content.split(/^## /m).filter(Boolean);

    for (const section of sections) {
      const lines = section.split('\n');
      const key = lines[0]?.trim();
      if (!key) continue;

      const valueLines: string[] = [];
      let timestamp = '';
      let source: string | undefined;

      for (const line of lines.slice(1)) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- timestamp:')) {
          timestamp = trimmed.slice('- timestamp:'.length).trim();
        } else if (trimmed.startsWith('- source:')) {
          source = trimmed.slice('- source:'.length).trim();
        } else if (
          trimmed.startsWith('- ') &&
          !trimmed.startsWith('- timestamp:') &&
          !trimmed.startsWith('- source:')
        ) {
          valueLines.push(trimmed.slice(2));
        }
      }

      entries.push({
        key,
        value: valueLines.join('\n'),
        category,
        timestamp: timestamp || new Date().toISOString(),
        source,
      });
    }

    return entries;
  }

  private serializeMarkdown(entries: MemoryEntry[]): string {
    const lines: string[] = [];

    for (const entry of entries) {
      lines.push(`## ${entry.key}`);
      if (entry.timestamp) {
        lines.push(`- timestamp: ${entry.timestamp}`);
      }
      if (entry.source) {
        lines.push(`- source: ${entry.source}`);
      }
      if (entry.value) {
        for (const valueLine of entry.value.split('\n')) {
          lines.push(`- ${valueLine}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private async writeCategoryFile(
    category: MemoryEntry['category'],
    entries: MemoryEntry[],
  ): Promise<void> {
    const filePath = join(this.basePath, CATEGORY_FILES[category]);
    const content = this.serializeMarkdown(entries);
    await writeFile(filePath, content, 'utf-8');
  }

  private categoryFromPath(filePath: string): string {
    const fileName = filePath.split(/[/\\]/).pop() ?? '';
    for (const [category, file] of Object.entries(CATEGORY_FILES)) {
      if (file === fileName) return category;
    }
    return 'unknown';
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.writeLock;
    let resolve!: (value: undefined) => void;
    this.writeLock = new Promise<void>((r) => {
      resolve = r;
    });
    await prev;
    try {
      return await fn();
    } finally {
      resolve(undefined);
    }
  }
}
