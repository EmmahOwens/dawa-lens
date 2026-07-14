import { Capacitor } from "@capacitor/core";
import { NativeSqlite } from "@/plugins/nativeSqlite";
import { storage } from "../lib/storage";
import { Medicine, Reminder, DoseLog, Patient, WellnessLog, ScheduleAuditLog } from "../contexts/AppContext";

const LOCAL_MEDS_KEY = "dawa_local_medicines";
const LOCAL_REMS_KEY = "dawa_local_reminders";
const LOCAL_LOGS_KEY = "dawa_local_doselogs";
const LOCAL_PATIENTS_KEY = "dawa_local_patients";
const LOCAL_WELLNESS_KEY = "dawa_local_wellness";
const LOCAL_AUDIT_KEY = "dawa_local_schedule_audit";

let sqliteReady = false;

export async function initLocalPersistence(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NativeSqlite.initialize();
    sqliteReady = true;
  } catch (err) {
    console.warn(
      "[localPersistence] NativeSqlite init failed, falling back to preferences:",
      err
    );
  }
}

export const localPersistence = {
  medicines: {
    getAll: async (): Promise<Medicine[]> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
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
      }
      return storage.getItem<Medicine[]>(LOCAL_MEDS_KEY, []);
    },
    create: async (
      data: Omit<Medicine, "id" | "addedAt"> & { id?: string; addedAt?: string }
    ): Promise<Medicine> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        const id = data.id || `local-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 11)}`;
        const addedAt = data.addedAt || new Date().toISOString();
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
      }
      const all = await storage.getItem<Medicine[]>(LOCAL_MEDS_KEY, []);
      const newItem: Medicine = {
        ...data,
        id: data.id || `local-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 11)}`,
        addedAt: data.addedAt || new Date().toISOString(),
      };
      all.push(newItem);
      await storage.setItem(LOCAL_MEDS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: Partial<Medicine>): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        await NativeSqlite.execute({
          sql: `UPDATE medicines SET name=?,generic_name=?,dosage=?,current_quantity=?,dosage_per_dose=?,
                color=?,icon=?,patient_id=?,updated_at=?,is_conflict=?,notes=? WHERE id=?`,
          params: [
            updates.name ?? null,
            (updates as Partial<Medicine> & { genericName?: string })
              .genericName ?? null,
            updates.dosage ?? null,
            updates.currentQuantity ?? null,
            updates.dosagePerDose ?? null,
            (updates as Partial<Medicine> & { color?: string }).color ?? null,
            (updates as Partial<Medicine> & { icon?: string }).icon ?? null,
            (updates as Partial<Medicine> & { patientId?: string | null })
              .patientId ?? null,
            new Date().toISOString(),
            (updates as Partial<Medicine> & { isConflict?: boolean }).isConflict
              ? 1
              : 0,
            updates.notes ?? null,
            id,
          ],
        });
        return;
      }
      const all = await storage.getItem<Medicine[]>(LOCAL_MEDS_KEY, []);
      const idx = all.findIndex((m) => m.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await storage.setItem(LOCAL_MEDS_KEY, all);
      }
    },
    remove: async (id: string): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        await NativeSqlite.execute({
          sql: "DELETE FROM medicines WHERE id=?",
          params: [id],
        });
        return;
      }
      const all = await storage.getItem<Medicine[]>(LOCAL_MEDS_KEY, []);
      const filtered = all.filter((m) => m.id !== id);
      await storage.setItem(LOCAL_MEDS_KEY, filtered);
    },
  },

  reminders: {
    getAll: async (): Promise<Reminder[]> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
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
              repeatDays: r.repeat_days
                ? (JSON.parse(r.repeat_days as string) as number[])
                : undefined,
              notes: r.notes as string | undefined,
              enabled: Boolean(r.enabled),
              createdAt: r.created_at as string,
              patientId: r.patient_id as string | null | undefined,
            } as Reminder)
        );
      }
      return storage.getItem<Reminder[]>(LOCAL_REMS_KEY, []);
    },
    create: async (
      data: Omit<Reminder, "id" | "createdAt"> & { id?: string; createdAt?: string }
    ): Promise<Reminder> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        const id = data.id || `lrem-${Date.now()}`;
        const createdAt = data.createdAt || new Date().toISOString();
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
      }
      const all = await storage.getItem<Reminder[]>(LOCAL_REMS_KEY, []);
      const newItem: Reminder = {
        ...data,
        id: data.id || `lrem-${Date.now()}`,
        createdAt: data.createdAt || new Date().toISOString(),
      };
      all.push(newItem);
      await storage.setItem(LOCAL_REMS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: Partial<Reminder>): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        await NativeSqlite.execute({
          sql: `UPDATE reminders SET medicine_name=?,dose=?,time=?,repeat_schedule=?,repeat_days=?,notes=?,enabled=?,patient_id=? WHERE id=?`,
          params: [
            updates.medicineName ?? null,
            updates.dose ?? null,
            updates.time ?? null,
            updates.repeatSchedule ?? null,
            updates.repeatDays ? JSON.stringify(updates.repeatDays) : null,
            updates.notes ?? null,
            updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : null,
            (updates as Partial<Reminder> & { patientId?: string | null })
              .patientId ?? null,
            id,
          ],
        });
        return;
      }
      const all = await storage.getItem<Reminder[]>(LOCAL_REMS_KEY, []);
      const idx = all.findIndex((r) => r.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await storage.setItem(LOCAL_REMS_KEY, all);
      }
    },
    remove: async (id: string): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        await NativeSqlite.execute({
          sql: "DELETE FROM reminders WHERE id=?",
          params: [id],
        });
        return;
      }
      const all = await storage.getItem<Reminder[]>(LOCAL_REMS_KEY, []);
      const filtered = all.filter((r) => r.id !== id);
      await storage.setItem(LOCAL_REMS_KEY, filtered);
    },
  },

  doseLogs: {
    getAll: async (): Promise<DoseLog[]> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
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
      }
      return storage.getItem<DoseLog[]>(LOCAL_LOGS_KEY, []);
    },
    create: async (
      data: Omit<DoseLog, "id" | "actionTime"> & { id?: string; actionTime?: string }
    ): Promise<DoseLog> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        const id = data.id || `llog-${Date.now()}`;
        const actionTime = data.actionTime || new Date().toISOString();
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
      }
      const all = await storage.getItem<DoseLog[]>(LOCAL_LOGS_KEY, []);
      const newItem: DoseLog = {
        ...data,
        id: data.id || `llog-${Date.now()}`,
        actionTime: data.actionTime || new Date().toISOString(),
      };
      all.push(newItem);
      await storage.setItem(LOCAL_LOGS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: Partial<DoseLog>): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        await NativeSqlite.execute({
          sql: `UPDATE dose_logs SET reminder_id=?,medicine_name=?,dose=?,scheduled_time=?,action_time=?,action=?,is_snoozed=?,snooze_until=?,patient_id=? WHERE id=?`,
          params: [
            updates.reminderId ?? null,
            updates.medicineName ?? null,
            updates.dose ?? null,
            updates.scheduledTime ?? null,
            updates.actionTime ?? null,
            updates.action ?? null,
            updates.isSnoozed !== undefined ? (updates.isSnoozed ? 1 : 0) : null,
            updates.snoozeUntil ?? null,
            updates.patientId ?? null,
            id,
          ],
        });
        return;
      }
      const all = await storage.getItem<DoseLog[]>(LOCAL_LOGS_KEY, []);
      const idx = all.findIndex((l) => l.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await storage.setItem(LOCAL_LOGS_KEY, all);
      }
    },
    remove: async (id: string): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        await NativeSqlite.execute({
          sql: "DELETE FROM dose_logs WHERE id=?",
          params: [id],
        });
        return;
      }
      const all = await storage.getItem<DoseLog[]>(LOCAL_LOGS_KEY, []);
      const filtered = all.filter((l) => l.id !== id);
      await storage.setItem(LOCAL_LOGS_KEY, filtered);
    },
  },

  patients: {
    getAll: async (): Promise<Patient[]> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
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
      }
      return storage.getItem<Patient[]>(LOCAL_PATIENTS_KEY, []);
    },
    create: async (
      data: Omit<Patient, "id" | "createdAt" | "managedBy"> & { id?: string; createdAt?: string; managedBy?: string }
    ): Promise<Patient> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        const id = data.id || `local-patient-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 11)}`;
        const createdAt = data.createdAt || new Date().toISOString();
        const managedBy = data.managedBy || "local-user";
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
      }
      const all = await storage.getItem<Patient[]>(LOCAL_PATIENTS_KEY, []);
      const newItem: Patient = {
        ...data,
        id: data.id || `local-patient-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 11)}`,
        managedBy: data.managedBy || "local-user",
        createdAt: data.createdAt || new Date().toISOString(),
      };
      all.push(newItem);
      await storage.setItem(LOCAL_PATIENTS_KEY, all);
      return newItem;
    },
    update: async (id: string, updates: Partial<Patient>): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        await NativeSqlite.execute({
          sql: `UPDATE patients SET name=?,age=?,gender=?,relation=? WHERE id=?`,
          params: [
            updates.name ?? null,
            updates.age ?? null,
            updates.gender ?? null,
            updates.relation ?? null,
            id,
          ],
        });
        return;
      }
      const all = await storage.getItem<Patient[]>(LOCAL_PATIENTS_KEY, []);
      const idx = all.findIndex((p) => p.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        await storage.setItem(LOCAL_PATIENTS_KEY, all);
      }
    },
    remove: async (id: string): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        await NativeSqlite.execute({
          sql: "DELETE FROM patients WHERE id=?",
          params: [id],
        });
        return;
      }
      const all = await storage.getItem<Patient[]>(LOCAL_PATIENTS_KEY, []);
      const filtered = all.filter((p) => p.id !== id);
      await storage.setItem(LOCAL_PATIENTS_KEY, filtered);
    },
  },

  wellnessLogs: {
    getAll: async (): Promise<WellnessLog[]> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        const { rows } = await NativeSqlite.query({
          sql: "SELECT * FROM wellness_logs ORDER BY timestamp DESC",
        });
        return rows.map(
          (r) =>
            ({
              id: r.id as string,
              type: r.type as WellnessLog["type"],
              timestamp: r.timestamp as string,
              data: JSON.parse(r.data as string),
              userId: r.user_id as string,
              patientId: r.patient_id as string | null | undefined,
            } as WellnessLog)
        );
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
      }
      const all = await storage.getItem<WellnessLog[]>(LOCAL_WELLNESS_KEY, []);
      const newItem: WellnessLog = { ...data, id, timestamp, userId };
      all.push(newItem);
      await storage.setItem(LOCAL_WELLNESS_KEY, all);
      return newItem;
    },
    remove: async (id: string): Promise<void> => {
      if (Capacitor.isNativePlatform() && sqliteReady) {
        await NativeSqlite.execute({
          sql: "DELETE FROM wellness_logs WHERE id=?",
          params: [id],
        });
        return;
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
