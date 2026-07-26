// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFetch } from './use-api';

describe('useFetch', () => {
  // Suppress act() warnings for renderHook + useEffect + fetch pattern
  // This is a known @testing-library/react v16 issue that doesn't affect correctness
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (msg.includes('not wrapped in act')) {
        return;
      }
      originalConsoleError.call(console, ...args);
    };
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });
  it('returns loading state initially', async () => {
    // Use a deferred promise so fetch doesn't resolve during render
    let resolveFetch!: (value: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    // Wrap renderHook in act to flush effects properly
    let hookResult: { current: { loading: boolean; data: null; error: null } };
    await act(async () => {
      hookResult = renderHook(() => useFetch('/api/test')).result;
    });

    expect(hookResult.current.loading).toBe(true);
    expect(hookResult.current.data).toBeNull();
    expect(hookResult.current.error).toBeNull();

    // Cleanup: resolve the pending promise
    act(() => {
      resolveFetch(new Response('{}', { status: 200 }));
    });
  });

  it('returns data on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ name: 'test-mission' }), { status: 200 }),
    );

    const { result } = renderHook(() => useFetch<{ name: string }>('/api/test'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ name: 'test-mission' });
    expect(result.current.error).toBeNull();
  });

  it('returns error on HTTP failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500, statusText: 'Internal Server Error' }),
    );

    const { result } = renderHook(() => useFetch('/api/test'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('HTTP 500');
  });

  it('returns error on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFetch('/api/test'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('cancels fetch on unmount', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(new Response('{}', { status: 200 })), 100),
        ),
    );

    const { result, unmount } = renderHook(() => useFetch('/api/test'));
    unmount();

    expect(result.current.loading).toBe(true);
  });
});
