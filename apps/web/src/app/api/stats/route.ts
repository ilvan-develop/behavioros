import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const status = bos.getStatus();
    const stats = bos.getStats();
    const pipelineState = bos.getPipelineState();

    return NextResponse.json({
      status,
      stats,
      pipeline: pipelineState ?? null,
    });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
