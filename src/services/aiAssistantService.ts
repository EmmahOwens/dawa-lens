/**
 * Dawa-GPT Service
 * A simulated RAG-style assistant that answers medication questions.
 * Focused on regional (East African) context and user safety.
 */

import { Medicine, UserProfile } from "../contexts/AppContext";
import { checkConditionSafety } from "./conditionInteractionService";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  source?: "ANDA" | "WHO" | "openFDA" | "System";
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
  userProfile: UserProfile | null
): Promise<ChatMessage> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const normalizedQuery = query.toLowerCase().trim();
  
  // 1. Check for specific safety issues (RAG logic)
  if (activeMedicine && userProfile) {
    const safetyChecks = checkConditionSafety(
      activeMedicine.name, 
      activeMedicine.genericName, 
      userProfile.gender === "female" ? ["Pregnancy"] : [] // Mocking a check
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

  // 2. Check FAQ Map
  const knownResp = Object.entries(FAQ_RESPONSE_MAP).find(([key]) => normalizedQuery.includes(key));
  if (knownResp) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: knownResp[1],
      source: "WHO"
    };
  }

  // 3. Default generic response
  return {
    id: Date.now().toString(),
    role: "assistant",
    text: "I am helpful assistant for the Dawa Lens project. I recommend checking the 'Safety' tab for specific interactions or talking to your pharmacist for the most accurate guidance.",
    source: "System"
  };
};
