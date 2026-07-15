import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';
import { seedAuditEvents } from '@/lib/seed-data';
import type { AuditEvent } from '@/types';

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PipelineResult = {
  id: string;
  stages: any[];
  timestamp: string;
  overall: string;
  score: number;
};

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const history = bos.getAuditHistory() as unknown as PipelineResult[];

    let events: AuditEvent[];
    if (history.length > 0) {
      events = history.flatMap((result) =>
        (result.stages ?? []).flatMap(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (stage: any) =>
            (stage.events ?? []).map((event: any) => ({
              id: event.id ?? crypto.randomUUID(),
              timestamp: event.timestamp ?? result.timestamp ?? new Date().toISOString(),
              type: `${result.id}/${stage.stage}`,
              severity: event.severity ?? 'info',
              result: event.result ?? 'pass',
              description:
                event.description ?? `Stage ${stage.stage}: ${stage.result ?? 'unknown'}`,
              agent: event.agentId,
              mission: event.missionId,
            })),
        ),
      );
    } else {
      events = seedAuditEvents;
    }

    return NextResponse.json({ auditEvents: events });
  } catch (error) {
    console.error('GET /api/audit error:', error);
    return NextResponse.json({ auditEvents: seedAuditEvents });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectPath, stages } = body as {
      projectPath?: string;
      stages?: string[];
    };

    const bos = getBehaviorOS();
    const auditStages = stages as 'static'[] | undefined;

    const result = await bos.runAudit(projectPath ?? process.cwd(), auditStages);

    return NextResponse.json({ result });
  } catch (error) {
    console.error('POST /api/audit error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run audit' },
      { status: 500 },
    );
  }
}
