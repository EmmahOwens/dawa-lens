/**
 * In-memory Bounded LRU Cache and Query Timeout Utilities for Render Backend.
 * Enforces strict memory bounds (max items) and active TTL eviction to prevent OOM memory leaks.
 */

const MAX_CACHE_ENTRIES = 2000;
const store = new Map();

// Periodic sweep every 5 minutes to reclaim memory for keys never accessed again
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of store.entries()) {
    if (now > item.expiresAt) {
      store.delete(key);
    }
  }
}, SWEEP_INTERVAL_MS).unref(); // unref so timer does not prevent process exit in tests

/**
 * Retrieves a cached value if it exists and hasn't expired.
 * Updates LRU order on access.
 * @param {string} key 
 * @returns {any | null}
 */
export function getCache(key) {
  const item = store.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    store.delete(key);
    return null;
  }
  // Refresh LRU order: delete and re-insert
  store.delete(key);
  store.set(key, item);
  return item.value;
}

/**
 * Sets a value in the in-memory cache with a Time-To-Live (TTL) in seconds.
 * Evicts oldest (least recently used) item if capacity limit is reached.
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds 
 */
export function setCache(key, value, ttlSeconds = 60) {
  // If key already exists, delete it first so insertion moves it to newest position
  if (store.has(key)) {
    store.delete(key);
  } else if (store.size >= MAX_CACHE_ENTRIES) {
    // Evict least recently used (first key in map iterator)
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) {
      store.delete(oldestKey);
    }
  }

  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalidates a specific cache key.
 * @param {string} key 
 */
export function invalidateCache(key) {
  store.delete(key);
}


/**
 * Wraps a Promise (e.g., Firestore query) with a hard timeout limit.
 * If the promise does not resolve within `ms` milliseconds, it returns fallbackValue if provided,
 * or rejects with a Timeout Error.
 * @template T
 * @param {Promise<T>} promise 
 * @param {number} ms 
 * @param {T} [fallbackValue] 
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms = 4000, fallbackValue = undefined) {
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => {
      timer = null;
      if (fallbackValue !== undefined) {
        console.warn(`[TimeoutGuard] Operation exceeded ${ms}ms. Returning fallback response.`);
        resolve(fallbackValue);
      } else {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }
    }, ms);

    promise
      .then(res => {
        if (timer) {
          clearTimeout(timer);
          resolve(res);
        }
      })
      .catch(err => {
        if (timer) {
          clearTimeout(timer);
          if (fallbackValue !== undefined) {
            console.warn(`[TimeoutGuard] Operation failed (${err.message}). Returning fallback response.`);
            resolve(fallbackValue);
          } else {
            reject(err);
          }
        }
      });
  });
}
