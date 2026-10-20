/**
 * Client-Side Therapeutic Duplication & Same-Task Medication Intelligence
 * Provides fast local evaluation, duplicate class matching, and clinical guidance.
 */

import type { Medicine } from "../contexts/AppContext";
import {
  findLocalTherapeuticClass,
  detectDuplicateTherapiesSync,
  isSameTaskOrDuplicateQuery,
  extractDrugsFromQuery,
} from "../../server/src/utils/therapeuticClasses.js";

export {
  findLocalTherapeuticClass,
  isSameTaskOrDuplicateQuery,
  extractDrugsFromQuery,
};

export interface DuplicateTherapyResult {
  drug1: string;
  drug2: string;
  sharedClass: string;
  sharedTask: string;
  warning: string;
  dangers: string[];
  guidance: string;
  source: string;
}

export function detectDuplicateTherapies(medications: Partial<Medicine>[] = []): DuplicateTherapyResult[] {
  return detectDuplicateTherapiesSync(medications, "NDA Uganda & FDA Safety Standards") as DuplicateTherapyResult[];
}
