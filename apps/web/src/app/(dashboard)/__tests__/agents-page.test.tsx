// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/hooks/use-api', () => ({
  useFetch: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
  formatRelativeTime: vi.fn(() => '2h ago'),
}));

const mockAgents = [
  {
    id: 'agent-1',
    name: 'Alpha',
    role: 'architect',
    authority: 'lead',
    status: 'working' as const,
    reputation: 92,
    skills: ['typescript', 'react'],
    missionsCompleted: 15,
    lastActive: '2026-07-22T05:00:00Z',
    avatar: '🤖',
  },
  {
    id: 'agent-2',
    name: 'Beta',
    role: 'developer',
    authority: 'senior',
    status: 'idle' as const,
    reputation: 78,
    skills: ['python', 'docker'],
    missionsCompleted: 8,
    lastActive: '2026-07-21T12:00:00Z',
    avatar: '👾',
  },
  {
    id: 'agent-3',
    name: 'Gamma',
    role: 'reviewer',
    authority: 'architect',
    status: 'blocked' as const,
    reputation: 45,
    skills: ['security', 'audit'],
    missionsCompleted: 22,
    lastActive: '2026-07-20T08:00:00Z',
    avatar: '🛡️',
  },
];

describe('AgentsPage', () => {
  it('shows loading skeletons initially', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({ data: null, loading: true, error: null });

    const AgentsPage = (await import('../agents/page')).default;
    const { container } = render(<AgentsPage />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
  });

  it('shows loading text in header', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({ data: null, loading: true, error: null });

    const AgentsPage = (await import('../agents/page')).default;
    render(<AgentsPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows empty state when no agents exist', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({ data: { agents: [] }, loading: false, error: null });

    const AgentsPage = (await import('../agents/page')).default;
    render(<AgentsPage />);
    expect(screen.getByText('No agents found')).toBeInTheDocument();
    expect(screen.getByText('No agents have been registered yet.')).toBeInTheDocument();
  });

  it('shows status filter options when select is opened', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { agents: mockAgents },
      loading: false,
      error: null,
    });

    const AgentsPage = (await import('../agents/page')).default;
    render(<AgentsPage />);

    const selectTrigger = screen.getByText('All Statuses');
    fireEvent.click(selectTrigger);

    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.getByText('Working')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders agent cards with data', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { agents: mockAgents },
      loading: false,
      error: null,
    });

    const AgentsPage = (await import('../agents/page')).default;
    render(<AgentsPage />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('developer')).toBeInTheDocument();
    expect(screen.getByText('reviewer')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('3 agents')).toBeInTheDocument();
    const architectElements = screen.getAllByText('architect');
    expect(architectElements.length).toBe(2);
  });

  it('renders agent card with skill badges', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { agents: [mockAgents[0]] },
      loading: false,
      error: null,
    });

    const AgentsPage = (await import('../agents/page')).default;
    render(<AgentsPage />);

    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
  });

  it('renders agent card authority values', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { agents: [mockAgents[0], mockAgents[2]] },
      loading: false,
      error: null,
    });

    const AgentsPage = (await import('../agents/page')).default;
    render(<AgentsPage />);

    expect(screen.getByText('lead')).toBeInTheDocument();
  });
});
