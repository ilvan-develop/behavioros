import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const sdkAgents = bos.getAllAgents();

    return NextResponse.json({
      agents: sdkAgents,
      total: sdkAgents.length,
    });
  } catch (error) {
    console.error('GET /api/agents error:', error);
    return NextResponse.json({ agents: [], total: 0 });
  }
}
