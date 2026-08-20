import { Medicine, Reminder } from "../contexts/AppContext";

export const LOW_STOCK_THRESHOLD = 3;     // Days: amber warning (3 days)
export const CRITICAL_STOCK_THRESHOLD = 2; // Days: red critical alert (<= 2 days)

export interface RefillStatus {
  medicineId: string;
  medicineName: string;
  daysRemaining: number | null;
  dosesRemaining: number | null;
  currentQuantity: number;
  dailyDoseTotal?: number;
  frequencyPerDay?: number;
  dosagePerDose?: number;
  isOutOfStock?: boolean;
  isLow: boolean;    // true if <= CRITICAL_STOCK_THRESHOLD (red)
  isWarning: boolean; // true if <= LOW_STOCK_THRESHOLD but > critical (amber)
}

/**
 * Calculates the total daily units consumed for a medicine based on
 * its dosage per dose, daily frequency, and active scheduled reminders.
 */
export function getDailyDoseRate(
  medicine: Medicine,
  reminders: Reminder[] = []
): number {
  const { id, name, dosagePerDose, frequencyPerDay } = medicine;
  const doseVal = dosagePerDose && dosagePerDose > 0 ? dosagePerDose : 1;
  const freqVal = frequencyPerDay && frequencyPerDay > 0 ? frequencyPerDay : 1;
  const defaultDailyRate = doseVal * freqVal;

  // Find all enabled reminders for this medicine (matching ID or case-insensitive name)
  const medReminders = reminders.filter(
    (r) =>
      r.enabled !== false &&
      (r.medicineId === id ||
        (!r.medicineId && r.medicineName?.trim().toLowerCase() === name?.trim().toLowerCase()))
  );

  if (medReminders.length === 0) {
    // Fallback baseline: dosagePerDose * frequencyPerDay (default 1 dose/day)
    return defaultDailyRate;
  }

  let dailyDoseSum = 0;

  for (const rem of medReminders) {
    // Dose per slot: prioritize medicine's dosagePerDose, fallback to numeric parsing from rem.dose
    const parsedRemDose = parseFloat(rem.dose);
    const slotDose =
      dosagePerDose && dosagePerDose > 0
        ? dosagePerDose
        : !isNaN(parsedRemDose) && parsedRemDose > 0
        ? parsedRemDose
        : 1;

    const timesCount = (rem.time || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean).length || 1;

    if (rem.repeatSchedule === "daily") {
      dailyDoseSum += slotDose * timesCount;
    } else if (rem.repeatSchedule === "custom") {
      const daysCount =
        rem.repeatDays && rem.repeatDays.length > 0 ? rem.repeatDays.length : 7;
      dailyDoseSum += (slotDose * timesCount * daysCount) / 7;
    } else if (rem.repeatSchedule === "weekly") {
      const daysCount =
        rem.repeatDays && rem.repeatDays.length > 0 ? rem.repeatDays.length : 1;
      dailyDoseSum += (slotDose * timesCount * daysCount) / 7;
    } else {
      // Fallback for once or other schedules
      dailyDoseSum += slotDose * timesCount;
    }
  }

  return dailyDoseSum > 0 ? dailyDoseSum : defaultDailyRate;
}

/**
 * Calculates how many doses and days of medication remain based on current supply
 * and scheduled daily dosage / frequency.
 */
export function calculateRefillStatus(
  medicine: Medicine,
  reminders: Reminder[] = []
): RefillStatus | null {
  const { id, name, currentQuantity, dosagePerDose, frequencyPerDay } = medicine;

  if (currentQuantity === undefined) return null;

  const perDose = dosagePerDose && dosagePerDose > 0 ? dosagePerDose : 1;
  const dosesRemaining = Math.floor(currentQuantity / perDose);

  const dailyDoseTotal = getDailyDoseRate(medicine, reminders);
  const daysRemaining =
    dailyDoseTotal > 0
      ? Math.floor(currentQuantity / dailyDoseTotal)
      : currentQuantity === 0
      ? 0
      : null;

  const isOutOfStock = currentQuantity === 0;

  // Status flags strictly derived from dosage-based days remaining
  const isLow =
    isOutOfStock ||
    (daysRemaining !== null && daysRemaining <= CRITICAL_STOCK_THRESHOLD);

  const isWarning =
    !isLow &&
    daysRemaining !== null &&
    daysRemaining <= LOW_STOCK_THRESHOLD;

  return {
    medicineId: id,
    medicineName: name,
    daysRemaining,
    dosesRemaining,
    currentQuantity,
    dailyDoseTotal,
    frequencyPerDay: frequencyPerDay && frequencyPerDay > 0 ? frequencyPerDay : 1,
    dosagePerDose: perDose,
    isOutOfStock,
    isLow,
    isWarning,
  };
}

/**
 * Helper to suggest a refill date.
 */
export function getRefillDate(daysRemaining: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysRemaining);
  return date;
}
