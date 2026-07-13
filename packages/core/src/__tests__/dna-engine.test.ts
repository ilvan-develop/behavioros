import type { DNAPackage } from '@behavioros/schemas';
import { describe, expect, it } from 'vitest';
import { DNAComposer } from '../engines/behavioral/dna-composer';
import { DNALoader } from '../engines/behavioral/dna-loader';
import { DNAValidator } from '../engines/behavioral/dna-validator';

// ============================================================
// DNA Engine Tests
// ============================================================

const createTestDNA = (id: string): DNAPackage => ({
  id,
  name: `Test DNA ${id}`,
  version: '1.0.0',
  description: `Test DNA package ${id}`,
  author: 'Test',
  personas: [
    { role: 'engineer', authority: 'senior', name: `Engineer ${id}` },
    { role: 'qa', authority: 'senior', name: `QA ${id}` },
  ],
  governance: [{ id: `${id}-rule`, name: `Rule ${id}`, level: 'medium', action: 'warn' }],
  quality: [{ id: `${id}-coverage`, name: `Coverage ${id}`, type: 'test_coverage', threshold: 80 }],
  patterns: [
    {
      id: `${id}-pattern`,
      name: `Pattern ${id}`,
      type: 'collaboration',
      triggers: ['agent:engineer'],
      actions: ['code'],
    },
  ],
});

describe('DNALoader', () => {
  it('should load DNA from string', () => {
    const loader = new DNALoader({ validate: true });
    const yaml = `
id: test-load
name: Test Load
version: '1.0.0'
personas:
  - role: engineer
    authority: senior
`;
    const dna = loader.loadFromString(yaml);
    expect(dna.id).toBe('test-load');
    expect(dna.personas).toHaveLength(1);
  });

  it('should validate DNA package', () => {
    const dna = createTestDNA('validate');
    const result = DNALoader.validate(dna);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should merge DNA packages', () => {
    const base = createTestDNA('base');
    const override = { name: 'Overridden Name', description: 'Overridden' };
    const merged = DNALoader.merge(base, override);
    expect(merged.name).toBe('Overridden Name');
    expect(merged.personas).toHaveLength(2);
  });
});

describe('DNAValidator', () => {
  it('should validate complete DNA', () => {
    const dna = createTestDNA('complete');
    const result = DNAValidator.validate(dna);
    expect(result.valid).toBe(true);
  });

  it('should detect missing personas', () => {
    const dna = createTestDNA('no-personas');
    dna.personas = [];
    const result = DNAValidator.validate(dna);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DNA_NO_PERSONAS')).toBe(true);
  });

  it('should detect duplicate governance IDs', () => {
    const dna = createTestDNA('dup-gov');
    dna.governance?.push({ id: 'dup-gov-rule', name: 'Duplicate', level: 'low', action: 'log' });
    const result = DNAValidator.validate(dna);
    expect(result.errors.some((e) => e.code === 'DNA_DUPLICATE_GOVERNANCE_ID')).toBe(true);
  });

  it('should warn about missing description', () => {
    const dna = createTestDNA('no-desc');
    dna.description = undefined;
    const result = DNAValidator.validate(dna);
    expect(result.warnings.some((w) => w.code === 'DNA_NO_DESCRIPTION')).toBe(true);
  });
});

describe('DNAComposer', () => {
  it('should compose multiple DNAs', () => {
    const composer = new DNAComposer();
    const dna1 = createTestDNA('dna1');
    const dna2 = createTestDNA('dna2');

    const result = composer.compose([dna1, dna2]);
    expect(result.patterns.length).toBeGreaterThanOrEqual(2);
    expect(result.metadata.sourceDNAs).toContain('dna1');
    expect(result.metadata.sourceDNAs).toContain('dna2');
  });

  it('should detect conflicts', () => {
    const composer = new DNAComposer();
    const dna1 = createTestDNA('shared');
    const dna2 = createTestDNA('shared');

    const result = composer.compose([dna1, dna2]);
    expect(result.metadata.conflicts.length).toBeGreaterThan(0);
  });

  it('should filter by type', () => {
    const composer = new DNAComposer();
    const patterns = [
      { id: 'a', name: 'A', type: 'collaboration' as const, triggers: [], actions: [] },
      { id: 'b', name: 'B', type: 'review' as const, triggers: [], actions: [] },
      { id: 'c', name: 'C', type: 'collaboration' as const, triggers: [], actions: [] },
    ];

    const filtered = composer.filterByType(patterns, 'collaboration');
    expect(filtered).toHaveLength(2);
  });

  it('should sort by priority', () => {
    const composer = new DNAComposer();
    const patterns = [
      { id: 'a', name: 'A', type: 'learning' as const, triggers: [], actions: [] },
      { id: 'b', name: 'B', type: 'decision' as const, triggers: [], actions: [] },
      { id: 'c', name: 'C', type: 'escalation' as const, triggers: [], actions: [] },
    ];

    const sorted = composer.sortByPriority(patterns);
    expect(sorted[0].type).toBe('decision');
    expect(sorted[1].type).toBe('escalation');
    expect(sorted[2].type).toBe('learning');
  });
});
