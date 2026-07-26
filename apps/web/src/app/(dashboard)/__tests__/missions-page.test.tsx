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

const mockMissions = [
  {
    id: 'mission-001',
    title: 'Implement Auth',
    description: 'Add authentication system',
    type: 'feature' as const,
    priority: 'critical' as const,
    status: 'executing' as const,
    assignedTo: ['agent-1'],
    createdAt: '2026-07-20T10:00:00Z',
    updatedAt: '2026-07-21T15:00:00Z',
    progress: 60,
    tags: ['auth', 'security'],
  },
  {
    id: 'mission-002',
    title: 'Fix Login Bug',
    description: 'Resolve login redirect issue',
    type: 'bugfix' as const,
    priority: 'high' as const,
    status: 'draft' as const,
    assignedTo: [],
    createdAt: '2026-07-21T08:00:00Z',
    updatedAt: '2026-07-21T09:00:00Z',
    progress: 0,
    tags: ['bug'],
  },
];

describe('MissionsPage', () => {
  it('shows loading skeletons initially', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({ data: null, loading: true, error: null });

    const MissionsPage = (await import('../missions/page')).default;
    const { container } = render(<MissionsPage />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
  });

  it('shows empty state when no missions exist', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({ data: { missions: [] }, loading: false, error: null });

    const MissionsPage = (await import('../missions/page')).default;
    render(<MissionsPage />);
    expect(screen.getByText('No missions found')).toBeInTheDocument();
    expect(screen.getByText('Create your first mission to get started.')).toBeInTheDocument();
  });

  it('shows filtered empty state when search has no results', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { missions: mockMissions },
      loading: false,
      error: null,
    });

    const MissionsPage = (await import('../missions/page')).default;
    render(<MissionsPage />);

    const input = screen.getByPlaceholderText('Search missions...');
    fireEvent.change(input, { target: { value: 'nonexistent-mission' } });

    expect(screen.getByText('No missions found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filters.')).toBeInTheDocument();
  });

  it('renders missions in table', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { missions: mockMissions },
      loading: false,
      error: null,
    });

    const MissionsPage = (await import('../missions/page')).default;
    render(<MissionsPage />);

    expect(screen.getByText('Implement Auth')).toBeInTheDocument();
    expect(screen.getByText('Fix Login Bug')).toBeInTheDocument();
    expect(screen.getByText('All Missions (2)')).toBeInTheDocument();
  });

  it('opens create mission dialog', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({ data: { missions: [] }, loading: false, error: null });

    const MissionsPage = (await import('../missions/page')).default;
    render(<MissionsPage />);

    const newMissionBtn = screen.getByText('New Mission');
    expect(newMissionBtn).toBeInTheDocument();
    fireEvent.click(newMissionBtn);
    expect(screen.getByText('Create New Mission')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mission title')).toBeInTheDocument();
    expect(screen.getByText('Create Mission')).toBeInTheDocument();
  });

  it('shows status filter options in select', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { missions: mockMissions },
      loading: false,
      error: null,
    });

    const MissionsPage = (await import('../missions/page')).default;
    render(<MissionsPage />);

    const selectTrigger = screen.getByText('All Statuses');
    fireEvent.click(selectTrigger);

    const draftOptions = screen.getAllByText('Draft');
    expect(draftOptions.length).toBeGreaterThanOrEqual(1);
    const executingOptions = screen.getAllByText('Executing');
    expect(executingOptions.length).toBeGreaterThanOrEqual(1);
  });
});
