import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjY2MmQ3YTBkNGVlZmQzNDMyNjFjYWRkZmZhZWM2MjNkYzZjYTlmZjAiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vbWVkaWNpbmUtZDNiYTIiLCJhdWQiOiJtZWRpY2luZS1kM2JhMiIsImF1dGhfdGltZSI6MTc4OTU1ODk3NywidXNlcl9pZCI6ImhZUm5MbDRKUkRZUW5hak5zS0g5c0ZYb2c0dDEiLCJzdWIiOiJoWVJuTGw0SlJEWVFuYWpOc0tIOXNGWG9nNHQxIiwiaWF0IjoxNzg5NTU4OTc3LCJleHAiOjE3ODk1NjI1NzcsImVtYWlsIjoidGVzdF9kaWFnbm9zdGljc18xMjM0NUBkYXdhbGVucy5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsidGVzdF9kaWFnbm9zdGljc18xMjM0NUBkYXdhbGVucy5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.myDt_EmH1W2spxGzsBM9opebpmrdlN-JYqanAdhlAIppM8TTWbxH9480mHWssz2JM1MgQYsasgZQrHr3hGnmCXPgMia1Xk2f9Q1v0ggtCKBOf1pzUlQo6Jd9bSy4WoWnyeZA1l6JRxz4r7EGdCCFIlQ0PbCFC14l3_I9alEc78fisuRxOMfBM5wHMs3lTLtwWDPejKAUYVzTgOYgrT4udzbz_jxhyiHWWHsm3OUH-p0NEau2IQ80ngjSQBuHyduz6B1eLeBVzGen37ygkZinyX_TodUz5TqDzh_RMJp4l3TNJ3ZamFxvBoEcfIYL9cjMv754YZoP4_Ggg-aUf1Ad2Q";
const BASE_URL = "https://dawa-lens.onrender.com/api/v1";

const SIX_MEDS = [
  { id: "7H0ikVQYwRpcJpeoBeMm", name: "Ibuprofen", genericName: "Nurofen", dosage: "400mg", currentQuantity: 48, totalQuantity: 50, dosagePerDose: 2, unit: "tablets", frequencyPerDay: 3 },
  { id: "OOSOFKRfHa7DDLJaxcJ8", name: "Panadol", genericName: "Paracetamol", dosage: "500mg", currentQuantity: 35, totalQuantity: 60, dosagePerDose: 2, unit: "tablets", frequencyPerDay: 3 },
  { id: "RYylmJSDbgqADgpVuNgz", name: "Prilosec OTC", genericName: "Omeprazole", dosage: "20mg", currentQuantity: 18, totalQuantity: 20, dosagePerDose: 1, unit: "capsules", frequencyPerDay: 1 },
  { id: "RbC0XGGId0EI9Rf8eZyN", name: "Paracetamol 500mg", genericName: "Paracetamol", dosage: "500mg", currentQuantity: 24, totalQuantity: 30, dosagePerDose: 2, unit: "tablets", frequencyPerDay: 3 },
  { id: "XL4qQBmFvatEVm4LVoxN", name: "Omeprazole", genericName: "Omeprazole", dosage: "20mg", currentQuantity: 48, totalQuantity: 60, dosagePerDose: 1, unit: "capsules", frequencyPerDay: 1 },
  { id: "qdgFHJWrQ8lNkVcGQNKz", name: "Metronidazole", genericName: "Flagyl", dosage: "200mg", currentQuantity: 34, totalQuantity: 45, dosagePerDose: 2, unit: "tablet", frequencyPerDay: 3 },
];

const REMINDERS = [
  { id: "r1", medicineName: "Ibuprofen", dose: "2 tablets", time: "08:00,14:00,20:00", repeatSchedule: "daily", enabled: true },
  { id: "r2", medicineName: "Panadol", dose: "2 tablets", time: "08:00,14:00,20:00", repeatSchedule: "daily", enabled: true },
  { id: "r3", medicineName: "Prilosec OTC", dose: "1 capsule", time: "08:00", repeatSchedule: "daily", enabled: true },
  { id: "r4", medicineName: "Paracetamol 500mg", dose: "2 tablets", time: "08:00,14:00,20:00", repeatSchedule: "daily", enabled: true },
  { id: "r5", medicineName: "Omeprazole", dose: "1 capsule", time: "08:00", repeatSchedule: "daily", enabled: true },
  { id: "r6", medicineName: "Metronidazole", dose: "2 tablets", time: "08:00,14:00,20:00", repeatSchedule: "daily", enabled: true },
];

async function testQuery(query) {
  console.log(`\n======================================================`);
  console.log(`Testing Query: "${query}" with 6 medications`);
  console.log(`======================================================`);
  const payload = {
    messages: [{ role: "user", text: query }],
    medicines: SIX_MEDS,
    reminders: REMINDERS,
    userProfile: { id: "u1", name: "User", gender: "female" },
    doseLogs: [],
    wellnessLogs: [],
    vitalitySummary: [],
    patients: [],
    selectedPatientId: null,
    currentPage: "/medvault"
  };

  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/ai/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(35000)
    });

    console.log(`Response status: ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    const elapsed = Date.now() - start;
    console.log(`Time taken: ${elapsed}ms`);
    console.log(`Full response preview:`);
    console.log(text.slice(0, 500));
    console.log(`...`);
    if (text.includes("Here is your current medication stock status") || text.includes("⚠️ I am currently experiencing difficulty")) {
      console.log(`🔴 RESULT: HARDCODED FALLBACK DETECTED!`);
    } else {
      console.log(`🟢 RESULT: REAL LIVE API RESPONSE!`);
    }
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

await testQuery("Which medications should I be most worried about their stock levels");
await testQuery("Omutwe gunuma");
