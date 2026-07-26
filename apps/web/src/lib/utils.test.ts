import { describe, expect, it } from 'vitest';
import { cn, formatDate, formatRelativeTime } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('resolves tailwind conflicts', () => {
    expect(cn('px-4', 'px-2')).toBe('px-2');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });

  it('handles undefined and null values', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate('2026-07-21T14:00:00.000Z');
    expect(result).toContain('Jul');
    expect(result).toContain('21');
    expect(result).toContain('2026');
  });

  it('formats with time component', () => {
    const result = formatDate('2026-01-05T09:30:00.000Z');
    expect(result).toContain('Jan');
    expect(result).toContain('5');
    expect(result).toContain('2026');
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for recent dates', () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
  });

  it('handles future dates gracefully', () => {
    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    const result = formatRelativeTime(future);
    expect(result).toBe('just now');
  });
});
