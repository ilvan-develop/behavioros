import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';
import { seedLearningReport } from '@/lib/seed-data';
import type { LearningReport } from '@/types';

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SdkLearningReport = Record<string, any>;

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const sdkReport = (
      bos as unknown as { getLearningReport: () => SdkLearningReport }
    ).getLearningReport?.() as SdkLearningReport | undefined;

    if (sdkReport && sdkReport.totalEvents > 0) {
      const report: LearningReport = {
        totalEvents: sdkReport.totalEvents,
        appliedCount: sdkReport.appliedCount,
        pendingCount: sdkReport.pendingCount,
        trends: (sdkReport.trends ?? []).map(
          (t: { type: string; direction: string; periodCount: number }) => ({
            type: t.type as LearningReport['trends'][number]['type'],
            count: t.periodCount ?? 0,
            trend:
              t.direction === 'increasing'
                ? ('up' as const)
                : t.direction === 'decreasing'
                  ? ('down' as const)
                  : ('stable' as const),
          }),
        ),
        patterns: (sdkReport.insights ?? []).map(
          (i: {
            id: string;
            category: string;
            description: string;
            confidence: number;
            occurrences: number;
            lastDetected: string;
            suggestedAction?: string;
          }) => ({
            id: i.id,
            type: i.category ?? 'auto-detect',
            description: i.description,
            confidence: i.confidence,
            events: i.occurrences,
            firstDetected: i.lastDetected,
            lastDetected: i.lastDetected,
            suggestedAction: i.suggestedAction,
          }),
        ),
        recentEvents: [],
        anomalies: (sdkReport.anomalies ?? []).map(
          (a: { type: string; detectedAt: string; multiplier: number }) => ({
            id: `${a.type}-${a.detectedAt}`,
            description: `Anomaly detected: ${a.type} (${Math.round(a.multiplier * 100)}% above baseline)`,
            severity:
              a.multiplier > 3
                ? ('critical' as const)
                : a.multiplier > 2
                  ? ('high' as const)
                  : ('medium' as const),
            timestamp: a.detectedAt,
          }),
        ),
      };
      return NextResponse.json(report);
    }

    return NextResponse.json(seedLearningReport);
  } catch {
    return NextResponse.json(seedLearningReport);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, source, content, impact } = body as {
      type: string;
      source: string;
      content: string;
      impact?: string;
    };

    if (!type || !source || !content) {
      return NextResponse.json(
        { error: 'type, source, and content are required' },
        { status: 400 },
      );
    }

    const bos = getBehaviorOS();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = await (bos as any).recordLearning({
      type: type as 'observation' | 'pattern' | 'insight' | 'feedback' | 'correction',
      source,
      data: { content, impact: impact ?? 'medium' },
      confidence: 0.8,
      applied: false,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record learning event' },
      { status: 500 },
    );
  }
}
