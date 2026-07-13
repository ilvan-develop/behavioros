import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type DNAPackage, DNAPackageSchema } from '@behavioros/schemas';
import { parse as parseYAML } from 'yaml';

const DNA_DIR = resolve(import.meta.dirname ?? __dirname, '../../../dnas');

const MANIFEST = [
  {
    id: 'enterprise-governance',
    name: 'Enterprise Governance DNA',
    file: 'enterprise-governance.yaml',
  },
  { id: 'military-operations', name: 'Military Operations DNA', file: 'military-operations.yaml' },
  { id: 'surgical-team', name: 'Surgical Team DNA', file: 'surgical-team.yaml' },
  { id: 'lean-factory', name: 'Lean Factory DNA', file: 'lean-factory.yaml' },
] as const;

export interface DNAManifestEntry {
  id: string;
  name: string;
  file: string;
}

export function getDNAManifest(): readonly DNAManifestEntry[] {
  return MANIFEST;
}

export function loadDNA(id: string): DNAPackage {
  const entry = MANIFEST.find((m) => m.id === id);
  if (!entry) {
    throw new Error(`DNA not found: ${id}. Available: ${MANIFEST.map((m) => m.id).join(', ')}`);
  }

  const filePath = join(DNA_DIR, entry.file);
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parseYAML(raw);
  const result = DNAPackageSchema.parse(parsed);
  return result;
}

export function loadAllDNAs(): DNAPackage[] {
  return MANIFEST.map((entry) => loadDNA(entry.id));
}

export type { DNAPackage };
