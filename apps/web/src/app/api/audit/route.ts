import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const stats = bos.getStats();

    return NextResponse.json({
      auditEvents: stats.auditEvents,
    });
  } catch (error) {
    console.error('GET /api/audit error:', error);
    return NextResponse.json({ auditEvents: 0 });
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
