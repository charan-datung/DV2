import { useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Subscribes to Supabase realtime changes on a table.
 * Calls `onEvent` whenever a matching row change occurs.
 * Automatically cleans up the subscription on unmount.
 *
 * Uses a ref for the callback so the subscription never becomes stale
 * without needing to resubscribe on every render.
 */
export function useRealtime(
  table: string,
  event: RealtimeEvent,
  onEvent: () => void,
  filter?: string,
) {
  // Always keep a ref to the latest callback so realtime events
  // never call a stale closure.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    const channel = supabase
      .channel(`realtime:${table}:${event}:${filter ?? 'all'}:${Math.random()}`)
      .on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          onEventRef.current();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, filter]);
}
