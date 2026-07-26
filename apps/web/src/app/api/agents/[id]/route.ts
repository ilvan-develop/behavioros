import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';
import { enrichAgent } from '@/lib/seed-data';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bos = getBehaviorOS();
    const sdkAgents = bos.getAllAgents();

    if (sdkAgents.length > 0) {
      const found = sdkAgents.find((a) => a.id === id);
      if (!found) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      const agent = enrichAgent(found);
      const allMissions = bos.getAllMissions();
      const missions = allMissions.filter((m) => m.assignees?.includes(id));
      return NextResponse.json({ agent, missions });
    }

    const roles = ['architect', 'qa', 'security', 'engineer', 'devops'];
    const roleIdx = roles.findIndex((r) => id.includes(r));
    if (roleIdx === -1 && id !== 'agent-unknown') {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const role = roles[roleIdx] ?? 'engineer';
    const roleAvatars: Record<string, string> = {
      manager: '\u{1F451}',
      architect: '\u{1F3D7}\uFE0F',
      engineer: '\u{1F527}',
      specialist: '\u{1F9E0}',
      analyst: '\u{1F4CA}',
      qa: '\u{2705}',
      security: '\u{1F6E1}\uFE0F',
      devops: '\u{2699}\uFE0F',
    };
    const roleSkillSets: Record<string, string[]> = {
      manager: ['Leadership', 'Planning', 'Coordination'],
      architect: ['System Design', 'Architecture', 'Decision Making'],
      engineer: ['Implementation', 'Debugging', 'Code Review'],
      specialist: ['Domain Expertise', 'Analysis', 'Problem Solving'],
      analyst: ['Data Analysis', 'Research', 'Reporting'],
      qa: ['Testing', 'Quality Assurance', 'Automation'],
      security: ['Security Review', 'Vulnerability Analysis', 'Compliance'],
      devops: ['CI/CD', 'Infrastructure', 'Monitoring'],
    };

    const agent = {
      id,
      name: role,
      role,
      authority: role === 'architect' ? 'architect' : 'senior',
      status: 'idle' as const,
      reputation: 75 + Math.floor(Math.random() * 20),
      skills: roleSkillSets[role] ?? ['General'],
      missionsCompleted: Math.floor(Math.random() * 12),
      lastActive: new Date().toISOString(),
      avatar: roleAvatars[role] ?? '\u{1F916}',
    };

    const allMissions = bos.getAllMissions();
    const missions = allMissions.filter((m) => m.assignees?.includes(id));

    return NextResponse.json({ agent, missions });
  } catch (error) {
    console.error('GET /api/agents/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
  }
}
