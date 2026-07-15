import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bos = getBehaviorOS();
    const mission = bos.getMission(id);

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    return NextResponse.json({ mission });
  } catch (error) {
    console.error('GET /api/missions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch mission' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, output } = body as {
      action?: 'start' | 'complete' | 'fail';
      output?: Record<string, unknown>;
    };

    const bos = getBehaviorOS();
    const mission = bos.getMission(id);

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    let updated: Awaited<ReturnType<typeof bos.startMission>> | undefined;
    switch (action) {
      case 'start':
        updated = await bos.startMission(id);
        break;
      case 'complete':
        updated = await bos.completeMission(id, output);
        break;
      case 'fail':
        updated = await bos.failMission(
          id,
          new Error((output?.message as string) || 'Mission failed'),
        );
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, complete, fail' },
          { status: 400 },
        );
    }

    return NextResponse.json({ mission: updated });
  } catch (error) {
    console.error('PATCH /api/missions/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update mission' },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bos = getBehaviorOS();
    const mission = bos.getMission(id);

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // SDK doesn't have delete — fail it to remove from active
    if (mission.status !== 'failed' && mission.status !== 'completed') {
      await bos.failMission(id, new Error('Mission deleted'));
    }

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error('DELETE /api/missions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete mission' }, { status: 500 });
  }
}
