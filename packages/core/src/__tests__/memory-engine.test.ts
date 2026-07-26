import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockMkdir = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockStat = vi.fn();

vi.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...(args as [string, object])),
  readFile: (...args: unknown[]) => mockReadFile(...(args as [string, string])),
  writeFile: (...args: unknown[]) => mockWriteFile(...(args as [string, string, string])),
  stat: (...args: unknown[]) => mockStat(...(args as [string])),
}));

import type { MemoryEntry } from '../engines/memory-engine';
import { MemoryEngine } from '../engines/memory-engine';

function createEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    key: 'test-key',
    value: 'test value',
    category: 'context',
    timestamp: '2026-07-20T10:00:00.000Z',
    ...overrides,
  };
}

function serializeEntries(entries: MemoryEntry[]): string {
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

describe('MemoryEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({ mtime: new Date('2026-07-20T12:00:00.000Z') });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('directory creation', () => {
    it('creates .behavioros directory if it does not exist', async () => {
      mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      await engine.readAll();

      expect(mockMkdir).toHaveBeenCalledWith('/project/.behavioros', { recursive: true });
    });

    it('creates directory on write operations', async () => {
      mockReadFile.mockResolvedValue('');

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      await engine.write(createEntry());

      expect(mockMkdir).toHaveBeenCalledWith('/project/.behavioros', { recursive: true });
    });
  });

  describe('write', () => {
    it('creates entry in correct file', async () => {
      mockReadFile.mockResolvedValue('');

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      await engine.write(createEntry({ key: 'my-decision', category: 'decision' }));

      const writtenPath = mockWriteFile.mock.calls[0][0] as string;
      expect(writtenPath.replace(/\\/g, '/')).toContain('.behavioros/decisions.md');
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('## my-decision');
    });

    it('serializes entry with timestamp and value', async () => {
      mockReadFile.mockResolvedValue('');

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      await engine.write(
        createEntry({
          key: 'arch-choice',
          value: 'Use DDD boundaries',
          category: 'architecture',
          timestamp: '2026-07-20T10:00:00.000Z',
        }),
      );

      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('## arch-choice');
      expect(writtenContent).toContain('- timestamp: 2026-07-20T10:00:00.000Z');
      expect(writtenContent).toContain('- Use DDD boundaries');
    });

    it('serializes entry with source when provided', async () => {
      mockReadFile.mockResolvedValue('');

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      await engine.write(
        createEntry({
          key: 'quality-rule',
          value: 'coverage >= 80%',
          category: 'quality',
          source: 'team-lead',
        }),
      );

      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('- source: team-lead');
    });

    it('updates existing entry with same key', async () => {
      const existing = serializeEntries([
        createEntry({ key: 'old-key', value: 'old value', category: 'context' }),
      ]);
      mockReadFile.mockResolvedValue(existing);

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      await engine.write(createEntry({ key: 'old-key', value: 'new value', category: 'context' }));

      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('## old-key');
      expect(writtenContent).toContain('- new value');
      expect(writtenContent).not.toContain('- old value');
    });
  });

  describe('writeBatch', () => {
    it('writes multiple entries across categories', async () => {
      mockReadFile.mockResolvedValue('');

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      await engine.writeBatch([
        createEntry({ key: 'entry-1', category: 'context' }),
        createEntry({ key: 'entry-2', category: 'decision' }),
      ]);

      expect(mockWriteFile).toHaveBeenCalledTimes(2);
      const paths = mockWriteFile.mock.calls.map((c) => (c[0] as string).replace(/\\/g, '/'));
      expect(paths.some((p) => p.endsWith('.behavioros/memory.md'))).toBe(true);
      expect(paths.some((p) => p.endsWith('.behavioros/decisions.md'))).toBe(true);
    });
  });

  describe('read', () => {
    it('returns entries from correct category', async () => {
      const md = serializeEntries([
        createEntry({ key: 'ctx-1', value: 'context value', category: 'context' }),
        createEntry({ key: 'ctx-2', value: 'another context', category: 'context' }),
      ]);
      mockReadFile.mockResolvedValue(md);

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const entries = await engine.read('context');

      expect(entries).toHaveLength(2);
      expect(entries[0].key).toBe('ctx-1');
      expect(entries[0].category).toBe('context');
      expect(entries[1].key).toBe('ctx-2');
    });

    it('returns empty array when file does not exist', async () => {
      mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const entries = await engine.read('governance');

      expect(entries).toEqual([]);
    });

    it('parses multi-line values correctly', async () => {
      const md = [
        '## multi-line',
        '- timestamp: 2026-07-20T10:00:00.000Z',
        '- First line of value',
        '- Second line of value',
        '- Third line of value',
        '',
      ].join('\n');
      mockReadFile.mockResolvedValue(md);

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const entries = await engine.read('context');

      expect(entries).toHaveLength(1);
      expect(entries[0].value).toBe(
        'First line of value\nSecond line of value\nThird line of value',
      );
    });
  });

  describe('readAll', () => {
    it('reads all category files', async () => {
      mockReadFile.mockResolvedValue('');

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const files = await engine.readAll();

      expect(files).toHaveLength(6);
      expect(mockReadFile).toHaveBeenCalledTimes(6);
    });

    it('returns files with empty entries for missing files', async () => {
      mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const files = await engine.readAll();

      expect(files).toHaveLength(6);
      for (const file of files) {
        expect(file.entries).toEqual([]);
      }
    });
  });

  describe('search', () => {
    it('finds entries by query in key', async () => {
      const domainMd = serializeEntries([
        createEntry({ key: 'payment-gateway', value: 'Use Stripe', category: 'domain' }),
        createEntry({ key: 'auth-provider', value: 'Use OAuth', category: 'domain' }),
      ]);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('domains.md')) return domainMd;
        return '';
      });

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const results = await engine.search('payment');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('payment-gateway');
    });

    it('finds entries by query in value', async () => {
      const archMd = serializeEntries([
        createEntry({
          key: 'tech-stack',
          value: 'React with TypeScript',
          category: 'architecture',
        }),
        createEntry({ key: 'db-choice', value: 'PostgreSQL', category: 'architecture' }),
      ]);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('architecture.md')) return archMd;
        return '';
      });

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const results = await engine.search('TypeScript');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('tech-stack');
    });

    it('searches across all categories when no category specified', async () => {
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('memory.md')) {
          return serializeEntries([
            createEntry({ key: 'ctx-1', value: 'searchable', category: 'context' }),
          ]);
        }
        if (path.includes('decisions.md')) {
          return serializeEntries([
            createEntry({ key: 'dec-1', value: 'searchable', category: 'decision' }),
          ]);
        }
        return '';
      });

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const results = await engine.search('searchable');

      expect(results).toHaveLength(2);
    });

    it('filters by category when specified', async () => {
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('memory.md')) {
          return serializeEntries([
            createEntry({ key: 'ctx-1', value: 'searchable', category: 'context' }),
          ]);
        }
        if (path.includes('decisions.md')) {
          return serializeEntries([
            createEntry({ key: 'dec-1', value: 'searchable', category: 'decision' }),
          ]);
        }
        return '';
      });

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const results = await engine.search('searchable', 'context');

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('context');
    });

    it('returns empty array when no matches found', async () => {
      mockReadFile.mockResolvedValue(
        serializeEntries([
          createEntry({ key: 'unrelated', value: 'nothing here', category: 'context' }),
        ]),
      );

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const results = await engine.search('nonexistent-query');

      expect(results).toEqual([]);
    });

    it('search is case-insensitive', async () => {
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('memory.md')) {
          return serializeEntries([
            createEntry({ key: 'MyKey', value: 'MyValue', category: 'context' }),
          ]);
        }
        return '';
      });

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const results = await engine.search('mykey');

      expect(results).toHaveLength(1);
    });
  });

  describe('getSummary', () => {
    it('calculates correct counts', async () => {
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('memory.md')) {
          return serializeEntries([
            createEntry({ key: 'c1', category: 'context' }),
            createEntry({ key: 'c2', category: 'context' }),
          ]);
        }
        if (path.includes('decisions.md')) {
          return serializeEntries([createEntry({ key: 'd1', category: 'decision' })]);
        }
        return '';
      });

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const summary = await engine.getSummary();

      expect(summary.totalEntries).toBe(3);
      expect(summary.byCategory.context).toBe(2);
      expect(summary.byCategory.decision).toBe(1);
    });

    it('returns zero total when no entries exist', async () => {
      mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const summary = await engine.getSummary();

      expect(summary.totalEntries).toBe(0);
    });
  });

  describe('exportJson / importJson', () => {
    it('export returns valid JSON string', async () => {
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('memory.md')) {
          return serializeEntries([createEntry({ key: 'e1', value: 'val1', category: 'context' })]);
        }
        if (filePath.includes('decisions.md')) {
          return serializeEntries([
            createEntry({ key: 'e2', value: 'val2', category: 'decision' }),
          ]);
        }
        return '';
      });

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const json = await engine.exportJson();

      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].key).toBe('e1');
    });

    it('import reads entries and writes them', async () => {
      mockReadFile.mockResolvedValue('');

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const entries = [
        createEntry({ key: 'imported', value: 'imported value', category: 'domain' }),
      ];
      await engine.importJson(JSON.stringify(entries));

      expect(mockWriteFile).toHaveBeenCalled();
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('## imported');
    });

    it('import throws on invalid JSON', async () => {
      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });

      await expect(engine.importJson('not valid json')).rejects.toThrow('Invalid JSON');
    });

    it('import throws on non-array JSON', async () => {
      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });

      await expect(engine.importJson('{"key": "value"}')).rejects.toThrow('expected an array');
    });

    it('export/import round-trips correctly', async () => {
      const original = [
        createEntry({ key: 'rt1', value: 'round trip 1', category: 'context' }),
        createEntry({ key: 'rt2', value: 'round trip 2', category: 'decision' }),
      ];

      mockReadFile.mockResolvedValue('');
      mockWriteFile.mockImplementation(async (_path: string, _content: string) => {});

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });

      // Export phase — populate with original content
      mockReadFile.mockResolvedValue(serializeEntries(original));
      const json = await engine.exportJson();
      const exported = JSON.parse(json);

      // Import phase — import the exported data
      mockReadFile.mockResolvedValue('');
      await engine.importJson(JSON.stringify(exported));

      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  describe('concurrent writes', () => {
    it('handles concurrent writes gracefully via lock', async () => {
      mockReadFile.mockResolvedValue('');

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });

      await Promise.all([
        engine.write(createEntry({ key: 'a', category: 'context' })),
        engine.write(createEntry({ key: 'b', category: 'decision' })),
      ]);

      // Both writes should complete
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('missing files', () => {
    it('handles missing files gracefully on read', async () => {
      mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const entries = await engine.read('governance');

      expect(entries).toEqual([]);
    });

    it('handles empty files gracefully', async () => {
      mockReadFile.mockResolvedValue('');

      const engine = new MemoryEngine({ basePath: '/project/.behavioros' });
      const entries = await engine.read('context');

      expect(entries).toEqual([]);
    });
  });

  describe('default basePath', () => {
    it('uses process.cwd() + .behavioros when no basePath provided', async () => {
      mockReadFile.mockResolvedValue('');

      const engine = new MemoryEngine();
      await engine.read('context');

      expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('.behavioros'), 'utf-8');
    });
  });
});
