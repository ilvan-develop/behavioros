// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const mockMissions = [
  {
    id: '1',
    title: 'Test Mission',
    type: 'feature',
    priority: 'high',
    status: 'executing',
    updatedAt: new Date().toISOString(),
    description: '',
    assignedTo: [],
    createdAt: '',
    progress: 50,
    tags: [],
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

describe('RecentMissions', () => {
  it('shows loading skeleton', async () => {
    const { RecentMissions } = await import('./recent-missions');
    const { container } = render(<RecentMissions />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
  });

  it('shows empty state', async () => {
    const useFetch = (await import('@/lib/hooks/use-api')).useFetch;
    vi.mocked(useFetch).mockReturnValue({
      data: { missions: [] },
      loading: false,
      error: null,
    });

    const { RecentMissions } = await import('./recent-missions');
    render(<RecentMissions />);
    expect(screen.getByText('No missions yet. Create one to get started.')).toBeInTheDocument();
  });

  it('renders missions in table', async () => {
    const useFetch = (await import('@/lib/hooks/use-api')).useFetch;
    vi.mocked(useFetch).mockReturnValue({
      data: { missions: mockMissions },
      loading: false,
      error: null,
    });

    const { RecentMissions } = await import('./recent-missions');
    render(<RecentMissions />);
    expect(screen.getByText('Test Mission')).toBeInTheDocument();
    expect(screen.getByText('feature')).toBeInTheDocument();
  });
});
