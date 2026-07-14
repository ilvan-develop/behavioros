import fs from 'node:fs';
import path from 'node:path';
import { DNALoader } from '@behavioros/core';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DNAs_DIR = path.resolve(process.cwd(), '../../dnas');

export async function GET() {
  try {
    const loader = new DNALoader();

    const files = fs.readdirSync(DNAs_DIR).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

    const packages = files.map((file) => {
      const filePath = path.join(DNAs_DIR, file);
      try {
        const dna = loader.load(filePath);
        return {
          id: dna.id,
          name: dna.name,
          version: dna.version,
          description: dna.description,
          tags: dna.tags ?? [],
          personasCount: dna.personas?.length ?? 0,
          rulesCount: dna.governance?.length ?? 0,
          qualityGatesCount: dna.quality?.length ?? 0,
          patternsCount: dna.patterns?.length ?? 0,
          workflowsCount: dna.workflows?.length ?? 0,
        };
      } catch {
        return { file, error: 'Failed to load DNA' };
      }
    });

    return NextResponse.json({
      packages,
      total: packages.length,
    });
  } catch (error) {
    console.error('GET /api/dnas error:', error);
    return NextResponse.json({ packages: [], total: 0 });
  }
}
