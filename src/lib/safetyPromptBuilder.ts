import { FdaMultiSafetyResult } from "@/services/openFdaClient";
import { ParsedInteraction } from "@/types/interactions";

export interface BuildSafetyConsultPromptParams {
  medNames?: string[];
  fdaSafety?: Partial<FdaMultiSafetyResult> | null;
  interactions?: ParsedInteraction[];
}

/**
 * Builds a clean, human-readable, well-trimmed safety prompt for DawaGPT.
 * Designed to be easily understandable by patients in their chat bubble.
 */
export function buildSafetyConsultPrompt({
  medNames = [],
  fdaSafety,
  interactions = [],
}: BuildSafetyConsultPromptParams): string {
  const alertPoints: string[] = [];

  // 1. Duplicate Therapies
  if (fdaSafety?.duplicateTherapies && fdaSafety.duplicateTherapies.length > 0) {
    const dups = fdaSafety.duplicateTherapies
      .map((d) => `${d.drug1} + ${d.drug2}`)
      .join(", ");
    alertPoints.push(`Specifically, duplicate therapies detected: ${dups}`);
  }

  // 2. FDA Boxed Warnings
  if (fdaSafety?.boxedWarnings && fdaSafety.boxedWarnings.length > 0) {
    const drugsWithWarnings = Array.from(
      new Set(fdaSafety.boxedWarnings.map((b) => b.drugName))
    ).join(", ");
    alertPoints.push(`FDA Boxed Warning: ${drugsWithWarnings}`);
  }

  // 3. Comorbidity Contraindications
  if (fdaSafety?.contraindicationAlerts && fdaSafety.contraindicationAlerts.length > 0) {
    const contraList = fdaSafety.contraindicationAlerts
      .flatMap((c) =>
        c.conflicts.map((cf) => `${c.drugName} (conflicts with ${cf.condition})`)
      )
      .slice(0, 3)
      .join(", ");
    const moreContra = fdaSafety.contraindicationAlerts.length > 3 ? " (+more)" : "";
    alertPoints.push(`Health condition conflicts: ${contraList}${moreContra}`);
  }

  // 4. Allergen Alerts
  if (fdaSafety?.allergenAlerts && fdaSafety.allergenAlerts.length > 0) {
    const allergenList = fdaSafety.allergenAlerts
      .flatMap((a) =>
        a.conflicts.map((cf) => `${a.drugName} (allergen: ${cf.allergy})`)
      )
      .slice(0, 3)
      .join(", ");
    alertPoints.push(`Allergy alerts: ${allergenList}`);
  }

  // 5. Drug-Drug Interactions
  if (interactions.length > 0) {
    const topInteractions = interactions
      .slice(0, 3)
      .map((i) => `${i.drug1} + ${i.drug2}`)
      .join(", ");
    const moreCount = interactions.length - 3;
    const moreSuffix = moreCount > 0 ? ` (+${moreCount} more)` : "";
    alertPoints.push(`Drug interactions: ${topInteractions}${moreSuffix}`);
  }

  // Format medications context
  const uniqueMeds = Array.from(new Set(medNames.filter(Boolean)));
  const medContext = uniqueMeds.length > 0 ? ` for my medications (${uniqueMeds.join(", ")})` : "";

  if (alertPoints.length === 0) {
    return `Can you review the safety and potential risks${medContext}? How should I take them safely?`;
  }

  return (
    `I have active safety alerts${medContext}:\n` +
    alertPoints.map((point) => `• ${point}`).join("\n") +
    `\n\nCan you explain what these risks mean in plain language and what I should do to take them safely?`
  );
}
