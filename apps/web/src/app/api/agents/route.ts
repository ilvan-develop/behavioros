import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';
import { enrichAgent } from '@/lib/seed-data';
import type { Agent } from '@/types';

const roleAvatars: Record<string, string> = {
  manager: '\u{1F451}',
  architect: '\u{1F3D7}\uFE0F',
  engineer: '\u{1F527}',
  specialist: '\u{1F9E0}',
  analyst: '\u{1F4CA}',
  qa: '\u{2705}',
  security: '\u{1F6E1}\uFE0F',
  devops: '\u{2699}\uFE0F',
  lead: '\u{1F46E}',
  support: '\u{1F4AC}',
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
  lead: ['Mentoring', 'Planning', 'Technical Leadership'],
  support: ['Communication', 'Documentation', 'User Support'],
};

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const sdkAgents = bos.getAllAgents();

    let agents: Agent[];
    if (sdkAgents.length > 0) {
      agents = sdkAgents.map((a) => enrichAgent(a));
    } else {
      const roles = ['architect', 'qa', 'security', 'engineer', 'devops'];
      agents = roles.map((role, i) => ({
        id: `agent-${role}-seed-${String(i).padStart(3, '0')}`,
        name: role,
        role,
        authority: role === 'architect' ? 'architect' : 'senior',
        status: 'idle' as const,
        reputation: 50 + Math.floor(Math.random() * 40),
        skills: roleSkillSets[role] ?? ['General'],
        missionsCompleted: Math.floor(Math.random() * 12),
        lastActive: new Date(Date.now() - Math.floor(Math.random() * 86400_000)).toISOString(),
        avatar: roleAvatars[role] ?? '\u{1F916}',
      }));
    }

    return NextResponse.json({
      agents,
      total: agents.length,
    });
  } catch (error) {
    console.error('GET /api/agents error:', error);
    return NextResponse.json({ agents: [], total: 0 });
  }
}
