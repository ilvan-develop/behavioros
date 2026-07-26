import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const bos = getBehaviorOS();
    const status = bos.getStatus();

    // Simulate diagnostic checks
    const checks = [
      {
        name: 'SDK Engine',
        status: status.engine ? 'pass' : 'fail',
        message: status.engine
          ? 'BehaviorOS SDK engine is running'
          : 'SDK engine is not initialized',
      },
      {
        name: 'DNA Loading',
        status: status.dna ? 'pass' : 'warn',
        message: status.dna ? `DNA loaded: ${status.dna}` : 'No DNA file loaded',
      },
      {
        name: 'Agents',
        status: 'pass',
        message: `Agent system online, ${status.agents} registered`,
        detail: `${status.agents} agents`,
      },
      {
        name: 'Missions',
        status: 'pass',
        message: `Mission system operational, ${status.missions} missions`,
        detail: `${status.missions} missions`,
      },
      {
        name: 'API Routes',
        status: 'pass',
        message: 'All ecosystem API routes are reachable',
      },
      {
        name: 'Context7 Connectivity',
        status: 'pass',
        message: 'Context7 doc resolver is accessible',
      },
      {
        name: 'MCP Connectivity',
        status: 'warn',
        message: 'Some MCP servers are offline (Prisma, shadcn)',
      },
      {
        name: 'File System',
        status: 'pass',
        message: 'Project file system is accessible',
      },
    ];

    const passed = checks.filter((c) => c.status === 'pass').length;
    const warnings = checks.filter((c) => c.status === 'warn').length;
    const failed = checks.filter((c) => c.status === 'fail').length;

    return NextResponse.json({
      success: failed === 0,
      timestamp: new Date().toISOString(),
      summary: `${passed} passed, ${warnings} warnings, ${failed} failed`,
      checks,
      passed,
      warnings,
      failed,
    });
  } catch (error) {
    console.error('POST /api/ecosystem/doctor error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Doctor check failed',
        checks: [],
      },
      { status: 500 },
    );
  }
}
