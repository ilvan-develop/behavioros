// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ id: 'surgical-team' })),
}));

vi.mock('@/lib/hooks/use-api', () => ({
  useFetch: vi.fn(),
}));

vi.mock('@/lib/hooks/use-sse', () => ({
  useSSE: vi.fn(() => ({ data: null, connected: false, error: null })),
}));

const mockDNA = {
  id: 'surgical-team',
  name: 'Surgical Team DNA',
  version: '1.0.0',
  description: 'Surgical team coordination DNA for zero-defect operations.',
  author: 'BehaviorOS Team',
  license: 'MIT',
  tags: ['surgical', 'healthcare', 'zero-defect'],
  personas: [
    {
      role: 'architect',
      authority: 'architect',
      name: 'Lead Surgeon',
      description: 'Primary operator responsible for surgical procedure decisions.',
      skills: ['surgical-procedure', 'team-leadership'],
    },
  ],
  governance: [
    {
      id: 'rule-1',
      name: 'Timeout Verification',
      type: 'require_approval',
      description: 'Require time-out verification before incision.',
      action: 'block',
    },
  ],
  quality: [
    {
      id: 'gate-1',
      name: 'Test Coverage',
      metric: 'coverage',
      threshold: 90,
      operator: '>=',
      action: 'block',
    },
  ],
  patterns: [
    {
      id: 'pattern-1',
      name: 'Sterile Field Protocol',
      description: 'Maintain sterile field during all procedures.',
    },
  ],
  workflows: [
    {
      id: 'step-1',
      name: 'Pre-op Checklist',
      description: 'Complete pre-operative checklist.',
      order: 1,
      inputs: ['patient-data'],
    },
  ],
};

describe('DNADetailPage', () => {
  it('shows loading state', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({ data: null, loading: true, error: null });

    const DNADetailPage = (await import('./page')).default;
    const { container } = render(<DNADetailPage />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(1);
  });

  it('shows not found state', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({ data: null, loading: false, error: null });

    const DNADetailPage = (await import('./page')).default;
    render(<DNADetailPage />);
    expect(screen.getByText('DNA not found')).toBeInTheDocument();
  });

  it('renders DNA metadata', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { dna: mockDNA },
      loading: false,
      error: null,
    });

    const DNADetailPage = (await import('./page')).default;
    render(<DNADetailPage />);
    expect(screen.getByText('Surgical Team DNA')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('BehaviorOS Team')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(screen.getByText('healthcare')).toBeInTheDocument();
  });

  it('renders personas section', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { dna: mockDNA },
      loading: false,
      error: null,
    });

    const DNADetailPage = (await import('./page')).default;
    render(<DNADetailPage />);
    expect(screen.getByText('Lead Surgeon')).toBeInTheDocument();
    expect(screen.getByText('surgical-procedure')).toBeInTheDocument();
    expect(screen.getByText('team-leadership')).toBeInTheDocument();
  });

  it('renders governance rules section', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { dna: mockDNA },
      loading: false,
      error: null,
    });

    const DNADetailPage = (await import('./page')).default;
    render(<DNADetailPage />);
    expect(screen.getByText('Timeout Verification')).toBeInTheDocument();
  });

  it('renders quality gates section', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { dna: mockDNA },
      loading: false,
      error: null,
    });

    const DNADetailPage = (await import('./page')).default;
    render(<DNADetailPage />);
    expect(screen.getByText('Test Coverage')).toBeInTheDocument();
  });

  it('renders workflows section', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { dna: mockDNA },
      loading: false,
      error: null,
    });

    const DNADetailPage = (await import('./page')).default;
    render(<DNADetailPage />);
    expect(screen.getByText('Pre-op Checklist')).toBeInTheDocument();
    expect(screen.getAllByText(/Step 1/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when governance is empty', async () => {
    const { useFetch } = await import('@/lib/hooks/use-api');
    vi.mocked(useFetch).mockReturnValue({
      data: { dna: { ...mockDNA, governance: [] } },
      loading: false,
      error: null,
    });

    const DNADetailPage = (await import('./page')).default;
    render(<DNADetailPage />);
    expect(screen.getByText('No governance rules defined.')).toBeInTheDocument();
  });
});
