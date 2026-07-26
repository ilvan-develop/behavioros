// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ id: 'agent-engineer-001' })),
}));

vi.mock('@/lib/hooks/use-api', () => ({
  useFetch: vi.fn(),
}));

vi.mock('@/lib/hooks/use-sse', () => ({
  useSSE: vi.fn(() => ({ data: null, connected: false, error: null })),
}));

const mockAgent = {
  id: 'agent-engineer-001',
  name: 'engineer',
  role: 'engineer',
  authority: 'senior',
  status: 'working',
  reputation: 85,
  skills: ['Implementation', 'Debugging', 'Code Review'],
  missionsCompleted: 12,
  lastActive: new Date().toISOString(),
  avatar: '\u{1F527}',
};

describe('AgentDetailPage', () => {
  it('shows loading state initially', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({ data: null, loading: true, error: null });

    const AgentDetailPage = (await import('./page')).default;
    const { container } = render(<AgentDetailPage />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows not found state when agent is null', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({ data: null, loading: false, error: null });

    const AgentDetailPage = (await import('./page')).default;
    render(<AgentDetailPage />);
    expect(screen.getByText('Agent not found')).toBeInTheDocument();
  });

  it('renders agent details', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { agent: mockAgent, missions: [] },
      loading: false,
      error: null,
    });

    const AgentDetailPage = (await import('./page')).default;
    render(<AgentDetailPage />);
    expect(screen.getAllByText('engineer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Implementation')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
  });

  it('shows assigned missions', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: {
        agent: mockAgent,
        missions: [
          {
            id: 'm1',
            title: 'Test Mission',
            type: 'feature',
            status: 'executing',
            progress: 50,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            priority: 'high',
            description: '',
            assignedTo: ['agent-engineer-001'],
            tags: [],
          },
        ],
      },
      loading: false,
      error: null,
    });

    const AgentDetailPage = (await import('./page')).default;
    render(<AgentDetailPage />);
    expect(screen.getByText('Test Mission')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
