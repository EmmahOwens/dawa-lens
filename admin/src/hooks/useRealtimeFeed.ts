import { useState, useEffect, useRef } from 'react';
import { collection, query, limit, orderBy, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
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
 * Connection status becomes `true` as soon as either source responds (even with 0 events).
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
      if (fallbackActive.current) return; // Don't start multiple fallbacks
      fallbackActive.current = true;

      const fetchRecent = async () => {
        try {
          const res = await api.doseLogs.recent(maxEvents);
          if (mounted) {
            // Always mark as connected once we get a REST response, even if empty
            setIsConnected(true);
            if (res?.data) {
              setEvents(res.data);
            }
          }
        } catch (err) {
          console.warn('[useRealtimeFeed] REST fallback error:', err);
          // Still mark connected — if the server is up but returns empty, that's fine
          // Only stay disconnected if both Firestore AND REST both fail
        }
      };

      fetchRecent();
      pollInterval = setInterval(fetchRecent, 10_000);
    };

    try {
      // Try to order by actionTime first for most recent events; if index missing,
      // the onSnapshot error handler will fall back to REST.
      let q;
      try {
        q = query(
          collection(db, 'doseLogs'),
          orderBy('actionTime', 'desc'),
          limit(maxEvents * 2)
        );
      } catch {
        q = query(
          collection(db, 'doseLogs'),
          limit(maxEvents * 2)
        );
      }

      unsubscribe = onSnapshot(
        q,
        (snap: QuerySnapshot) => {
          if (!mounted) return;
          // Firestore responded = we are connected (even if 0 docs)
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
          console.warn('[useRealtimeFeed] Firestore listener error, starting fallback:', error.message);
          firestoreConnected.current = false;
          startFallbackPolling();
        }
      );
    } catch (err) {
      console.warn('[useRealtimeFeed] Firestore init error, starting fallback:', err);
      startFallbackPolling();
    }

    // Safety timer: if Firestore hasn't connected after 1.5s, start REST fallback
    const timeout = setTimeout(() => {
      if (mounted && !firestoreConnected.current) {
        startFallbackPolling();
      }
    }, 1500);

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
