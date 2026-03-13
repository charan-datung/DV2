import { useEffect } from 'react';
import { supabase } from '../config/supabase';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Subscribes to Supabase realtime changes on a table.
 * Calls `onEvent` whenever a matching row change occurs.
 * Automatically cleans up the subscription on unmount.
 */
export function useRealtime(
  table: string,
  event: RealtimeEvent,
  onEvent: (payload: { new: any; old: any; eventType: string }) => void,
  filter?: string,
) {
  useEffect(() => {
    let channel = supabase
      .channel(`realtime:${table}:${Date.now()}`)
      .on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: any) => {
          onEvent({
            new: payload.new,
            old: payload.old,
            eventType: payload.eventType,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, event, filter]);
}
