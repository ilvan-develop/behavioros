import fs from 'node:fs/promises';
import path from 'node:path';
import { DNALoader } from '@behavioros/core';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DNAs_DIR = path.resolve(process.cwd(), '../../dnas');

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const loader = new DNALoader();

    const files = (await fs.readdir(DNAs_DIR)).filter(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
    );

    for (const file of files) {
      const filePath = path.join(DNAs_DIR, file);
      try {
        const dna = await loader.load(filePath);
        if (dna.id === id) {
          return NextResponse.json({ dna });
        }
      } catch {}
    }

    return NextResponse.json({ error: 'DNA not found' }, { status: 404 });
  } catch (error) {
    console.error(`GET /api/dnas/[id] error:`, error);
    return NextResponse.json({ error: 'Failed to fetch DNA' }, { status: 500 });
  }
}
