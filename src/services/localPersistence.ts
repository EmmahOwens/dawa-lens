import { storage } from "../lib/storage";
import { Medicine, Reminder, DoseLog } from "../contexts/AppContext";

const LOCAL_MEDS_KEY = "dawa_local_medicines";
const LOCAL_REMS_KEY = "dawa_local_reminders";
const LOCAL_LOGS_KEY = "dawa_local_doselogs";

export const localPersistence = {
  medicines: {
    getAll: () => storage.getItem<Medicine[]>(LOCAL_MEDS_KEY, []),
    create: async (data: Omit<Medicine, "id" | "addedAt">) => {
      const all = await storage.getItem<Medicine[]>(LOCAL_MEDS_KEY, []);
      const newItem: Medicine = { 
        ...data, 
        id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`, 
        addedAt: new Date().toISOString() 
      };
      all.push(newItem);
      await storage.setItem(LOCAL_MEDS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: Partial<Medicine>) => {
      const all = await storage.getItem<Medicine[]>(LOCAL_MEDS_KEY, []);
      const idx = all.findIndex((m) => m.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await storage.setItem(LOCAL_MEDS_KEY, all);
      }
    },
    remove: async (id: string) => {
      const all = await storage.getItem<Medicine[]>(LOCAL_MEDS_KEY, []);
      const filtered = all.filter((m) => m.id !== id);
      await storage.setItem(LOCAL_MEDS_KEY, filtered);
    }
  },
  reminders: {
    getAll: () => storage.getItem<Reminder[]>(LOCAL_REMS_KEY, []),
    create: async (data: Omit<Reminder, "id" | "createdAt">) => {
      const all = await storage.getItem<Reminder[]>(LOCAL_REMS_KEY, []);
      const newItem: Reminder = { ...data, id: `lrem-${Date.now()}`, createdAt: new Date().toISOString() };
      all.push(newItem);
      await storage.setItem(LOCAL_REMS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: Partial<Reminder>) => {
      const all = await storage.getItem<Reminder[]>(LOCAL_REMS_KEY, []);
      const idx = all.findIndex((r) => r.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await storage.setItem(LOCAL_REMS_KEY, all);
      }
    },
    remove: async (id: string) => {
      const all = await storage.getItem<Reminder[]>(LOCAL_REMS_KEY, []);
      const filtered = all.filter((r) => r.id !== id);
      await storage.setItem(LOCAL_REMS_KEY, filtered);
    }
  },
  doseLogs: {
    getAll: () => storage.getItem<DoseLog[]>(LOCAL_LOGS_KEY, []),
    create: async (data: Omit<DoseLog, "id" | "actionTime">) => {
      const all = await storage.getItem<DoseLog[]>(LOCAL_LOGS_KEY, []);
      const newItem: DoseLog = { ...data, id: `llog-${Date.now()}`, actionTime: new Date().toISOString() };
      all.push(newItem);
      await storage.setItem(LOCAL_LOGS_KEY, all);
      return newItem;
    },
    remove: async (id: string) => {
      const all = await storage.getItem<DoseLog[]>(LOCAL_LOGS_KEY, []);
      const filtered = all.filter((l) => l.id !== id);
      await storage.setItem(LOCAL_LOGS_KEY, filtered);
    }
  }
};
