import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';
import type { DnaPackage, EcosystemDS, EcosystemMCP, EcosystemSkill } from '@/types';

export const dynamic = 'force-dynamic';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const seedSkills: EcosystemSkill[] = [
  {
    id: 'skill-context7',
    name: 'Context7 MCP',
    version: '2.1.0',
    category: 'mcp',
    source: 'aitmpl',
    status: 'active',
    description: 'Fetch current documentation for any library, framework, or SDK.',
    prerequisites: ['Node.js 18+', 'MCP-compatible client'],
    installCommand: 'npx @context7/mcp-server',
    metadata: { tools: 'resolve-library-id, query-docs' },
    updatedAt: hoursAgo(24),
  },
  {
    id: 'skill-enterprise-architecture',
    name: 'Enterprise Architecture',
    version: '1.3.0',
    category: 'architecture',
    source: 'aitmpl',
    status: 'active',
    description: 'TOGAF, Zachman, C4 Model, ArchiMate, DDD, Event Storming.',
    prerequisites: [],
    installCommand: 'bos skill install enterprise-architecture',
    metadata: { topics: 'togaf, zachman, c4, archimate, ddd' },
    updatedAt: hoursAgo(48),
  },
  {
    id: 'skill-enterprise-backend',
    name: 'Enterprise Backend',
    version: '2.0.1',
    category: 'backend',
    source: 'aitmpl',
    status: 'active',
    description: 'DDD, Clean Architecture, CQRS, Event Sourcing, Microservices.',
    prerequisites: [],
    installCommand: 'bos skill install enterprise-backend',
    metadata: { topics: 'ddd, cqrs, microservices, apis' },
    updatedAt: hoursAgo(72),
  },
  {
    id: 'skill-ui-ux-pro-max',
    name: 'UI/UX Pro Max',
    version: '1.1.0',
    category: 'design',
    source: 'od',
    status: 'active',
    description: 'UI/UX design intelligence with 50+ styles, 161 color palettes.',
    prerequisites: [],
    installCommand: 'bos skill install ui-ux-pro-max',
    metadata: { styles: '50+', palettes: '161' },
    updatedAt: hoursAgo(12),
  },
  {
    id: 'skill-behavioros-dna',
    name: 'BehaviorOS DNA',
    version: '1.0.0',
    category: 'governance',
    source: 'bos',
    status: 'active',
    description: 'DNA YAML authoring patterns for behavioral governance.',
    prerequisites: ['BehaviorOS v0.1+'],
    installCommand: 'Built-in (BOS core)',
    metadata: { type: 'core' },
    updatedAt: hoursAgo(6),
  },
  {
    id: 'skill-payment-validator',
    name: 'Payment Validator',
    version: '0.4.0',
    category: 'finance',
    source: 'local',
    status: 'outdated',
    description: 'Custom payment flow validation rules.',
    prerequisites: [],
    installCommand: 'bos skill install payment-validator',
    metadata: { author: 'finpay-team' },
    updatedAt: hoursAgo(336),
  },
  {
    id: 'skill-security-auditor',
    name: 'Security Auditor',
    version: '1.0.0',
    category: 'security',
    source: 'aitmpl',
    status: 'active',
    description: 'OWASP Top 10 scanning, dependency auditing, secrets detection.',
    prerequisites: [],
    installCommand: 'bos skill install security-auditor',
    metadata: { tools: 'owasp, trivy, gitleaks' },
    updatedAt: hoursAgo(36),
  },
  {
    id: 'skill-design-qa',
    name: 'Design QA',
    version: '0.9.0',
    category: 'design',
    source: 'od',
    status: 'conflict',
    description: 'Enterprise product design audit with 10 dimensions, 60+ criteria.',
    prerequisites: [],
    installCommand: 'bos skill install design-qa',
    metadata: { dimensions: '10', criteria: '60+' },
    updatedAt: hoursAgo(96),
  },
];

const seedMCPs: EcosystemMCP[] = [
  {
    id: 'mcp-github',
    name: 'GitHub MCP',
    status: 'connected',
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
    status: 'connected',
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
    status: 'connected',
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
    status: 'offline',
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
    status: 'connected',
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
    status: 'connected',
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
    status: 'offline',
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
    status: 'error',
    toolsCount: 6,
    envVars: ['PLAYWRIGHT_BROWSERS_PATH'],
    description: 'Browser automation and E2E testing.',
    source: 'official',
    version: '1.1.0',
    updatedAt: hoursAgo(4),
  },
];

const seedDS: EcosystemDS[] = [
  {
    id: 'ds-shadcn',
    name: 'shadcn/ui',
    description: 'Beautifully designed components built with Radix UI and Tailwind.',
    status: 'active',
    components: 48,
    version: '4.13.0',
  },
  {
    id: 'ds-base-ui',
    name: 'Base UI',
    description: 'Unstyled React components for building design systems.',
    status: 'active',
    components: 32,
    version: '1.6.0',
  },
  {
    id: 'ds-tailwind',
    name: 'Tailwind CSS',
    description: 'Utility-first CSS framework for rapid UI development.',
    status: 'active',
    components: 0,
    version: '4.1.0',
  },
  {
    id: 'ds-custom',
    name: 'BehaviorOS Design Tokens',
    description: 'Custom design tokens and theme configuration.',
    status: 'outdated',
    components: 12,
    version: '0.2.0',
  },
];

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const status = bos.getStatus();

    const dnas: DnaPackage[] = [];

    const summary = {
      totalSkills: seedSkills.length,
      totalMCPs: seedMCPs.length,
      activeAgents: status.agents ?? 0,
      designSystemCount: seedDS.length,
      activeSkills: seedSkills.filter((s) => s.status === 'active').length,
      connectedMCPs: seedMCPs.filter((m) => m.status === 'connected').length,
      skills: seedSkills,
      mcps: seedMCPs,
      designSystems: seedDS,
      dnas,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('GET /api/ecosystem error:', error);
    return NextResponse.json({ error: 'Failed to fetch ecosystem status' }, { status: 500 });
  }
}
