import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FeedEvent } from '../types';

/** Maps a Firestore doseLog document to a FeedEvent */
function docToFeedEvent(doc: DocumentData & { id: string }): FeedEvent {
  const data = doc.data();
  const status: string = data.status || 'unknown';
  const med = data.medicineName || data.name || 'medication';
  const ts = data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();

  let type: FeedEvent['type'] = 'dose_taken';
  let label = '';

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
 * Subscribes to the last N dose log events across all users using Firestore onSnapshot.
 * Returns a live-updating feed array.
 */
export function useRealtimeFeed(maxEvents = 20): { events: FeedEvent[]; isConnected: boolean } {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const q = query(
      collection(db, 'doseLogs'),
      orderBy('createdAt', 'desc'),
      limit(maxEvents)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap: QuerySnapshot) => {
        setIsConnected(true);
        const newEvents: FeedEvent[] = [];
        snap.docs.forEach(doc => {
          newEvents.push(docToFeedEvent(doc));
        });
        // Sort by newest first, keep maxEvents
        newEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setEvents(newEvents.slice(0, maxEvents));
        seenIds.current = new Set(newEvents.map(e => e.id));
      },
      (error) => {
        console.error('[useRealtimeFeed] Firestore error:', error.message);
        setIsConnected(false);
      }
    );

    return () => unsubscribe();
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
