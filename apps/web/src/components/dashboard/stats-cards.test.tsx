// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

vi.mock('@/lib/hooks/use-api', () => ({
  useFetch: vi.fn(() => ({
    data: null,
    loading: true,
    error: null,
  })),
}));

vi.mock('@/lib/hooks/use-sse', () => ({
  useSSE: vi.fn(() => ({
    data: null,
    connected: false,
    error: null,
  })),
}));

describe('StatsCards', () => {
  it('shows loading skeletons', async () => {
    const { StatsCards } = await import('./stats-cards');
    const { container } = render(<StatsCards />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it('renders fallback stats when no data', async () => {
    const { StatsCards } = await import('./stats-cards');
    render(<StatsCards />);
    const headings = screen.getAllByText(/Total Missions|Active Agents|Quality Score|Audit Events/);
    expect(headings.length).toBe(4);
  });

  it('renders computed stats from data', async () => {
    const useFetch = (await import('@/lib/hooks/use-api')).useFetch;
    vi.mocked(useFetch).mockReturnValue({
      data: {
        stats: {
          missions: { total: 10, completed: 5, failed: 1 },
          agents: { total: 8, active: 6 },
        },
        status: { engine: true, qualityMetrics: 85 },
      },
      loading: false,
      error: null,
    });

    const { StatsCards } = await import('./stats-cards');
    render(<StatsCards />);
    expect(screen.getByText('5 completed')).toBeInTheDocument();
    expect(screen.getByText('6/8')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });
});
