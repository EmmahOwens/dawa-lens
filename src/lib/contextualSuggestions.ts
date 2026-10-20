/**
 * Contextual Suggestion Engine for DawaGPT (Frontend)
 *
 * Re-exports shared suggestion helpers with TypeScript types.
 */

import type { Medicine, Reminder, UserProfile, Patient } from "@/contexts/AppContext";
import type { ResolvedPatient } from "@/hooks/usePatientScope";
import type { ChatMessage, AIAction } from "@/services/aiAssistantService";
import {
  generateContextualSuggestions,
  isGenericBoilerplate,
} from "../../server/src/utils/contextualSuggestions.js";

export { isGenericBoilerplate };

export interface GetContextualSuggestionsParams {
  messages?: ChatMessage[];
  userQuery?: string;
  assistantText?: string;
  medicines?: Medicine[];
  reminders?: Reminder[];
  userProfile?: UserProfile | null;
  activePatient?: Patient | ResolvedPatient | null;
  currentPage?: string | null;
  action?: AIAction | null;
  existingSuggestions?: string[];
}

export function getContextualSuggestions(params: GetContextualSuggestionsParams = {}): string[] {
  return generateContextualSuggestions(params) as string[];
}
