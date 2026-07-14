import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const stats = bos.getStats();

    return NextResponse.json({
      qualityMetrics: stats.qualityMetrics,
    });
  } catch (error) {
    console.error('GET /api/quality error:', error);
    return NextResponse.json({ qualityMetrics: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { metrics } = body as {
      metrics: Array<{ name: string; value: number; unit?: string; threshold?: number }>;
    };

    if (!metrics || !Array.isArray(metrics)) {
      return NextResponse.json({ error: 'metrics array is required' }, { status: 400 });
    }

    const bos = getBehaviorOS();
    const result = await bos.evaluateQuality(
      metrics.map((m) => ({
        name: m.name,
        value: m.value,
        unit: m.unit,
        threshold: m.threshold,
      })),
    );

    return NextResponse.json({ result });
  } catch (error) {
    console.error('POST /api/quality error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to evaluate quality' },
      { status: 500 },
    );
  }
}
