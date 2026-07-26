// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const mockAgents = [
  {
    id: 'agent-1',
    name: 'Test Agent',
    role: 'engineer',
    status: 'idle',
    authority: 'senior',
    avatar: '\u{1F916}',
    reputation: 85,
    skills: ['Testing'],
    missionsCompleted: 10,
    lastActive: new Date().toISOString(),
  },
];

vi.mock('@/lib/hooks/use-api', () => ({
  useFetch: vi.fn(() => ({
    data: null,
    loading: true,
    error: null,
  })),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('AgentStatusGrid', () => {
  it('shows loading skeleton', async () => {
    const { AgentStatusGrid } = await import('./agent-status-grid');
    const { container } = render(<AgentStatusGrid />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
  });

  it('shows empty state', async () => {
    const useFetch = (await import('@/lib/hooks/use-api')).useFetch;
    vi.mocked(useFetch).mockReturnValue({
      data: { agents: [] },
      loading: false,
      error: null,
    });

    const { AgentStatusGrid } = await import('./agent-status-grid');
    render(<AgentStatusGrid />);
    expect(screen.getByText('No agents registered yet.')).toBeInTheDocument();
  });

  it('renders agent cards', async () => {
    const useFetch = (await import('@/lib/hooks/use-api')).useFetch;
    vi.mocked(useFetch).mockReturnValue({
      data: { agents: mockAgents },
      loading: false,
      error: null,
    });

    const { AgentStatusGrid } = await import('./agent-status-grid');
    render(<AgentStatusGrid />);
    expect(screen.getByText('Test Agent')).toBeInTheDocument();
    expect(screen.getByText('engineer')).toBeInTheDocument();
  });
});
