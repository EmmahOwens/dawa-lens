/**
 * Dawa-GPT Service
 * A simulated RAG-style assistant that answers medication questions.
 * Focused on regional (East African) context and user safety.
 */

import { Medicine, UserProfile, DoseLog } from "../contexts/AppContext";
import { checkConditionSafety } from "./conditionInteractionService";
import { aiApi } from "./api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  source?: "ANDA" | "WHO" | "openFDA" | "System" | "Gemini" | "MoH";
  patterns?: string[];
  score?: number;
  suggestions?: string[];
}

const FAQ_RESPONSE_MAP: Record<string, string> = {
  "is this safe for me?": "Checking your health profile... Based on NDA Uganda guidelines, this medication is generally safe for you. However, please consult your doctor directly before making changes.",
  "can i take this with milk?": "For Coartem (Artemether/Lumefantrine), it is recommended to take with a fatty meal or milk to increase absorption. For many other antibiotics, avoid milk as it can hinder absorption. Check your specific prescription.",
  "what are the side effects?": "Common side effects for medications in this category include dizziness and nausea. If you experience severe rashes or palpitations, seek medical help immediately.",
  "how do i take this?": "Always follow the dosage on your pill bottle or prescription. For acute cases, consistency is key to recovery.",
};

export const generateDawaGPTResponse = async (
  query: string,
  activeMedicine: Medicine | null,
  userProfile: UserProfile | null,
  allMedicines: Medicine[] = [],
  doseLogs: DoseLog[] = []
): Promise<ChatMessage> => {
  const normalizedQuery = query.toLowerCase().trim();

  // 1. Check for specific safety issues (local rule-based check)
  if (activeMedicine && userProfile) {
    const safetyChecks = checkConditionSafety(
      activeMedicine.name, 
      activeMedicine.genericName, 
      userProfile.gender === "female" ? ["Pregnancy"] : [] // Placeholder logic
    );

    if (safetyChecks.length > 0) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        text: `Based on your health profile and ANDA guidelines: ${safetyChecks[0].warning}`,
        source: "ANDA"
      };
    }
  }

  // 2. Behavioral Coaching Analysis (Complex Pattern Detection)
  const coachingKeywords = ["log", "miss", "pattern", "adherence", "track", "help", "coach", "why"];
  const isCoachingRequest = coachingKeywords.some(k => normalizedQuery.includes(k));

  if (isCoachingRequest && doseLogs.length > 0) {
    try {
      const res = await aiApi.getCoachAdvice({
        logs: doseLogs.slice(0, 50), // Send recent history
        medicines: allMedicines,
        userName: userProfile?.name
      });

      return {
        id: Date.now().toString(),
        role: "assistant",
        text: res.advice,
        source: "Gemini",
        patterns: res.patterns,
        score: res.adherenceScore
      };
    } catch (err) {
      console.warn("AI coaching failed, falling back to basic response.", err);
    }
  }

  // 3. Common Questions Map (Offline/Fast)
  const knownResp = Object.entries(FAQ_RESPONSE_MAP).find(([key]) => normalizedQuery.includes(key));
  if (knownResp) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: knownResp[1],
      source: "WHO"
    };
  }

  // 4. Default generic response
  return {
    id: Date.now().toString(),
    role: "assistant",
    text: "I am your Dawa-Lens assistant. You can ask about your medication logs, patterns in missing doses, or general safety. For urgent medical issues, please contact a professional.",
    source: "System"
  };
};

export const chatWithDawaGPT = async (
  messages: ChatMessage[],
  medicines: Medicine[],
  userProfile: UserProfile | null
): Promise<ChatMessage> => {
  try {
    const response = await aiApi.chat({
      messages,
      medicines,
      userProfile
    });

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: response.text,
      source: response.source || "Gemini",
      suggestions: response.suggestions
    };
  } catch (err) {
    console.error("DawaGPT Chat Error:", err);
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: "I'm having trouble connecting to my medical intelligence core. Please check your connection and try again.",
      source: "System"
    };
  }
};
