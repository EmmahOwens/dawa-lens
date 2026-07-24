import { useState, useEffect, useRef } from 'react';
import { api } from '../services/adminApi';
import type { FeedEvent } from '../types';

/**
 * Polls the recent dose-logs REST endpoint for live feed events.
 *
 * The Firestore client-side subscription is intentionally NOT used here because
 * the doseLogs security rules require `isAdmin()` which depends on a custom claim
 * that is not reliably present in client-side ID tokens. The REST API (server-side
 * Admin SDK) bypasses Firestore security rules entirely and is always authoritative.
 *
 * isConnected becomes true as soon as the first successful REST response arrives.
 */
export function useRealtimeFeed(maxEvents = 20): { events: FeedEvent[]; isConnected: boolean } {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchRecent = async () => {
      try {
        const res = await api.doseLogs.recent(maxEvents);
        if (mountedRef.current) {
          setIsConnected(true);
          if (res?.data && Array.isArray(res.data)) {
            setEvents(res.data);
          }
        }
      } catch (err) {
        console.warn('[useRealtimeFeed] Failed to fetch dose logs:', err);
        // isConnected stays false until we get a successful response
      }
    };

    fetchRecent();
    const interval = setInterval(fetchRecent, 15_000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [maxEvents]);

  return { events, isConnected };
}

/** Polls the overview stats endpoint every `intervalMs` ms for live counter updates */
export function usePolledStats<T>(
  fetchFn: () => Promise<T>,
  intervalMs = 30_000
): { data: T | null; isLoading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetch = async () => {
      try {
        const result = await fetchFn();
        if (mounted) { setData(result); setError(null); }
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetch();
    const interval = setInterval(fetch, intervalMs);
    return () => { mounted = false; clearInterval(interval); };
  }, [fetchFn, intervalMs]);

  return { data, isLoading, error };
}
