/**
 * Provides a similar interface to api.ts but interacts with IndexedDB via our storage utility.
 * This is used for "Local-Only" mode which is privacy-first and doesn't require an account.
 * Making this asynchronous ensures the main thread remains responsive.
 */
import { storage } from "../lib/storage";

const LOCAL_MEDS_KEY = "dawa_local_medicines";
const LOCAL_REMS_KEY = "dawa_local_reminders";
const LOCAL_LOGS_KEY = "dawa_local_doselogs";

export const localPersistence = {
  medicines: {
    getAll: () => storage.getItem<any[]>(LOCAL_MEDS_KEY, []),
    create: async (data: any) => {
      const all = await storage.getItem<any[]>(LOCAL_MEDS_KEY, []);
      const newItem = { ...data, id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, addedAt: new Date().toISOString() };
      all.push(newItem);
      await storage.setItem(LOCAL_MEDS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: any) => {
      const all = await storage.getItem<any[]>(LOCAL_MEDS_KEY, []);
      const idx = all.findIndex((m: any) => m.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await storage.setItem(LOCAL_MEDS_KEY, all);
      }
    },
    remove: async (id: string) => {
      const all = await storage.getItem<any[]>(LOCAL_MEDS_KEY, []);
      const filtered = all.filter((m: any) => m.id !== id);
      await storage.setItem(LOCAL_MEDS_KEY, filtered);
    }
  },
  reminders: {
    getAll: () => storage.getItem<any[]>(LOCAL_REMS_KEY, []),
    create: async (data: any) => {
      const all = await storage.getItem<any[]>(LOCAL_REMS_KEY, []);
      const newItem = { ...data, id: `lrem-${Date.now()}`, createdAt: new Date().toISOString() };
      all.push(newItem);
      await storage.setItem(LOCAL_REMS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: any) => {
      const all = await storage.getItem<any[]>(LOCAL_REMS_KEY, []);
      const idx = all.findIndex((r: any) => r.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await storage.setItem(LOCAL_REMS_KEY, all);
      }
    },
    remove: async (id: string) => {
      const all = await storage.getItem<any[]>(LOCAL_REMS_KEY, []);
      const filtered = all.filter((r: any) => r.id !== id);
      await storage.setItem(LOCAL_REMS_KEY, filtered);
    }
  },
  doseLogs: {
    getAll: () => storage.getItem<any[]>(LOCAL_LOGS_KEY, []),
    create: async (data: any) => {
      const all = await storage.getItem<any[]>(LOCAL_LOGS_KEY, []);
      const newItem = { ...data, id: `llog-${Date.now()}`, actionTime: new Date().toISOString() };
      all.push(newItem);
      await storage.setItem(LOCAL_LOGS_KEY, all);
      return newItem;
    },
    remove: async (id: string) => {
      const all = await storage.getItem<any[]>(LOCAL_LOGS_KEY, []);
      const filtered = all.filter((l: any) => l.id !== id);
      await storage.setItem(LOCAL_LOGS_KEY, filtered);
    }
  }
};
