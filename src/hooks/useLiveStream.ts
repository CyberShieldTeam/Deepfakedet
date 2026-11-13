import { useEffect, useRef, useState } from 'react';
import { LiveEvent } from '../types';

/** Subscribes to the server's SSE stream; reconnects automatically (EventSource default). */
export function useLiveStream(onAlert?: (ev: LiveEvent) => void) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const cb = useRef(onAlert);
  cb.current = onAlert;

  useEffect(() => {
    const es = new EventSource('/api/stream');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener('snapshot', e => setEvents(JSON.parse((e as MessageEvent).data)));
    es.onmessage = e => {
      const ev: LiveEvent = JSON.parse(e.data);
      setEvents(prev => [ev, ...prev].slice(0, 200));
      if (ev.kind === 'alert') cb.current?.(ev);
    };
    return () => es.close();
  }, []);

  return { events, connected };
}
