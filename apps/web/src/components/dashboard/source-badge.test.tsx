// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SourceBadge } from './source-badge';

describe('SourceBadge', () => {
  it('renders aitmpl source', () => {
    render(<SourceBadge source="aitmpl" />);
    expect(screen.getByText('AITMPL')).toBeInTheDocument();
  });

  it('renders bos source', () => {
    render(<SourceBadge source="bos" />);
    expect(screen.getByText('BOS')).toBeInTheDocument();
  });

  it('renders od source', () => {
    render(<SourceBadge source="od" />);
    expect(screen.getByText('OD')).toBeInTheDocument();
  });

  it('renders local source', () => {
    render(<SourceBadge source="local" />);
    expect(screen.getByText('Local')).toBeInTheDocument();
  });
});
