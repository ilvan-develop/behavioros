import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const sdkMissions = bos.getAllMissions();

    return NextResponse.json({
      missions: sdkMissions,
      total: sdkMissions.length,
    });
  } catch (error) {
    console.error('GET /api/missions error:', error);
    return NextResponse.json({ missions: [], total: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, type, priority } = body as {
      title: string;
      description?: string;
      type: 'feature' | 'bugfix' | 'refactor' | 'research' | 'incident' | 'experiment' | 'custom';
      priority?: 'critical' | 'high' | 'medium' | 'low';
    };

    if (!title || !type) {
      return NextResponse.json({ error: 'title and type are required' }, { status: 400 });
    }

    const bos = getBehaviorOS();
    const mission = await bos.createMission({ title, description, type, priority });

    return NextResponse.json({ mission }, { status: 201 });
  } catch (error) {
    console.error('POST /api/missions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create mission' },
      { status: 500 },
    );
  }
}
