// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSSE } from './use-sse';

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = 2;
  }

  static simulateOpen() {
    for (const es of MockEventSource.instances) {
      es.onopen?.();
    }
  }

  static simulateMessage(data: unknown) {
    for (const es of MockEventSource.instances) {
      es.onmessage?.({ data: JSON.stringify(data) });
    }
  }

  static simulateError() {
    for (const es of MockEventSource.instances) {
      es.onerror?.();
    }
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

vi.stubGlobal('EventSource', MockEventSource);

describe('useSSE', () => {
  beforeEach(() => {
    MockEventSource.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects to the given URL', () => {
    renderHook(() => useSSE<unknown>('/api/stats/stream'));
    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0].url).toBe('/api/stats/stream');
  });

  it('sets connected to true on open', async () => {
    const { result } = renderHook(() => useSSE<unknown>('/api/stats/stream'));
    act(() => {
      MockEventSource.simulateOpen();
    });
    await waitFor(() => expect(result.current.connected).toBe(true));
  });

  it('receives data messages', async () => {
    const { result } = renderHook(() => useSSE<{ value: number }>('/api/stats/stream'));
    act(() => {
      MockEventSource.simulateOpen();
      MockEventSource.simulateMessage({ value: 42 });
    });
    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 42 });
    });
  });

  it('sets error on connection failure', async () => {
    const { result } = renderHook(() => useSSE<unknown>('/api/stats/stream'));
    act(() => {
      MockEventSource.simulateError();
    });
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.connected).toBe(false);
    });
  });

  it('updates data on new messages', async () => {
    const { result } = renderHook(() => useSSE<{ value: number }>('/api/stats/stream'));
    act(() => {
      MockEventSource.simulateMessage({ value: 1 });
    });
    await waitFor(() => expect(result.current.data?.value).toBe(1));
    act(() => {
      MockEventSource.simulateMessage({ value: 2 });
    });
    await waitFor(() => expect(result.current.data?.value).toBe(2));
  });

  it('closes connection on unmount', () => {
    const { unmount } = renderHook(() => useSSE<unknown>('/api/stats/stream'));
    const es = MockEventSource.instances[0];
    const closeSpy = vi.spyOn(es, 'close');
    unmount();
    expect(closeSpy).toHaveBeenCalled();
  });
});
