'use client';

import { useEffect, useRef, useState } from 'react';

export function useSSE<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        if (!cancelled) setConnected(true);
      };

      es.onmessage = (event) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(event.data) as T;
          setData(parsed);
          setError(null);
        } catch {
          setError('Failed to parse SSE data');
        }
      };

      es.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        setError('SSE connection lost — reconnecting');
        es.close();
        reconnectRef.current = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      esRef.current?.close();
    };
  }, [url]);

  return { data, connected, error };
}
