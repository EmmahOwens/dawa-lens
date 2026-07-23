import { useState, useEffect, useRef } from 'react';
import { collection, query, limit, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { api } from '../services/adminApi';
import type { FeedEvent } from '../types';

/** Maps a Firestore doseLog document to a FeedEvent */
function docToFeedEvent(doc: DocumentData & { id: string }): FeedEvent {
  const data = doc.data();
  const status: string = data.status || data.action || 'unknown';
  const med = data.medicineName || data.name || data.medicine || 'medication';
  const rawDate = data.actionTime || data.createdAt || data.timestamp || data.loggedAt || data.time;
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
  const fallbackActive = useRef(false);
  const firestoreConnected = useRef(false);

  useEffect(() => {
    let mounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let unsubscribe = () => {};

    const startFallbackPolling = () => {
      if (fallbackActive.current || firestoreConnected.current) return;
      fallbackActive.current = true;

      const fetchRecent = async () => {
        try {
          const res = await api.doseLogs.recent(maxEvents);
          if (mounted && res?.data) {
            setEvents(res.data);
            setIsConnected(true);
          }
        } catch (err) {
          console.warn('[useRealtimeFeed] REST fallback error:', err);
          if (mounted && !firestoreConnected.current && events.length === 0) {
            setIsConnected(false);
          }
        }
      };

      fetchRecent();
      pollInterval = setInterval(fetchRecent, 10_000);
    };

    try {
      const q = query(
        collection(db, 'doseLogs'),
        limit(maxEvents * 2)
      );

      unsubscribe = onSnapshot(
        q,
        (snap: QuerySnapshot) => {
          if (!mounted) return;
          firestoreConnected.current = true;
          setIsConnected(true);
          const newEvents: FeedEvent[] = [];
          snap.docs.forEach(doc => {
            newEvents.push(docToFeedEvent(doc));
          });
          newEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setEvents(newEvents.slice(0, maxEvents));
        },
        (error) => {
          console.warn('[useRealtimeFeed] Firestore listener fallback:', error.message);
          firestoreConnected.current = false;
          startFallbackPolling();
        }
      );
    } catch {
      startFallbackPolling();
    }

    // Safety timer: If Firestore onSnapshot hasn't connected or received data after 2 seconds, trigger REST fallback
    const timeout = setTimeout(() => {
      if (mounted && !firestoreConnected.current) {
        startFallbackPolling();
      } else if (mounted) {
        setIsConnected(true);
      }
    }, 2000);

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
