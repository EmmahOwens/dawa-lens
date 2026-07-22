import { useState, useEffect, useRef } from 'react';
import { collection, query, limit, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { api } from '../services/adminApi';
import type { FeedEvent } from '../types';

/** Maps a Firestore doseLog document to a FeedEvent */
function docToFeedEvent(doc: DocumentData & { id: string }): FeedEvent {
  const data = doc.data();
  const status: string = data.status || data.action || 'unknown';
  const med = data.medicineName || data.name || 'medication';
  const rawDate = data.actionTime || data.createdAt;
  let ts = new Date().toISOString();
  if (rawDate) {
    if (typeof rawDate.toDate === 'function') {
      ts = rawDate.toDate().toISOString();
    } else {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) ts = d.toISOString();
    }
  }

  let type: FeedEvent['type'] = 'dose_taken';
  let label = `Took ${med}`;

  if (status === 'taken') {
    type = 'dose_taken';
    label = `Took ${med}`;
  } else if (status === 'missed') {
    type = 'dose_missed';
    label = `Missed ${med}`;
  } else if (status === 'skipped') {
    type = 'dose_skipped';
    label = `Skipped ${med}`;
  }

  return {
    id: doc.id,
    type,
    userId: data.userId || '',
    medicineName: med,
    status,
    createdAt: ts,
    label,
  };
}

/**
 * Subscribes to recent dose log events using Firestore onSnapshot, with REST API polling fallback.
 */
export function useRealtimeFeed(maxEvents = 20): { events: FeedEvent[]; isConnected: boolean } {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const fallbackActive = useRef(false);

  useEffect(() => {
    let mounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const startFallbackPolling = () => {
      if (fallbackActive.current) return;
      fallbackActive.current = true;

      const fetchRecent = async () => {
        try {
          const res = await api.doseLogs.recent(maxEvents);
          if (mounted && res.data) {
            setEvents(res.data);
            setIsConnected(true);
          }
        } catch {
          // If REST API fails as well, report connection issue
          if (mounted && events.length === 0) {
            setIsConnected(false);
          }
        }
      };

      fetchRecent();
      pollInterval = setInterval(fetchRecent, 15_000);
    };

    let unsubscribe = () => {};

    try {
      const q = query(
        collection(db, 'doseLogs'),
        limit(maxEvents * 2)
      );

      unsubscribe = onSnapshot(
        q,
        (snap: QuerySnapshot) => {
          if (!mounted) return;
          setIsConnected(true);
          const newEvents: FeedEvent[] = [];
          snap.docs.forEach(doc => {
            newEvents.push(docToFeedEvent(doc));
          });
          newEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setEvents(newEvents.slice(0, maxEvents));
          seenIds.current = new Set(newEvents.map(e => e.id));
        },
        (error) => {
          console.warn('[useRealtimeFeed] Firestore listener warning/fallback:', error.message);
          startFallbackPolling();
        }
      );
    } catch {
      startFallbackPolling();
    }

    // Safety timer: If Firestore onSnapshot hasn't received data after 2.5s, trigger REST API fetch
    const timeout = setTimeout(() => {
      if (mounted && !isConnected) {
        startFallbackPolling();
      }
    }, 2500);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      if (pollInterval) clearInterval(pollInterval);
      unsubscribe();
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
