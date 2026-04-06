/**
 * Provides a similar interface to api.ts but interacts only with localStorage.
 * This is used for "Local-Only" mode which is privacy-first and doesn't require an account.
 */

const LOCAL_MEDS_KEY = "dawa_local_medicines";
const LOCAL_REMS_KEY = "dawa_local_reminders";
const LOCAL_LOGS_KEY = "dawa_local_doselogs";

function get<T>(key: string): T[] {
  const s = localStorage.getItem(key);
  return s ? JSON.parse(s) : [];
}

function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

export const localPersistence = {
  medicines: {
    getAll: () => get<any>(LOCAL_MEDS_KEY),
    create: (data: any) => {
      const all = get<any>(LOCAL_MEDS_KEY);
      const newItem = { ...data, id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, addedAt: new Date().toISOString() };
      all.push(newItem);
      save(LOCAL_MEDS_KEY, all);
      return newItem;
    },
    update: (id: string, updates: any) => {
      const all = get<any>(LOCAL_MEDS_KEY);
      const idx = all.findIndex((m: any) => m.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        save(LOCAL_MEDS_KEY, all);
      }
    },
    remove: (id: string) => {
      const all = get<any>(LOCAL_MEDS_KEY).filter((m: any) => m.id !== id);
      save(LOCAL_MEDS_KEY, all);
    }
  },
  reminders: {
    getAll: () => get<any>(LOCAL_REMS_KEY),
    create: (data: any) => {
      const all = get<any>(LOCAL_REMS_KEY);
      const newItem = { ...data, id: `lrem-${Date.now()}`, createdAt: new Date().toISOString() };
      all.push(newItem);
      save(LOCAL_REMS_KEY, all);
      return newItem;
    },
    update: (id: string, updates: any) => {
      const all = get<any>(LOCAL_REMS_KEY);
      const idx = all.findIndex((r: any) => r.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        save(LOCAL_REMS_KEY, all);
      }
    },
    remove: (id: string) => {
      const all = get<any>(LOCAL_REMS_KEY).filter((r: any) => r.id !== id);
      save(LOCAL_REMS_KEY, all);
    }
  },
  doseLogs: {
    getAll: () => get<any>(LOCAL_LOGS_KEY),
    create: (data: any) => {
      const all = get<any>(LOCAL_LOGS_KEY);
      const newItem = { ...data, id: `llog-${Date.now()}`, actionTime: new Date().toISOString() };
      all.push(newItem);
      save(LOCAL_LOGS_KEY, all);
      return newItem;
    }
  }
};
