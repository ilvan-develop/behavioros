import { NextResponse } from 'next/server';
import type { MCPStatus } from '@/types';

export const dynamic = 'force-dynamic';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const seedMCPs = [
  {
    id: 'mcp-github',
    name: 'GitHub MCP',
    status: 'connected' as MCPStatus,
    toolsCount: 18,
    envVars: ['GITHUB_TOKEN'],
    description: 'Full GitHub API integration — repos, PRs, issues, actions.',
    source: 'official',
    version: '1.5.0',
    updatedAt: hoursAgo(1),
  },
  {
    id: 'mcp-postgres',
    name: 'PostgreSQL MCP',
    status: 'connected' as MCPStatus,
    toolsCount: 12,
    envVars: ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'],
    description: 'PostgreSQL database introspection and query execution.',
    source: 'official',
    version: '2.0.0',
    updatedAt: hoursAgo(2),
  },
  {
    id: 'mcp-redis',
    name: 'Redis MCP',
    status: 'connected' as MCPStatus,
    toolsCount: 8,
    envVars: ['REDIS_URL'],
    description: 'Redis cache operations and key-value management.',
    source: 'official',
    version: '1.2.0',
    updatedAt: hoursAgo(3),
  },
  {
    id: 'mcp-prisma',
    name: 'Prisma MCP',
    status: 'offline' as MCPStatus,
    toolsCount: 15,
    envVars: ['DATABASE_URL'],
    description: 'Prisma ORM schema management and migrations.',
    source: 'community',
    version: '1.0.0',
    updatedAt: hoursAgo(48),
  },
  {
    id: 'mcp-supabase',
    name: 'Supabase MCP',
    status: 'connected' as MCPStatus,
    toolsCount: 10,
    envVars: ['SUPABASE_URL', 'SUPABASE_KEY'],
    description: 'Supabase project management and SQL queries.',
    source: 'official',
    version: '1.3.0',
    updatedAt: hoursAgo(6),
  },
  {
    id: 'mcp-better-auth',
    name: 'Better Auth MCP',
    status: 'connected' as MCPStatus,
    toolsCount: 7,
    envVars: ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'],
    description: 'Authentication configuration and user management.',
    source: 'community',
    version: '0.8.0',
    updatedAt: hoursAgo(12),
  },
  {
    id: 'mcp-shadcn',
    name: 'shadcn MCP',
    status: 'offline' as MCPStatus,
    toolsCount: 5,
    envVars: [],
    description: 'shadcn UI component installation and management.',
    source: 'community',
    version: '1.0.0',
    updatedAt: hoursAgo(120),
  },
  {
    id: 'mcp-playwright',
    name: 'Playwright MCP',
    status: 'error' as MCPStatus,
    toolsCount: 6,
    envVars: ['PLAYWRIGHT_BROWSERS_PATH'],
    description: 'Browser automation and E2E testing.',
    source: 'official',
    version: '1.1.0',
    updatedAt: hoursAgo(4),
  },
  {
    id: 'mcp-open-design',
    name: 'Open Design MCP',
    status: 'connected' as MCPStatus,
    toolsCount: 4,
    envVars: [],
    description: 'Open-source design system components and templates.',
    source: 'community',
    version: '0.5.0',
    updatedAt: hoursAgo(18),
  },
];

export async function GET() {
  try {
    const connected = seedMCPs.filter((m) => m.status === 'connected').length;
    const offline = seedMCPs.filter((m) => m.status === 'offline').length;
    const error = seedMCPs.filter((m) => m.status === 'error').length;

    return NextResponse.json({
      mcps: seedMCPs,
      total: seedMCPs.length,
      connected,
      offline,
      error,
    });
  } catch (error) {
    console.error('GET /api/ecosystem/mcps error:', error);
    return NextResponse.json({ mcps: [], total: 0, connected: 0, offline: 0, error: 0 });
  }
}
