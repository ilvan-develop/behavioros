// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFetch } from '@/lib/hooks/use-api';
import MissionDetailPage from './page';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.mocked(useFetch).mockReset();
});

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ id: 'mission-001' })),
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

vi.mock('@/lib/hooks/use-api', () => ({
  useFetch: vi.fn(),
}));

describe('MissionDetailPage', () => {
  it('shows loading state initially', async () => {
    vi.mocked(useFetch).mockReturnValue({ data: null, loading: true, error: null });

    await act(async () => {
      render(<MissionDetailPage />);
    });

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows not found state when mission is null', async () => {
    vi.mocked(useFetch).mockReturnValue({ data: null, loading: false, error: null });

    await act(async () => {
      render(<MissionDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Mission not found')).toBeInTheDocument();
    });
  });

  it('renders mission details', async () => {
    vi.mocked(useFetch)
      .mockReturnValueOnce({
        data: {
          mission: {
            id: 'mission-001',
            title: 'Test Mission',
            description: 'A test mission',
            type: 'feature',
            priority: 'high',
            status: 'executing',
            assignedTo: ['agent-1'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            progress: 50,
            tags: ['test'],
          },
        },
        loading: false,
        error: null,
      })
      .mockReturnValue({ data: null, loading: false, error: null });

    await act(async () => {
      render(<MissionDetailPage />);
    });

    expect(screen.getByText('Test Mission')).toBeInTheDocument();
    expect(screen.getByText('A test mission')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows start button for draft missions', async () => {
    vi.mocked(useFetch)
      .mockReturnValueOnce({
        data: {
          mission: {
            id: 'mission-draft',
            title: 'Draft Mission',
            description: '',
            type: 'feature',
            priority: 'low',
            status: 'draft',
            assignedTo: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            progress: 0,
            tags: [],
          },
        },
        loading: false,
        error: null,
      })
      .mockReturnValue({ data: null, loading: false, error: null });

    await act(async () => {
      render(<MissionDetailPage />);
    });

    expect(screen.getByText('Start Mission')).toBeInTheDocument();
  });

  it('shows complete/fail buttons for executing missions', async () => {
    vi.mocked(useFetch)
      .mockReturnValueOnce({
        data: {
          mission: {
            id: 'mission-exec',
            title: 'Active Mission',
            description: '',
            type: 'feature',
            priority: 'high',
            status: 'executing',
            assignedTo: ['agent-1'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            progress: 60,
            tags: [],
          },
        },
        loading: false,
        error: null,
      })
      .mockReturnValue({ data: null, loading: false, error: null });

    await act(async () => {
      render(<MissionDetailPage />);
    });

    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Fail')).toBeInTheDocument();
  });
});
