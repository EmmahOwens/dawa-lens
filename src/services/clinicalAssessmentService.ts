/**
 * Clinical Assessment & Wellness Intelligence Fallback Engine
 * Generates deterministic, clinically grounded patterns and correlations
 * when the remote AI backend is unavailable or taking longer than the timeout.
 */

import { DoseLog, WellnessLog, Medicine } from "../contexts/AppContext";

export interface ClinicalAssessmentResult {
  summary: string;
  dosagePatterns: string;
  lifestyleAnalysis: string;
  insights: string[];
  actionItems: string[];
  correlationScore: number;
  score: number;
  status: "improving" | "declining" | "stable";
  insight: string;
  recommendation: string;
  source?: "local" | "ai";
}

interface PatientContext {
  name?: string;
  age?: number;
  gender?: string | null;
  type?: string;
  conditions?: string[];
  allergies?: string[];
}

export function generateLocalClinicalAssessment(
  doseLogs: DoseLog[] = [],
  wellnessLogs: WellnessLog[] = [],
  medicines: Medicine[] = [],
  patientContext?: PatientContext | null
): ClinicalAssessmentResult {
  const patientName = patientContext?.name || "Patient";
  const conditions = patientContext?.conditions || [];
  const allergies = patientContext?.allergies || [];

  // 1. Calculate Dose Adherence & Patterns
  const totalDoses = doseLogs.length;
  const takenDoses = doseLogs.filter((l) => l.action === "taken").length;
  const skippedDoses = doseLogs.filter((l) => l.action === "skipped").length;
  const missedDoses = doseLogs.filter((l) => l.action === "missed").length;

  const adherenceRate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 100;

  // Identify specific medicines with skipped/missed doses
  const medIssues: Record<string, { skipped: number; missed: number }> = {};
  doseLogs.forEach((l) => {
    if (l.action === "skipped" || l.action === "missed") {
      const name = l.medicineName || "Unknown medication";
      if (!medIssues[name]) medIssues[name] = { skipped: 0, missed: 0 };
      if (l.action === "skipped") medIssues[name].skipped++;
      if (l.action === "missed") medIssues[name].missed++;
    }
  });

  // Check morning vs evening consistency
  let morningTaken = 0;
  let morningTotal = 0;
  let eveningTaken = 0;
  let eveningTotal = 0;

  doseLogs.forEach((l) => {
    const timeStr = l.scheduledTime || l.actionTime;
    if (timeStr) {
      const date = new Date(timeStr);
      const hours = date.getHours();
      if (hours < 12) {
        morningTotal++;
        if (l.action === "taken") morningTaken++;
      } else {
        eveningTotal++;
        if (l.action === "taken") eveningTaken++;
      }
    }
  });

  // 2. Calculate Wellness & Symptom Trends
  const symptomLogs = wellnessLogs.filter((l) => l.type === "symptom");
  const validMoods = symptomLogs
    .map((l) => Number(l.data?.mood))
    .filter((v) => Number.isFinite(v) && v >= 1 && v <= 5);
  const validEnergies = symptomLogs
    .map((l) => Number(l.data?.energy))
    .filter((v) => Number.isFinite(v) && v >= 1 && v <= 5);

  const avgMood = validMoods.length > 0 ? validMoods.reduce((a, b) => a + b, 0) / validMoods.length : 3;
  const avgEnergy = validEnergies.length > 0 ? validEnergies.reduce((a, b) => a + b, 0) / validEnergies.length : 3;

  // Tally reported symptoms
  const symptomFreq: Record<string, number> = {};
  symptomLogs.forEach((l) => {
    const syms = l.data?.symptoms;
    if (Array.isArray(syms)) {
      syms.forEach((s) => {
        if (typeof s === "string") {
          symptomFreq[s] = (symptomFreq[s] || 0) + 1;
        }
      });
    }
  });

  const topSymptoms = Object.entries(symptomFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);

  // 3. Compute Composite Health Score (0-100)
  // 60% adherence, 20% energy, 20% mood
  const energyScore = (avgEnergy / 5) * 100;
  const moodScore = (avgMood / 5) * 100;
  const compositeScore = Math.min(100, Math.max(20, Math.round(adherenceRate * 0.6 + energyScore * 0.2 + moodScore * 0.2)));

  const status: "improving" | "declining" | "stable" =
    compositeScore >= 75 ? "improving" : compositeScore >= 50 ? "stable" : "declining";

  // 4. Construct Clinical Summary
  let summaryText = `Patient **${patientName}** demonstrates an adherence rate of **${adherenceRate}%** across **${totalDoses}** logged events`;
  if (medicines.length > 0) {
    summaryText += ` across ${medicines.length} active prescription${medicines.length === 1 ? "" : "s"}`;
  }
  summaryText += ".";

  if (conditions.length > 0) {
    summaryText += ` Monitored conditions include **${conditions.join(", ")}**.`;
  }
  if (allergies.length > 0) {
    summaryText += ` Allergy safeguards active for **${allergies.join(", ")}**.`;
  }

  if (adherenceRate >= 85) {
    summaryText += ` Overall therapy adherence is strong with consistent intake routines.`;
  } else if (adherenceRate >= 60) {
    summaryText += ` Moderate adherence noted; scheduled dosage alignment requires minor reinforcement.`;
  } else {
    summaryText += ` Adherence gaps identified; therapy regularity needs clinical review to prevent reduced efficacy.`;
  }

  // 5. Construct Dosage Patterns
  let dosagePatterns = "";
  if (totalDoses === 0) {
    dosagePatterns = "No medication dose logs recorded within the current evaluation window. Regular logging will reveal adherence timing trends.";
  } else {
    const patternSentences: string[] = [];
    patternSentences.push(`**${takenDoses} of ${totalDoses}** doses recorded as taken on schedule (${adherenceRate}% adherence).`);

    if (morningTotal > 0 && eveningTotal > 0) {
      const morningPct = Math.round((morningTaken / morningTotal) * 100);
      const eveningPct = Math.round((eveningTaken / eveningTotal) * 100);
      patternSentences.push(`Morning dosing adherence stands at **${morningPct}%**, while evening dosing is at **${eveningPct}%**.`);
    }

    const issueEntries = Object.entries(medIssues);
    if (issueEntries.length > 0) {
      const details = issueEntries
        .map(([name, counts]) => `**${name}** (${counts.skipped > 0 ? `${counts.skipped} skipped` : ""}${counts.skipped > 0 && counts.missed > 0 ? ", " : ""}${counts.missed > 0 ? `${counts.missed} missed` : ""})`)
        .join("; ");
      patternSentences.push(`Missed/skipped entries noted for: ${details}.`);
    } else {
      patternSentences.push("Zero skipped or missed doses recorded in this timeframe.");
    }
    dosagePatterns = patternSentences.join(" ");
  }

  // 6. Construct Lifestyle & Symptom Analysis
  let lifestyleAnalysis = "";
  if (symptomLogs.length === 0) {
    lifestyleAnalysis = "Daily check-ins have not been logged recently. Daily mood and energy recordings enhance therapy outcome correlation.";
  } else {
    const moodDesc = avgMood >= 3.8 ? "elevated and positive" : avgMood >= 2.5 ? "steady and moderate" : "subdued";
    const energyDesc = avgEnergy >= 3.8 ? "optimal energy levels" : avgEnergy >= 2.5 ? "moderate vitality" : "elevated fatigue";
    lifestyleAnalysis = `Over ${symptomLogs.length} wellness check-in${symptomLogs.length === 1 ? "" : "s"}, recorded mood was **${moodDesc}** (${avgMood.toFixed(1)}/5) alongside **${energyDesc}** (${avgEnergy.toFixed(1)}/5).`;

    if (topSymptoms.length > 0) {
      lifestyleAnalysis += ` Most frequently noted symptoms: **${topSymptoms.slice(0, 3).join(", ")}**.`;
    }
  }

  // 7. Generate Key Insights
  const insights: string[] = [];
  if (adherenceRate >= 90) {
    insights.push(`High adherence (${adherenceRate}%) correlates with consistent wellness vitality across active medications.`);
  } else if (adherenceRate < 70 && totalDoses > 0) {
    insights.push(`Sub-optimal adherence (${adherenceRate}%) may reduce therapeutic efficacy; schedule optimization recommended.`);
  }

  if (morningTotal > 0 && eveningTotal > 0 && Math.abs(morningTaken / morningTotal - eveningTaken / eveningTotal) >= 0.2) {
    if (morningTaken / morningTotal < eveningTaken / eveningTotal) {
      insights.push("Morning doses experience higher miss rates than evening doses; consider syncing morning medication with breakfast routines.");
    } else {
      insights.push("Evening doses experience higher miss rates than morning doses; consider setting an evening alarm 30 minutes earlier.");
    }
  }

  if (topSymptoms.length > 0) {
    insights.push(`Recurrent symptoms (${topSymptoms.slice(0, 2).join(", ")}) should be reviewed during next clinical checkup.`);
  } else {
    insights.push("No persistent adverse side effects or adverse symptoms flagged in the recent observation window.");
  }

  // 8. Generate Action Items
  const actionItems: string[] = [];
  if (adherenceRate < 85) {
    actionItems.push("Enable persistent sound alarms or notifications for frequently missed medication intervals.");
  }
  if (topSymptoms.includes("Nausea") || topSymptoms.includes("Stomach Ache") || topSymptoms.includes("Headache")) {
    actionItems.push("Take medications that cause gastric discomfort with food (such as Matooke, Posho, or light meals) and maintain hydration.");
  }
  actionItems.push("Continue logging daily vitality and dose intake to build continuous longitudinal clinical insights.");

  const primaryInsight = insights[0] || "Consistent medication adherence supports treatment stability.";
  const primaryRecommendation = actionItems[0] || "Maintain current daily dosing schedule.";

  return {
    summary: summaryText,
    dosagePatterns,
    lifestyleAnalysis,
    insights,
    actionItems,
    correlationScore: compositeScore,
    score: compositeScore,
    status,
    insight: primaryInsight,
    recommendation: primaryRecommendation,
    source: "local",
  };
}
