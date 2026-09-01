import { Capacitor } from "@capacitor/core";
import { NativeSqlite, type SqlParam } from "@/plugins/nativeSqlite";
import { storage } from "../lib/storage";
import { Medicine, Reminder, DoseLog, Patient, WellnessLog, ScheduleAuditLog } from "../contexts/AppContext";

const LOCAL_MEDS_KEY = "dawa_local_medicines";
const LOCAL_REMS_KEY = "dawa_local_reminders";
const LOCAL_LOGS_KEY = "dawa_local_doselogs";
const LOCAL_PATIENTS_KEY = "dawa_local_patients";
const LOCAL_WELLNESS_KEY = "dawa_local_wellness";
const LOCAL_AUDIT_KEY = "dawa_local_schedule_audit";

let sqliteReady = false;
let activeUserId: string | null = null;

export function setActiveUserScope(userId: string | null): void {
  activeUserId = userId;
}

export function getPartitionKey(baseKey: string): string {
  return activeUserId ? `${baseKey}_${activeUserId}` : baseKey;
}

/**
 * Safely constructs dynamic SQL SET clauses and param arrays for partial updates.
 * Binds ONLY the fields explicitly present (not undefined) in `updates`.
 * Completely prevents partial updates from erasing omitted columns with NULL.
 */
export function buildDynamicSqlUpdate(
  tableName: string,
  id: string,
  columnMapping: Record<string, string>,
  updates: Record<string, unknown>,
  transforms?: Record<string, (val: any) => any>
): { sql: string; params: SqlParam[] } | null {
  const setClauses: string[] = [];
  const params: SqlParam[] = [];

  for (const [prop, col] of Object.entries(columnMapping)) {
    if (updates[prop] !== undefined) {
      setClauses.push(`${col} = ?`);
      const rawVal = updates[prop];
      const val = transforms && transforms[prop] ? (transforms[prop](rawVal) as SqlParam) : ((rawVal as SqlParam) ?? null);
      params.push(val);
    }
  }

  if (setClauses.length === 0) {
    return null;
  }

  if (tableName === "medicines") {
    setClauses.push("updated_at = ?");
    params.push(new Date().toISOString());
  }

  params.push(id);
  const sql = `UPDATE ${tableName} SET ${setClauses.join(", ")} WHERE id = ?`;
  return { sql, params };
}

function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return val as T;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function initLocalPersistence(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NativeSqlite.initialize();
    sqliteReady = true;
  } catch (err) {
    sqliteReady = false;
    console.warn(
      "[localPersistence] NativeSqlite init failed, falling back to storage:",
      err
    );
  }
}

export const localPersistence = {
  medicines: {
    getAll: async (): Promise<Medicine[]> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          const { rows } = await NativeSqlite.query({
            sql: "SELECT * FROM medicines ORDER BY added_at DESC",
          });
          return rows.map(
            (r) =>
              ({
                id: r.id as string,
                name: r.name as string,
                genericName: r.generic_name as string | undefined,
                dosage: r.dosage as string | undefined,
                form: r.form as string | undefined,
                currentQuantity: r.current_quantity as number | undefined,
                dosagePerDose: r.dosage_per_dose as number | undefined,
                frequencyPerDay: (r.frequency_per_day as number | undefined) || (r.frequencyPerDay as number | undefined),
                color: r.color as string | undefined,
                icon: r.icon as string | undefined,
                patientId: r.patient_id as string | null | undefined,
                userId: r.user_id as string | undefined,
                addedAt: r.added_at as string,
                updatedAt: r.updated_at as string | undefined,
                isConflict: Boolean(r.is_conflict),
                imageUrl: r.image_url as string | undefined,
                notes: r.notes as string | undefined,
              } as Medicine)
          );
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite medicines.getAll failed, using storage:", err);
        }
      }
      return storage.getItem<Medicine[]>(LOCAL_MEDS_KEY, []);
    },
    create: async (
      data: Omit<Medicine, "id" | "addedAt"> & { id?: string; addedAt?: string }
    ): Promise<Medicine> => {
      const id = data.id || `local-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 11)}`;
      const addedAt = data.addedAt || new Date().toISOString();

      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({
            sql: `INSERT INTO medicines (id,name,generic_name,dosage,form,current_quantity,dosage_per_dose,color,icon,patient_id,user_id,added_at,updated_at,is_conflict,image_url,notes)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            params: [
              id,
              data.name,
              (data as Medicine & { genericName?: string }).genericName ?? null,
              data.dosage ?? null,
              (data as Medicine & { form?: string }).form ?? null,
              data.currentQuantity ?? 0,
              data.dosagePerDose ?? 1,
              (data as Medicine & { color?: string }).color ?? null,
              (data as Medicine & { icon?: string }).icon ?? null,
              (data as Medicine & { patientId?: string | null }).patientId ??
                null,
              (data as Medicine & { userId?: string }).userId ?? null,
              addedAt,
              null,
              0,
              data.imageUrl ?? null,
              data.notes ?? null,
            ],
          });
          return { ...data, id, addedAt } as Medicine;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite medicines.create failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<Medicine[]>(LOCAL_MEDS_KEY, []);
      const newItem: Medicine = {
        ...data,
        id,
        addedAt,
      };
      all.push(newItem);
      await storage.setItem(LOCAL_MEDS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: Partial<Medicine>): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          const mapping: Record<string, string> = {
            name: "name",
            genericName: "generic_name",
            dosage: "dosage",
            form: "form",
            currentQuantity: "current_quantity",
            dosagePerDose: "dosage_per_dose",
            frequencyPerDay: "frequency_per_day",
            color: "color",
            icon: "icon",
            patientId: "patient_id",
            isConflict: "is_conflict",
            notes: "notes",
            imageUrl: "image_url",
          };
          const transforms: Record<string, (v: unknown) => unknown> = {
            isConflict: (v) => (v ? 1 : 0),
          };
          const queryObj = buildDynamicSqlUpdate("medicines", id, mapping, updates as Record<string, unknown>, transforms);
          if (queryObj) {
            await NativeSqlite.execute({
              sql: queryObj.sql,
              params: queryObj.params,
            });
            return;
          }
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite medicines.update failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<Medicine[]>(getPartitionKey(LOCAL_MEDS_KEY), []);
      const idx = all.findIndex((m) => m.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
        await storage.setItem(getPartitionKey(LOCAL_MEDS_KEY), all);
      }
    },
    remove: async (id: string): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({
            sql: "DELETE FROM medicines WHERE id=?",
            params: [id],
          });
          return;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite medicines.remove failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<Medicine[]>(LOCAL_MEDS_KEY, []);
      const filtered = all.filter((m) => m.id !== id);
      await storage.setItem(LOCAL_MEDS_KEY, filtered);
    },
    replaceAll: async (items: Medicine[]): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({ sql: "DELETE FROM medicines", params: [] });
          for (const data of items) {
            await NativeSqlite.execute({
              sql: `INSERT INTO medicines (id,name,generic_name,dosage,form,current_quantity,dosage_per_dose,color,icon,patient_id,user_id,added_at,updated_at,is_conflict,image_url,notes)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              params: [
                data.id,
                data.name,
                (data as Medicine & { genericName?: string }).genericName ?? null,
                data.dosage ?? null,
                (data as Medicine & { form?: string }).form ?? null,
                data.currentQuantity ?? 0,
                data.dosagePerDose ?? 1,
                (data as Medicine & { color?: string }).color ?? null,
                (data as Medicine & { icon?: string }).icon ?? null,
                (data as Medicine & { patientId?: string | null }).patientId ?? null,
                (data as Medicine & { userId?: string }).userId ?? null,
                data.addedAt || new Date().toISOString(),
                data.updatedAt ?? null,
                data.isConflict ? 1 : 0,
                data.imageUrl ?? null,
                data.notes ?? null,
              ],
            });
          }
          return;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite medicines.replaceAll failed, falling back to storage:", err);
        }
      }
      await storage.setItem(LOCAL_MEDS_KEY, items);
    },
  },

  reminders: {
    getAll: async (): Promise<Reminder[]> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          const { rows } = await NativeSqlite.query({
            sql: "SELECT * FROM reminders ORDER BY created_at DESC",
          });
          return rows.map(
            (r) =>
              ({
                id: r.id as string,
                medicineId: r.medicine_id as string | undefined,
                medicineName: r.medicine_name as string,
                dose: r.dose as string,
                time: r.time as string,
                repeatSchedule: r.repeat_schedule as Reminder["repeatSchedule"],
                repeatDays: safeJsonParse<number[] | undefined>(r.repeat_days, undefined),
                notes: r.notes as string | undefined,
                enabled: Boolean(r.enabled),
                createdAt: r.created_at as string,
                patientId: r.patient_id as string | null | undefined,
              } as Reminder)
          );
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite reminders.getAll failed, falling back to storage:", err);
        }
      }
      return storage.getItem<Reminder[]>(LOCAL_REMS_KEY, []);
    },
    create: async (
      data: Omit<Reminder, "id" | "createdAt"> & { id?: string; createdAt?: string }
    ): Promise<Reminder> => {
      const id = data.id || `lrem-${Date.now()}`;
      const createdAt = data.createdAt || new Date().toISOString();

      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({
            sql: `INSERT INTO reminders (id,medicine_id,medicine_name,dose,time,repeat_schedule,repeat_days,notes,enabled,created_at,patient_id)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            params: [
              id,
              data.medicineId ?? null,
              data.medicineName,
              data.dose,
              data.time,
              data.repeatSchedule,
              data.repeatDays ? JSON.stringify(data.repeatDays) : null,
              data.notes ?? null,
              data.enabled ? 1 : 0,
              createdAt,
              (data as Reminder & { patientId?: string | null }).patientId ??
                null,
            ],
          });
          return { ...data, id, createdAt } as Reminder;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite reminders.create failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<Reminder[]>(LOCAL_REMS_KEY, []);
      const newItem: Reminder = {
        ...data,
        id,
        createdAt,
      };
      all.push(newItem);
      await storage.setItem(LOCAL_REMS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: Partial<Reminder>): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          const mapping: Record<string, string> = {
            medicineName: "medicine_name",
            dose: "dose",
            time: "time",
            repeatSchedule: "repeat_schedule",
            repeatDays: "repeat_days",
            notes: "notes",
            enabled: "enabled",
            patientId: "patient_id",
          };
          const transforms: Record<string, (v: unknown) => unknown> = {
            enabled: (v) => (v ? 1 : 0),
            repeatDays: (v) => (v ? JSON.stringify(v) : null),
          };
          const queryObj = buildDynamicSqlUpdate("reminders", id, mapping, updates as Record<string, unknown>, transforms);
          if (queryObj) {
            await NativeSqlite.execute({
              sql: queryObj.sql,
              params: queryObj.params,
            });
            return;
          }
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite reminders.update failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<Reminder[]>(getPartitionKey(LOCAL_REMS_KEY), []);
      const idx = all.findIndex((r) => r.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await storage.setItem(getPartitionKey(LOCAL_REMS_KEY), all);
      }
    },
    remove: async (id: string): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({
            sql: "DELETE FROM reminders WHERE id=?",
            params: [id],
          });
          return;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite reminders.remove failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<Reminder[]>(LOCAL_REMS_KEY, []);
      const filtered = all.filter((r) => r.id !== id);
      await storage.setItem(LOCAL_REMS_KEY, filtered);
    },
    replaceAll: async (items: Reminder[]): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({ sql: "DELETE FROM reminders", params: [] });
          for (const data of items) {
            await NativeSqlite.execute({
              sql: `INSERT INTO reminders (id,medicine_id,medicine_name,dose,time,repeat_schedule,repeat_days,notes,enabled,created_at,patient_id)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
              params: [
                data.id,
                data.medicineId ?? null,
                data.medicineName,
                data.dose,
                data.time,
                data.repeatSchedule,
                data.repeatDays ? JSON.stringify(data.repeatDays) : null,
                data.notes ?? null,
                data.enabled ? 1 : 0,
                data.createdAt || new Date().toISOString(),
                (data as Reminder & { patientId?: string | null }).patientId ?? null,
              ],
            });
          }
          return;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite reminders.replaceAll failed, falling back to storage:", err);
        }
      }
      await storage.setItem(LOCAL_REMS_KEY, items);
    },
  },

  doseLogs: {
    getAll: async (): Promise<DoseLog[]> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          const { rows } = await NativeSqlite.query({
            sql: "SELECT * FROM dose_logs ORDER BY action_time DESC",
          });
          return rows.map(
            (r) =>
              ({
                id: r.id as string,
                reminderId: r.reminder_id as string,
                medicineName: r.medicine_name as string,
                dose: r.dose as string,
                scheduledTime: r.scheduled_time as string,
                actionTime: r.action_time as string,
                action: r.action as DoseLog["action"],
                isSnoozed: Boolean(r.is_snoozed),
                snoozeUntil: r.snooze_until as string | undefined,
                patientId: r.patient_id as string | null | undefined,
              } as DoseLog)
          );
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite doseLogs.getAll failed, falling back to storage:", err);
        }
      }
      return storage.getItem<DoseLog[]>(LOCAL_LOGS_KEY, []);
    },
    create: async (
      data: Omit<DoseLog, "id" | "actionTime"> & { id?: string; actionTime?: string }
    ): Promise<DoseLog> => {
      const id = data.id || `llog-${Date.now()}`;
      const actionTime = data.actionTime || new Date().toISOString();

      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({
            sql: `INSERT INTO dose_logs (id,reminder_id,medicine_name,dose,scheduled_time,action_time,action,is_snoozed,snooze_until,patient_id)
                  VALUES (?,?,?,?,?,?,?,?,?,?)`,
            params: [
              id,
              data.reminderId,
              data.medicineName,
              data.dose,
              data.scheduledTime,
              actionTime,
              data.action,
              data.isSnoozed ? 1 : 0,
              data.snoozeUntil ?? null,
              data.patientId ?? null,
            ],
          });
          return { ...data, id, actionTime } as DoseLog;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite doseLogs.create failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<DoseLog[]>(LOCAL_LOGS_KEY, []);
      const newItem: DoseLog = {
        ...data,
        id,
        actionTime,
      };
      all.push(newItem);
      await storage.setItem(LOCAL_LOGS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: Partial<DoseLog>): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          const mapping: Record<string, string> = {
            reminderId: "reminder_id",
            medicineName: "medicine_name",
            dose: "dose",
            scheduledTime: "scheduled_time",
            actionTime: "action_time",
            action: "action",
            isSnoozed: "is_snoozed",
            snoozeUntil: "snooze_until",
            patientId: "patient_id",
          };
          const transforms: Record<string, (v: unknown) => unknown> = {
            isSnoozed: (v) => (v ? 1 : 0),
          };
          const queryObj = buildDynamicSqlUpdate("dose_logs", id, mapping, updates as Record<string, unknown>, transforms);
          if (queryObj) {
            await NativeSqlite.execute({
              sql: queryObj.sql,
              params: queryObj.params,
            });
            return;
          }
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite doseLogs.update failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<DoseLog[]>(getPartitionKey(LOCAL_LOGS_KEY), []);
      const idx = all.findIndex((l) => l.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await storage.setItem(getPartitionKey(LOCAL_LOGS_KEY), all);
      }
    },
    remove: async (id: string): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({
            sql: "DELETE FROM dose_logs WHERE id=?",
            params: [id],
          });
          return;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite doseLogs.remove failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<DoseLog[]>(LOCAL_LOGS_KEY, []);
      const filtered = all.filter((l) => l.id !== id);
      await storage.setItem(LOCAL_LOGS_KEY, filtered);
    },
  },

  patients: {
    getAll: async (): Promise<Patient[]> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          const { rows } = await NativeSqlite.query({
            sql: "SELECT * FROM patients ORDER BY created_at DESC",
          });
          return rows.map(
            (r) =>
              ({
                id: r.id as string,
                name: r.name as string,
                age: r.age as number | undefined,
                gender: r.gender as Patient["gender"],
                relation: r.relation as string | undefined,
                managedBy: r.managed_by as string,
                createdAt: r.created_at as string,
              } as Patient)
          );
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite patients.getAll failed, falling back to storage:", err);
        }
      }
      return storage.getItem<Patient[]>(LOCAL_PATIENTS_KEY, []);
    },
    create: async (
      data: Omit<Patient, "id" | "createdAt" | "managedBy"> & { id?: string; createdAt?: string; managedBy?: string }
    ): Promise<Patient> => {
      const id = data.id || `local-patient-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 11)}`;
      const createdAt = data.createdAt || new Date().toISOString();
      const managedBy = data.managedBy || "local-user";

      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({
            sql: `INSERT INTO patients (id,name,age,gender,relation,managed_by,created_at)
                  VALUES (?,?,?,?,?,?,?)`,
            params: [
              id,
              data.name,
              data.age ?? null,
              data.gender ?? null,
              data.relation ?? null,
              managedBy,
              createdAt,
            ],
          });
          return { ...data, id, managedBy, createdAt } as Patient;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite patients.create failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<Patient[]>(LOCAL_PATIENTS_KEY, []);
      const newItem: Patient = {
        ...data,
        id,
        managedBy,
        createdAt,
      };
      all.push(newItem);
      await storage.setItem(LOCAL_PATIENTS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: Partial<Patient>): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          const mapping: Record<string, string> = {
            name: "name",
            age: "age",
            gender: "gender",
            relation: "relation",
          };
          const queryObj = buildDynamicSqlUpdate("patients", id, mapping, updates as Record<string, unknown>);
          if (queryObj) {
            await NativeSqlite.execute({
              sql: queryObj.sql,
              params: queryObj.params,
            });
            return;
          }
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite patients.update failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<Patient[]>(getPartitionKey(LOCAL_PATIENTS_KEY), []);
      const idx = all.findIndex((p) => p.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await storage.setItem(getPartitionKey(LOCAL_PATIENTS_KEY), all);
      }
    },
    remove: async (id: string): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({
            sql: "DELETE FROM patients WHERE id=?",
            params: [id],
          });
          return;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite patients.remove failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<Patient[]>(LOCAL_PATIENTS_KEY, []);
      const filtered = all.filter((p) => p.id !== id);
      await storage.setItem(LOCAL_PATIENTS_KEY, filtered);
    },
  },

  wellnessLogs: {
    getAll: async (): Promise<WellnessLog[]> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          const { rows } = await NativeSqlite.query({
            sql: "SELECT * FROM wellness_logs ORDER BY timestamp DESC",
          });
          return rows.map(
            (r) =>
              ({
                id: r.id as string,
                type: r.type as WellnessLog["type"],
                timestamp: r.timestamp as string,
                data: safeJsonParse<Record<string, unknown>>(r.data, {}),
                userId: r.user_id as string,
                patientId: r.patient_id as string | null | undefined,
              } as WellnessLog)
          );
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite wellnessLogs.getAll failed, falling back to storage:", err);
        }
      }
      return storage.getItem<WellnessLog[]>(LOCAL_WELLNESS_KEY, []);
    },
    create: async (
      data: Omit<WellnessLog, "id" | "timestamp" | "userId"> & { id?: string; timestamp?: string; userId?: string }
    ): Promise<WellnessLog> => {
      const id = data.id || `lwell-${Date.now()}`;
      const timestamp = data.timestamp || new Date().toISOString();
      const userId = data.userId || "local";

      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({
            sql: `INSERT INTO wellness_logs (id,type,timestamp,data,user_id,patient_id)
                  VALUES (?,?,?,?,?,?)`,
            params: [
              id,
              data.type,
              timestamp,
              JSON.stringify(data.data),
              userId,
              data.patientId ?? null,
            ],
          });
          return { ...data, id, timestamp, userId } as WellnessLog;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite wellnessLogs.create failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<WellnessLog[]>(LOCAL_WELLNESS_KEY, []);
      const newItem: WellnessLog = { ...data, id, timestamp, userId };
      all.push(newItem);
      await storage.setItem(LOCAL_WELLNESS_KEY, all);
      return newItem;
    },
    remove: async (id: string): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        try {
          await NativeSqlite.execute({
            sql: "DELETE FROM wellness_logs WHERE id=?",
            params: [id],
          });
          return;
        } catch (err) {
          console.warn("[localPersistence] NativeSqlite wellnessLogs.remove failed, falling back to storage:", err);
        }
      }
      const all = await storage.getItem<WellnessLog[]>(LOCAL_WELLNESS_KEY, []);
      const filtered = all.filter((l) => l.id !== id);
      await storage.setItem(LOCAL_WELLNESS_KEY, filtered);
    },
  },
  scheduleAuditLogs: {
    getAll: async (): Promise<ScheduleAuditLog[]> => {
      return storage.getItem<ScheduleAuditLog[]>(LOCAL_AUDIT_KEY, []);
    },
    create: async (
      data: Omit<ScheduleAuditLog, "id">
    ): Promise<ScheduleAuditLog> => {
      const id = `laudit-${Date.now()}`;
      const all = await storage.getItem<ScheduleAuditLog[]>(LOCAL_AUDIT_KEY, []);
      const newItem: ScheduleAuditLog = { ...data, id };
      all.push(newItem);
      await storage.setItem(LOCAL_AUDIT_KEY, all);
      return newItem;
    },
    remove: async (id: string): Promise<void> => {
      const all = await storage.getItem<ScheduleAuditLog[]>(LOCAL_AUDIT_KEY, []);
      const filtered = all.filter((l) => l.id !== id);
      await storage.setItem(LOCAL_AUDIT_KEY, filtered);
    },
  },
};

/**
 * Completely purges per-user or all cached data from Native SQLite and local storage.
 * Executed on logout, account switch, or manual privacy wipe.
 */
export async function clearAllLocalPersistence(userId?: string): Promise<void> {
  const targetUser = userId || activeUserId;
  if (Capacitor.isNativePlatform() && sqliteReady) {
    try {
      if (targetUser) {
        await NativeSqlite.execute({ sql: "DELETE FROM medicines WHERE user_id = ?", params: [targetUser] });
        await NativeSqlite.execute({ sql: "DELETE FROM wellness_logs WHERE user_id = ?", params: [targetUser] });
      } else {
        await NativeSqlite.execute({ sql: "DELETE FROM medicines", params: [] });
        await NativeSqlite.execute({ sql: "DELETE FROM reminders", params: [] });
        await NativeSqlite.execute({ sql: "DELETE FROM dose_logs", params: [] });
        await NativeSqlite.execute({ sql: "DELETE FROM patients", params: [] });
        await NativeSqlite.execute({ sql: "DELETE FROM wellness_logs", params: [] });
      }
    } catch (e) {
      console.warn("[localPersistence] Failed to wipe SQLite tables:", e);
    }
  }

  // Clear unpartitioned & partitioned storage keys
  const keys = [LOCAL_MEDS_KEY, LOCAL_REMS_KEY, LOCAL_LOGS_KEY, LOCAL_PATIENTS_KEY, LOCAL_WELLNESS_KEY, LOCAL_AUDIT_KEY];
  for (const k of keys) {
    storage.removeItem(k);
    if (targetUser) {
      storage.removeItem(`${k}_${targetUser}`);
    }
  }
}


