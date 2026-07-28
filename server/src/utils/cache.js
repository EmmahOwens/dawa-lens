/**
 * In-memory TTL Cache and Query Timeout Utilities for Render Backend.
 */

const store = new Map();

/**
 * Retrieves a cached value if it exists and hasn't expired.
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
  return item.value;
}

/**
 * Sets a value in the in-memory cache with a Time-To-Live (TTL) in seconds.
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds 
 */
export function setCache(key, value, ttlSeconds = 60) {
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
