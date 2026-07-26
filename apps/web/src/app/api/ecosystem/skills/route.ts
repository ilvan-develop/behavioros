import { NextResponse } from 'next/server';
import type { SkillSource, SkillStatus } from '@/types';

export const dynamic = 'force-dynamic';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const seedSkills = [
  {
    id: 'skill-context7',
    name: 'Context7 MCP',
    version: '2.1.0',
    category: 'mcp',
    source: 'aitmpl' as SkillSource,
    status: 'active' as SkillStatus,
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
    source: 'aitmpl' as SkillSource,
    status: 'active' as SkillStatus,
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
    source: 'aitmpl' as SkillSource,
    status: 'active' as SkillStatus,
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
    source: 'od' as SkillSource,
    status: 'active' as SkillStatus,
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
    source: 'bos' as SkillSource,
    status: 'active' as SkillStatus,
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
    source: 'local' as SkillSource,
    status: 'outdated' as SkillStatus,
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
    source: 'aitmpl' as SkillSource,
    status: 'active' as SkillStatus,
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
    source: 'od' as SkillSource,
    status: 'conflict' as SkillStatus,
    description: 'Enterprise product design audit with 10 dimensions, 60+ criteria.',
    prerequisites: [],
    installCommand: 'bos skill install design-qa',
    metadata: { dimensions: '10', criteria: '60+' },
    updatedAt: hoursAgo(96),
  },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const source = searchParams.get('source');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let filtered = [...seedSkills];

    if (category && category !== 'all') {
      filtered = filtered.filter((s) => s.category === category);
    }
    if (source && source !== 'all') {
      filtered = filtered.filter((s) => s.source === source);
    }
    if (status && status !== 'all') {
      filtered = filtered.filter((s) => s.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      );
    }

    return NextResponse.json({
      skills: filtered,
      total: filtered.length,
      categories: [...new Set(seedSkills.map((s) => s.category))],
      sources: [...new Set(seedSkills.map((s) => s.source))],
    });
  } catch (error) {
    console.error('GET /api/ecosystem/skills error:', error);
    return NextResponse.json({ skills: [], total: 0, categories: [], sources: [] });
  }
}
