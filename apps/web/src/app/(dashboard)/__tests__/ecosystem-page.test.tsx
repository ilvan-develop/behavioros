// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

vi.mock('@/lib/hooks/use-api', () => ({
  useFetch: vi.fn(),
}));

const mockEcosystem = {
  totalSkills: 24,
  totalMCPs: 8,
  activeAgents: 12,
  designSystemCount: 3,
  activeSkills: 18,
  connectedMCPs: 6,
  skills: [
    {
      id: 'skill-1',
      name: 'TypeScript Mastery',
      version: '2.1.0',
      category: 'development',
      source: 'aitmpl' as const,
      status: 'active' as const,
      description: 'Advanced TypeScript patterns',
      prerequisites: [],
      installCommand: '',
      metadata: {},
      updatedAt: '2026-07-01T00:00:00Z',
    },
    {
      id: 'skill-2',
      name: 'React Pro',
      version: '1.5.0',
      category: 'development',
      source: 'bos' as const,
      status: 'active' as const,
      description: 'React component patterns',
      prerequisites: [],
      installCommand: '',
      metadata: {},
      updatedAt: '2026-07-15T00:00:00Z',
    },
  ],
  mcps: [
    {
      id: 'mcp-1',
      name: 'PostgreSQL MCP',
      status: 'connected' as const,
      toolsCount: 12,
      envVars: [],
      description: 'Database operations',
      source: 'behavioros',
      version: '1.0.0',
      updatedAt: '2026-07-10T00:00:00Z',
    },
    {
      id: 'mcp-2',
      name: 'Redis MCP',
      status: 'offline' as const,
      toolsCount: 5,
      envVars: [],
      description: 'Cache operations',
      source: 'community',
      version: '0.9.0',
      updatedAt: '2026-06-20T00:00:00Z',
    },
  ],
  designSystems: [
    {
      id: 'ds-1',
      name: 'Primer',
      description: 'GitHub design system',
      status: 'active' as const,
      components: 120,
      version: '1.0.0',
    },
  ],
  dnas: [],
};

describe('EcosystemPage', () => {
  it('shows loading state for stats cards', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({ data: null, loading: true, error: null });

    const EcosystemPage = (await import('../ecosystem/page')).default;
    const { container } = render(<EcosystemPage />);
    const pulseDivs = container.querySelectorAll('.animate-pulse');
    expect(pulseDivs.length).toBeGreaterThanOrEqual(1);
  });

  it('renders stats cards with data', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: mockEcosystem,
      loading: false,
      error: null,
    });

    const EcosystemPage = (await import('../ecosystem/page')).default;
    render(<EcosystemPage />);

    expect(screen.getByText('Total Skills')).toBeInTheDocument();
    expect(screen.getByText('Connected MCPs')).toBeInTheDocument();
    expect(screen.getByText('Active Agents')).toBeInTheDocument();
    expect(screen.getByText('Design Systems')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('18 active')).toBeInTheDocument();
  });

  it('renders skills section with data', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: mockEcosystem,
      loading: false,
      error: null,
    });

    const EcosystemPage = (await import('../ecosystem/page')).default;
    render(<EcosystemPage />);

    expect(screen.getByText('Skills (2)')).toBeInTheDocument();
    expect(screen.getByText('TypeScript Mastery')).toBeInTheDocument();
    expect(screen.getByText('React Pro')).toBeInTheDocument();
    expect(screen.getByText('Advanced TypeScript patterns')).toBeInTheDocument();
    expect(screen.getByText('v2.1.0')).toBeInTheDocument();
  });

  it('renders MCP servers section with data', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: mockEcosystem,
      loading: false,
      error: null,
    });

    const EcosystemPage = (await import('../ecosystem/page')).default;
    render(<EcosystemPage />);

    expect(screen.getByText('MCP Servers (2)')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL MCP')).toBeInTheDocument();
    expect(screen.getByText('Redis MCP')).toBeInTheDocument();
    const toolsCounts = screen.getAllByText(/tools/);
    expect(toolsCounts.length).toBeGreaterThanOrEqual(2);
  });

  it('renders design systems section with data', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: mockEcosystem,
      loading: false,
      error: null,
    });

    const EcosystemPage = (await import('../ecosystem/page')).default;
    render(<EcosystemPage />);

    expect(screen.getByText('Design Systems (1)')).toBeInTheDocument();
    expect(screen.getByText('Primer')).toBeInTheDocument();
    expect(screen.getByText('120 components')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
  });

  it('renders quick action buttons', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: mockEcosystem,
      loading: false,
      error: null,
    });

    const EcosystemPage = (await import('../ecosystem/page')).default;
    render(<EcosystemPage />);

    expect(screen.getByText('Install')).toBeInTheDocument();
    expect(screen.getByText('Sync')).toBeInTheDocument();
    expect(screen.getByText('Doctor')).toBeInTheDocument();
  });

  it('renders DNA patterns section', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: mockEcosystem,
      loading: false,
      error: null,
    });

    const EcosystemPage = (await import('../ecosystem/page')).default;
    render(<EcosystemPage />);

    expect(screen.getByText('Behavioral DNA Patterns')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Governance')).toBeInTheDocument();
    expect(screen.getByText('Military Operations')).toBeInTheDocument();
    expect(screen.getByText('Surgical Team')).toBeInTheDocument();
    expect(screen.getByText('Lean Factory')).toBeInTheDocument();
  });
});
