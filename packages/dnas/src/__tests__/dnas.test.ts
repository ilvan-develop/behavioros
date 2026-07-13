import { DNALoader, DNAValidator } from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import { describe, expect, it } from 'vitest';
import { getDNAManifest, loadAllDNAs, loadDNA } from '../index';

const DNA_IDS = [
  'enterprise-governance',
  'military-operations',
  'surgical-team',
  'lean-factory',
] as const;

describe('DNA Catalog', () => {
  it('should return manifest with all DNAs', () => {
    const manifest = getDNAManifest();
    expect(manifest).toHaveLength(4);
    expect(manifest.map((m) => m.id)).toEqual([...DNA_IDS]);
  });

  it('should load all DNAs without error', () => {
    const dnas = loadAllDNAs();
    expect(dnas).toHaveLength(4);
  });
});

describe.each(DNA_IDS)('DNA: %s', (dnaId) => {
  let dna: DNAPackage;

  it('should load via loadDNA', () => {
    dna = loadDNA(dnaId);
    expect(dna).toBeDefined();
    expect(dna.id).toBe(dnaId);
  });

  it('should pass DNALoader schema validation', () => {
    dna = loadDNA(dnaId);
    const loader = new DNALoader({ validate: true });
    const loaded = loader.loadFromObject(dna);
    expect(loaded.id).toBe(dnaId);
  });

  it('should pass DNAValidator.validate()', () => {
    dna = loadDNA(dnaId);
    const result = DNAValidator.validate(dna);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should have required personas', () => {
    dna = loadDNA(dnaId);
    expect(dna.personas.length).toBeGreaterThanOrEqual(3);
    for (const persona of dna.personas) {
      expect(persona.role).toBeTruthy();
      expect(persona.authority).toBeTruthy();
      expect(persona.name).toBeTruthy();
    }
  });

  it('should have governance rules', () => {
    dna = loadDNA(dnaId);
    expect(dna.governance).toBeDefined();
    expect(dna.governance!.length).toBeGreaterThanOrEqual(3);
    for (const rule of dna.governance!) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(['critical', 'high', 'medium', 'low']).toContain(rule.level);
      expect(['block', 'warn', 'log', 'escalate', 'auto_approve']).toContain(rule.action);
    }
  });

  it('should have quality gates', () => {
    dna = loadDNA(dnaId);
    expect(dna.quality).toBeDefined();
    expect(dna.quality!.length).toBeGreaterThanOrEqual(3);
    for (const gate of dna.quality!) {
      expect(gate.id).toBeTruthy();
      expect(gate.name).toBeTruthy();
      expect(gate.type).toBeTruthy();
    }
  });

  it('should have behavior patterns', () => {
    dna = loadDNA(dnaId);
    expect(dna.patterns).toBeDefined();
    expect(dna.patterns!.length).toBeGreaterThanOrEqual(3);
    for (const pattern of dna.patterns!) {
      expect(pattern.id).toBeTruthy();
      expect(pattern.name).toBeTruthy();
      expect(pattern.type).toBeTruthy();
      expect(pattern.triggers!.length).toBeGreaterThan(0);
      expect(pattern.actions!.length).toBeGreaterThan(0);
    }
  });

  it('should have workflows', () => {
    dna = loadDNA(dnaId);
    expect(dna.workflows).toBeDefined();
    expect(dna.workflows!.length).toBeGreaterThanOrEqual(3);
    for (const step of dna.workflows!) {
      expect(step.id).toBeTruthy();
      expect(step.name).toBeTruthy();
      expect(step.type).toBeTruthy();
    }
  });
});

describe('Individual DNA specifics', () => {
  it('military-operations should have commander persona at c-level', () => {
    const dna = loadDNA('military-operations');
    const commander = dna.personas.find((p) => p.name === 'Commander');
    expect(commander).toBeDefined();
    expect(commander!.authority).toBe('c-level');
  });

  it('surgical-team should have lead surgeon as architect', () => {
    const dna = loadDNA('surgical-team');
    const lead = dna.personas.find((p) => p.name === 'Lead Surgeon');
    expect(lead).toBeDefined();
    expect(lead!.role).toBe('architect');
  });

  it('lean-factory should have continuous improvement lead as architect', () => {
    const dna = loadDNA('lean-factory');
    const ciLead = dna.personas.find((p) => p.name === 'Continuous Improvement Lead');
    expect(ciLead).toBeDefined();
    expect(ciLead!.role).toBe('architect');
  });

  it('all DNAs should have unique IDs across the catalog', () => {
    const dnas = loadAllDNAs();
    const ids = dnas.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
