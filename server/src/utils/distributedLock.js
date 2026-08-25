import { db } from '../db.js';

/**
 * Attempts to acquire a distributed lock in Firestore for a given worker.
 * Prevents multiple clustered/scaled instances from executing the same background task simultaneously.
 *
 * @param {string} lockName - Unique identifier for the worker lock
 * @param {number} leaseDurationMs - How long the lock remains valid before automatically expiring (default: 30 minutes)
 * @returns {Promise<boolean>} True if lock was acquired, false otherwise
 */
export async function acquireLock(lockName, leaseDurationMs = 30 * 60 * 1000) {
  const lockRef = db.collection('workerLocks').doc(lockName);
  const now = Date.now();

  try {
    const acquired = await db.runTransaction(async (t) => {
      const doc = await t.get(lockRef);

      if (doc.exists) {
        const data = doc.data();
        const expiresAt = data.expiresAt || 0;

        // If lock is still valid and not expired, cannot acquire
        if (now < expiresAt) {
          return false;
        }
      }

      // Lock is free or expired; acquire it
      t.set(lockRef, {
        lockedBy: process.env.RENDER_INSTANCE_ID || process.pid.toString(),
        acquiredAt: new Date().toISOString(),
        expiresAt: now + leaseDurationMs,
      });

      return true;
    });

    return acquired;
  } catch (err) {
    console.warn(`[DistributedLock] Failed to acquire lock "${lockName}":`, err.message);
    return false;
  }
}

/**
 * Releases a distributed lock.
 *
 * @param {string} lockName - Unique identifier for the worker lock
 */
export async function releaseLock(lockName) {
  const lockRef = db.collection('workerLocks').doc(lockName);
  try {
    await lockRef.delete();
  } catch (err) {
    console.warn(`[DistributedLock] Failed to release lock "${lockName}":`, err.message);
  }
}
