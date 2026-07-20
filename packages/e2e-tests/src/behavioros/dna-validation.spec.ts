import { test, expect } from '@playwright/test';
import { DNALoader, DNAValidator } from '@behavioros/core';
import { resolve } from 'node:path';
import type { DNAPackage } from '@behavioros/schemas';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');

test.describe('DNA Validation', () => {
  test('loads a valid DNA YAML from the enterprise-governance file', async () => {
    const loader = new DNALoader({ validate: true, basePath: REPO_ROOT });
    const dna = await loader.load(
      'dnas/enterprise-governance.yaml',
    );

    expect(dna).toBeDefined();
    expect(dna.id).toBe('enterprise-governance');
    expect(dna.name).toBe('Enterprise Governance DNA');
    expect(dna.personas.length).toBeGreaterThanOrEqual(1);
    expect(dna.governance).toBeDefined();
    expect(dna.governance!.length).toBeGreaterThan(0);

    const validation = DNAValidator.validate(dna);
    expect(validation.valid).toBe(true);
  });

  test('rejects invalid DNA with missing required fields', () => {
    const invalidDNA = {
      id: 'invalid-dna',
      name: 'Invalid',
      version: '1.0.0',
      personas: [],
      governance: [],
    };

    const validation = DNAValidator.validate(invalidDNA as DNAPackage);
    expect(validation.valid).toBe(false);

    const hasPersonaError = validation.errors.some(
      (e) => e.code === 'DNA_NO_PERSONAS',
    );
    expect(hasPersonaError).toBe(true);
  });
});
