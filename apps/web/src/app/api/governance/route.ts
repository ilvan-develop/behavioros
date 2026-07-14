import path from 'node:path';
import { DNALoader } from '@behavioros/core';
import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';

export const dynamic = 'force-dynamic';

const DNA_PATH = path.resolve(process.cwd(), '../../dnas/enterprise-governance.yaml');

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const status = bos.getStatus();

    let sdkRules: Array<{
      id: string;
      name: string;
      description: string;
      level: string;
      action: string;
      conditions: string[];
      scope: string;
      enabled: boolean;
      createdAt: string;
    }> = [];

    if (status.dna) {
      try {
        const loader = new DNALoader();
        const dna = loader.load(DNA_PATH);
        sdkRules = (dna.governance ?? []).map((rule: any) => ({
          id: rule.id,
          name: rule.name,
          description: rule.description ?? '',
          level: String(rule.level),
          action: String(rule.action),
          conditions: rule.conditions ?? [],
          scope: (rule.scope ?? []).join(', ') || 'global',
          enabled: true,
          createdAt: new Date().toISOString(),
        }));
      } catch {
        // DNA file not available — return empty rules
      }
    }

    return NextResponse.json({
      rules: sdkRules,
      dnaLoaded: !!status.dna,
      dnaName: status.dna,
    });
  } catch (error) {
    console.error('GET /api/governance error:', error);
    return NextResponse.json({ rules: [], dnaLoaded: false });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, context } = body as {
      action: string;
      context?: Record<string, unknown>;
    };

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const bos = getBehaviorOS();
    const result = await bos.evaluateGovernance(action, context ?? {});

    return NextResponse.json({ result });
  } catch (error) {
    console.error('POST /api/governance error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to evaluate governance' },
      { status: 500 },
    );
  }
}
