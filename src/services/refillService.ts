import { Medicine, Reminder } from "../contexts/AppContext";

export const LOW_STOCK_THRESHOLD = 5;     // Days: amber warning
export const CRITICAL_STOCK_THRESHOLD = 2; // Days: red critical alert

export interface RefillStatus {
  medicineId: string;
  medicineName: string;
  daysRemaining: number;
  currentQuantity: number;
  isLow: boolean;    // true if <= CRITICAL_STOCK_THRESHOLD (red)
  isWarning: boolean; // true if <= LOW_STOCK_THRESHOLD but > critical (amber)
}

/**
 * Calculates how many days of medication remain based on current supply
 * and scheduled reminders.
 */
export function calculateRefillStatus(
  medicine: Medicine,
  reminders: Reminder[]
): RefillStatus | null {
  const { id, name, currentQuantity, dosagePerDose } = medicine;
  
  if (currentQuantity === undefined || !dosagePerDose) return null;

  // Find all enabled reminders for this medicine
  const medReminders = reminders.filter(r => r.medicineId === id && r.enabled);
  if (medReminders.length === 0) return null;

  // Calculate daily dose sum
  let dailyDoseTotal = 0;
  for (const rem of medReminders) {
    if (rem.repeatSchedule === "daily") {
      dailyDoseTotal += dosagePerDose;
    } else if (rem.repeatSchedule === "custom") {
      const timesPerDay = rem.time.split(",").length;
      if (rem.repeatDays && rem.repeatDays.length > 0) {
        dailyDoseTotal += (dosagePerDose * timesPerDay * rem.repeatDays.length) / 7;
      } else {
        dailyDoseTotal += (dosagePerDose * timesPerDay);
      }
    } else if (rem.repeatSchedule === "weekly" && rem.repeatDays) {
      // Average daily dose for weekly schedule
      dailyDoseTotal += (dosagePerDose * rem.repeatDays.length) / 7;
    } else {
      // Fallback for other schedules
      dailyDoseTotal += dosagePerDose;
    }
  }

  if (dailyDoseTotal === 0) return null;

  const daysRemaining = Math.floor(currentQuantity / dailyDoseTotal);

  return {
    medicineId: id,
    medicineName: name,
    daysRemaining,
    currentQuantity,
    isLow: daysRemaining <= CRITICAL_STOCK_THRESHOLD,
    isWarning: daysRemaining > CRITICAL_STOCK_THRESHOLD && daysRemaining <= LOW_STOCK_THRESHOLD,
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
