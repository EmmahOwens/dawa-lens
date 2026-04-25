import { get, set, del, clear } from 'idb-keyval';

/**
 * Non-blocking storage wrapper using IndexedDB (via idb-keyval).
 * This prevents main-thread jank during heavy data operations on mobile.
 */
export const storage = {
  async getItem<T>(key: string, fallback: T): Promise<T> {
    try {
      const value = await get(key);
      return value !== undefined ? value : fallback;
    } catch (err) {
      console.warn(`Storage get failed for key "${key}":`, err);
      return fallback;
    }
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      await set(key, value);
    } catch (err) {
      console.error(`Storage set failed for key "${key}":`, err);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await del(key);
    } catch (err) {
      console.error(`Storage remove failed for key "${key}":`, err);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await clear();
    } catch (err) {
      console.error('Storage clear failed:', err);
    }
  }
};
