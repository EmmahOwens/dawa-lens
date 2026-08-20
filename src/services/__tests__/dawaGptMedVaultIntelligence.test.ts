import { describe, it, expect } from "vitest";
import { calculateRefillStatus, getDailyDoseRate } from "../refillService";
import { generateDawaGPTResponse, getMedVaultSystemContext } from "../aiAssistantService";
import { Medicine, Reminder } from "@/contexts/AppContext";

describe("DawaGPT Med Vault Dose vs Days Intelligence", () => {
  const panadolTwiceDaily: Medicine = {
    id: "panadol-101",
    name: "Panadol Extra",
    dosage: "500mg",
    dosagePerDose: 2, // 2 tablets per intake
    frequencyPerDay: 2, // taken twice daily
    currentQuantity: 20, // 20 tablets in stock
    totalQuantity: 40,
    unit: "tablets",
    addedAt: new Date().toISOString(),
  };

  const panadolReminder: Reminder = {
    id: "rem-panadol-twice",
    medicineId: "panadol-101",
    medicineName: "Panadol Extra",
    dose: "2 tablets",
    time: "08:00, 20:00", // 2 times a day
    repeatSchedule: "daily",
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  it("accurately differentiates doses remaining (10 doses) vs days of supply (5 days) for twice-daily Panadol", () => {
    // 20 tablets, 2 tablets per dose = 10 doses
    // 2 tablets per dose * 2 times a day = 4 tablets/day
    // 20 tablets / 4 tablets/day = 5 days of supply
    const clientStatus = calculateRefillStatus(panadolTwiceDaily, [panadolReminder]);
    expect(clientStatus?.dosesRemaining).toBe(10);
    expect(clientStatus?.daysRemaining).toBe(5);
    expect(clientStatus?.dailyDoseTotal).toBe(4);
    expect(clientStatus?.isLow).toBe(false);
    expect(clientStatus?.isWarning).toBe(false);
  });

  it("handles 3 times daily dosing (e.g. Amoxicillin 2 capsules 3x/day, 30 capsules in vault = 15 doses = 5 days)", () => {
    const amoxicillin: Medicine = {
      id: "amox-3x",
      name: "Amoxicillin",
      dosage: "500mg",
      dosagePerDose: 2,
      frequencyPerDay: 3,
      currentQuantity: 30,
      totalQuantity: 60,
      unit: "capsules",
      addedAt: new Date().toISOString(),
    };

    const reminder: Reminder = {
      id: "rem-amox-3x",
      medicineId: "amox-3x",
      medicineName: "Amoxicillin",
      dose: "2 capsules",
      time: "08:00, 14:00, 20:00",
      repeatSchedule: "daily",
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    const dailyRate = getDailyDoseRate(amoxicillin, [reminder]);
    expect(dailyRate).toBe(6); // 2 * 3 = 6 capsules/day

    const status = calculateRefillStatus(amoxicillin, [reminder]);
    expect(status?.dosesRemaining).toBe(15); // 30 / 2 = 15 doses
    expect(status?.daysRemaining).toBe(5); // 30 / 6 = 5 days
    expect(status?.isLow).toBe(false);
    expect(status?.isWarning).toBe(false);
  });

  it("identifies critical stock (<= 2 days) and low stock (<= 3 days) accurately based on frequency", () => {
    const met: Medicine = {
      id: "met-1",
      name: "Metformin",
      dosage: "500mg",
      dosagePerDose: 1,
      frequencyPerDay: 2,
      currentQuantity: 4, // 4 tablets at 2/day = 2 days -> CRITICAL
      totalQuantity: 60,
      unit: "tablets",
      addedAt: new Date().toISOString(),
    };

    const status = calculateRefillStatus(met, []);
    expect(status?.dosesRemaining).toBe(4);
    expect(status?.daysRemaining).toBe(2);
    expect(status?.isLow).toBe(true);
    expect(status?.isWarning).toBe(false);
  });

  it("provides accurate offline DawaGPT response differentiating doses and days", async () => {
    const response = await generateDawaGPTResponse(
      "How many days of meds do I have left?",
      null,
      null,
      [panadolTwiceDaily],
      [],
      [panadolReminder]
    );

    expect(response.text).toContain("Panadol Extra");
    expect(response.text).toContain("10 doses");
    expect(response.text).toContain("5 days");
    expect(response.text).toContain("[Med Vault](/medvault)");
  });

  it("updates getMedVaultSystemContext on frontend to match exact mathematical schema", () => {
    const context = getMedVaultSystemContext([panadolTwiceDaily], [panadolReminder]);
    expect(context).toContain("Panadol Extra");
    expect(context).toContain("10 doses left");
    expect(context).toContain("~5 days of supply left");
    expect(context).toContain("NEVER confuse doses remaining with days remaining");
  });
});
