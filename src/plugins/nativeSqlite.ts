/**
 * NativeSqlite — Capacitor plugin for indexed local storage.
 *
 * Replaces the full-array read-modify-write pattern of @capacitor/preferences
 * with a proper SQLite database on-device:
 *   Android: SQLiteDatabase in private app storage
 *   iOS:     SQLite3 C library with .completeUnlessOpen data protection (AES-256)
 *
 * The database schema mirrors the shape of localPersistence.ts collections so
 * the upgrade is transparent to the rest of the app.
 */
import { registerPlugin } from '@capacitor/core';

export interface NativeSqlitePlugin {
  initialize(): Promise<void>;
  execute(options: { sql: string; params?: (string | number | null)[] }): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  query(options: { sql: string; params?: (string | number | null)[] }): Promise<{ rows: Record<string, unknown>[] }>;
  close(): Promise<void>;
}

const NativeSqlite = registerPlugin<NativeSqlitePlugin>('NativeSqlite');
export { NativeSqlite };
