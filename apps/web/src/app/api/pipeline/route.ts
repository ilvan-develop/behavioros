import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const state = bos.getPipelineState();
    const progress = bos.getPipelineProgress();
    const report = bos.getPipelineReport();

    return NextResponse.json({
      state: state ?? null,
      progress: progress ?? null,
      report: report ?? null,
    });
  } catch (error) {
    console.error('GET /api/pipeline error:', error);
    return NextResponse.json({ error: 'Failed to fetch pipeline status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body as { action?: 'start' | 'advance' | 'pause' | 'resume' };

    const bos = getBehaviorOS();

    switch (action) {
      case 'start': {
        const state = await bos.runPipeline();
        return NextResponse.json({ state });
      }
      case 'advance': {
        const result = await bos.advancePipeline();
        return NextResponse.json({ result });
      }
      case 'pause': {
        const state = bos.pausePipeline();
        return NextResponse.json({ state });
      }
      case 'resume': {
        const state = bos.resumePipeline();
        return NextResponse.json({ state });
      }
      default: {
        const state = await bos.runPipeline();
        return NextResponse.json({ state });
      }
    }
  } catch (error) {
    console.error('POST /api/pipeline error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run pipeline' },
      { status: 500 },
    );
  }
}
