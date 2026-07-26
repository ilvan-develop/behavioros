// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

describe('ComponentCard', () => {
  it('renders title and icon', async () => {
    const { ComponentCard } = await import('./component-card');
    render(<ComponentCard icon={<span data-testid="test-icon">*</span>} title="Test Component" />);
    expect(screen.getByText('Test Component')).toBeInTheDocument();
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders subtitle', async () => {
    const { ComponentCard } = await import('./component-card');
    render(<ComponentCard icon={<span>*</span>} title="Test" subtitle="Subtitle text" />);
    expect(screen.getByText('Subtitle text')).toBeInTheDocument();
  });

  it('renders children in card content', async () => {
    const { ComponentCard } = await import('./component-card');
    render(
      <ComponentCard icon={<span>*</span>} title="Test">
        <span data-testid="child-content">Child content</span>
      </ComponentCard>,
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders status and source badges', async () => {
    const { ComponentCard } = await import('./component-card');
    render(
      <ComponentCard
        icon={<span>*</span>}
        title="Test"
        statusBadge={<span data-testid="status-badge">Active</span>}
        sourceBadge={<span data-testid="source-badge">BOS</span>}
      />,
    );
    expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    expect(screen.getByTestId('source-badge')).toBeInTheDocument();
  });
});
