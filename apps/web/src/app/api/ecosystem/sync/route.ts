import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source } = body as { source?: string };

    // Simulate syncing components from external sources
    const syncResult = {
      success: true,
      source: source ?? 'all',
      syncedAt: new Date().toISOString(),
      skillsFound: 12,
      mcpsFound: 5,
      newSkills: 2,
      newMCPs: 1,
      updatedSkills: 3,
      updatedMCPs: 1,
      message: source
        ? `Synced from ${source}: 2 new skills, 1 new MCP`
        : 'Full sync complete: 2 new skills, 1 new MCP, 4 updates',
    };

    return NextResponse.json(syncResult);
  } catch (error) {
    console.error('POST /api/ecosystem/sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 },
    );
  }
}
