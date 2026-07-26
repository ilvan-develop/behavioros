// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

// Suppress React RSC warnings in jsdom — async Server Components are expected
// to produce these warnings in a Client-side test environment
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('async Client Component') ||
      msg.includes('suspended inside an `act` scope') ||
      msg.includes('suspended by an uncached promise')
    ) {
      return;
    }
    originalConsoleError.call(console, ...args);
  };
});
afterEach(() => {
  console.error = originalConsoleError;
});

vi.mock('@/components/dashboard/stats-cards', () => ({
  StatsCards: () => <div data-testid="stats-cards">StatsCards</div>,
}));

vi.mock('@/components/dashboard/recent-missions', () => ({
  RecentMissions: () => <div data-testid="recent-missions">RecentMissions</div>,
}));

vi.mock('@/components/dashboard/agent-status-grid', () => ({
  AgentStatusGrid: () => <div data-testid="agent-status-grid">AgentStatusGrid</div>,
}));

describe('DashboardPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders dashboard child components', async () => {
    const DashboardPage = (await import('../page')).default;
    render(<DashboardPage />);
    expect(screen.getByTestId('stats-cards')).toBeInTheDocument();
    expect(screen.getByTestId('recent-missions')).toBeInTheDocument();
    expect(screen.getByTestId('agent-status-grid')).toBeInTheDocument();
  });

  it('renders Quality Overview card title', async () => {
    const DashboardPage = (await import('../page')).default;
    render(<DashboardPage />);
    expect(screen.getByText('Quality Overview')).toBeInTheDocument();
  });

  it('shows quality overview loading skeletons while data loads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );

    const DashboardPage = (await import('../page')).default;
    const { container } = render(<DashboardPage />);
    const pulseDivs = container.querySelectorAll('.animate-pulse');
    expect(pulseDivs.length).toBeGreaterThanOrEqual(3);
  });

  it('renders quality overview content after data loads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            qualityGates: [
              {
                status: 'pass',
                metrics: [{ status: 'pass' }, { status: 'pass' }],
              },
            ],
            totalEvents: 10,
            pendingCount: 2,
            anomalies: [],
          }),
      }),
    );

    const DashboardPage = (await import('../page')).default;
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Overall Score')).toBeInTheDocument();
    });
    expect(screen.getByText('Gates Passed')).toBeInTheDocument();
    expect(screen.getByText('Open Issues')).toBeInTheDocument();
  });
});
