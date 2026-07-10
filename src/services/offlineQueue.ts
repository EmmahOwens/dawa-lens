/**
 * offlineQueue — Persistent write-queue for Firestore reminder operations.
 *
 * When the device is offline, reminder CRUD operations are stored here instead
 * of being dropped. On reconnect, `flushQueue()` replays them in order against
 * Firestore so no data is ever lost.
 *
 * Storage: localStorage (survives app restarts; tiny payloads).
 * All operations are idempotent — replaying a queued op that already succeeded
 * on a previous flush attempt is safe (Firestore upsert / delete-if-exists).
 */

import {
  Firestore,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  setDoc,
} from "firebase/firestore";

// ─── Queue entry shape ───────────────────────────────────────────────────────

export type OfflineOpType =
  | "add-reminder"
  | "update-reminder"
  | "delete-reminder"
  | "add-dose-log"
  | "update-dose-log"
  | "update-medicine";

export interface OfflineOp {
  /** A stable client-side ID so we don't replay the same op twice. */
  opId: string;
  type: OfflineOpType;
  /** Firestore collection name */
  collection: string;
  /** Firestore document ID. For 'add-*' ops this is the locally generated ID. */
  docId: string;
  /** Full data payload for add/update ops. Undefined for delete ops. */
  data?: Record<string, unknown>;
  /** ISO timestamp when the op was enqueued. */
  enqueuedAt: string;
  /** userId — required to scope the Firestore write correctly. */
  userId: string;
}

const QUEUE_KEY = "dawa_offline_queue";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadQueue(): OfflineOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineOp[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: OfflineOp[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn("[offlineQueue] Failed to persist queue:", e);
  }
}

function generateOpId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add an operation to the offline queue.
 * Called whenever a reminder write fails because the device is offline.
 */
export function enqueueOp(
  op: Omit<OfflineOp, "opId" | "enqueuedAt">
): OfflineOp {
  const queue = loadQueue();
  const newOp: OfflineOp = {
    ...op,
    opId: generateOpId(),
    enqueuedAt: new Date().toISOString(),
  };

  // For update/delete ops: collapse duplicate ops on the same docId to avoid
  // N redundant writes (keep only the latest update, keep any deletes).
  const filtered =
    op.type.startsWith("update") || op.type.startsWith("delete")
      ? queue.filter(
          (existing) =>
            !(existing.docId === op.docId && existing.type === op.type)
        )
      : queue;

  filtered.push(newOp);
  saveQueue(filtered);
  console.log(
    `[offlineQueue] Enqueued ${op.type} for ${op.collection}/${op.docId}. Queue depth: ${filtered.length}`
  );
  return newOp;
}

/**
 * Returns the current number of pending operations.
 */
export function getPendingCount(): number {
  return loadQueue().length;
}

/**
 * Returns all pending operations (read-only snapshot).
 */
export function getPendingOps(): OfflineOp[] {
  return loadQueue();
}

/**
 * Replay all queued operations against Firestore in order.
 * Successful ops are removed from the queue individually so that a partial
 * failure doesn't lose already-flushed ops.
 *
 * Called automatically when the network comes back online.
 */
export async function flushQueue(db: Firestore): Promise<number> {
  const queue = loadQueue();
  if (queue.length === 0) return 0;

  console.log(`[offlineQueue] Flushing ${queue.length} pending ops…`);
  let flushed = 0;
  const failed: OfflineOp[] = [];

  for (const op of queue) {
    try {
      await replayOp(db, op);
      flushed++;
    } catch (err) {
      console.warn(
        `[offlineQueue] Failed to flush op ${op.opId} (${op.type}):`,
        err
      );
      failed.push(op);
    }
  }

  // Persist only the ops that failed — successful ones are done
  saveQueue(failed);

  console.log(
    `[offlineQueue] Flush complete. ${flushed} synced, ${failed.length} still pending.`
  );
  return flushed;
}

/**
 * Clear the entire queue (used on logout).
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

// ─── Internal replay logic ────────────────────────────────────────────────────

async function replayOp(db: Firestore, op: OfflineOp): Promise<void> {
  const colRef = collection(db, op.collection);
  const docRef = doc(db, op.collection, op.docId);

  switch (op.type) {
    case "add-reminder":
    case "add-dose-log": {
      // Use setDoc with the locally generated ID so the entity stays stable
      // across offline → online transitions. addDoc would create a new ID.
      if (!op.data) throw new Error("Missing data for add op");
      await setDoc(docRef, op.data);
      break;
    }

    case "update-reminder":
    case "update-dose-log":
    case "update-medicine": {
      if (!op.data) throw new Error("Missing data for update op");
      // Use setDoc merge so it acts as an upsert — handles cases where the
      // doc was added by a previous queue flush but the update is still pending.
      await setDoc(docRef, op.data, { merge: true });
      break;
    }

    case "delete-reminder": {
      try {
        await deleteDoc(docRef);
      } catch (e: any) {
        // NOT_FOUND is fine — doc may have been deleted on another device
        if (e?.code !== "not-found") throw e;
      }
      break;
    }

    default:
      console.warn("[offlineQueue] Unknown op type:", (op as any).type);
  }
}
