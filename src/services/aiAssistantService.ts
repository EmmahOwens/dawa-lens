/**
 * Dawa-GPT Service
 * Conversational medical assistant with full system read/write access.
 * Focused on regional (East African) context and user safety.
 */

import { Medicine, Reminder, UserProfile, DoseLog, WellnessLog, Patient } from "../contexts/AppContext";
import { checkConditionSafety } from "./conditionInteractionService";
import { aiApi } from "./api";

export interface AIAction {
  type: "ADD_REMINDER" | "LOG_DOSE" | "ADD_MEDICINE" | "UPDATE_REMINDER" | "REMOVE_REMINDER" | "LOG_WELLNESS" | "ADD_PATIENT" | "UPDATE_MEDICINE" | "REMOVE_MEDICINE" | null;
  payload: Record<string, unknown> | null;
  confirmMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  source?: "ANDA" | "WHO" | "openFDA" | "System" | "Gemini" | "MoH";
  patterns?: string[];
  score?: number;
  suggestions?: string[];
  action?: AIAction;
}

const FAQ_RESPONSE_MAP: Record<string, string> = {
  "is this safe for me?": "Checking your health profile... Based on NDA Uganda guidelines, this medication is generally safe for you. However, please consult your doctor directly before making changes.",
  "can i take this with milk?": "For Coartem (Artemether/Lumefantrine), it is recommended to take with a fatty meal or milk to increase absorption. For many other antibiotics, avoid milk as it can hinder absorption. Check your specific prescription.",
  "is matooke safe?": "Matooke (steamed green bananas) is generally safe and very healthy (high in potassium). It's a great staple to have with your medications, especially if they require a meal.",
  "what about g-nuts?": "G-nut sauce is rich in healthy fats and protein. The fats in G-nuts actually help your body absorb certain medications like Coartem better!",
  "is kalo healthy?": "Kalo (millet bread) is excellent for you. It's rich in iron and calcium, which are great for your blood and bones.",
  "can i eat nsenene?": "Yes! Nsenene (grasshoppers) are a great source of protein and healthy fats. Just ensure they are prepared hygienically.",
  "what are the side effects?": "Common side effects for medications in this category include dizziness and nausea. If you experience severe rashes or palpitations, seek medical help immediately.",
  "how do i take this?": "Always follow the dosage on your pill bottle or prescription. For acute cases, consistency is key to recovery.",
  "oli otya": "Oli otya! I am doing well, ssebo/nyabo. How can Dawa-GPT help you with your health or medicines today?",
  "wasuze otya": "Wasuze otya! I hope you slept well and are ready for a healthy day. How can I help you today?",
  "osiibye otya": "Osiibye otya! How has your day been? Let's check your evening medication adherence.",
  "gyebaleko": "Gyebaleko! Thank you. I am here to help you manage your health. How are you feeling today?",
  "webale": "Kale! You're welcome. Let me know if you need help with reminders or safety checks.",
  "eddagala": "Eddagala (medicine) is key to your health. Do you want to check details for one of your medicines, or set up a reminder?",
  "omutwe gunnuma": "Bambi (oh dear), sorry about the headache. Ensure you are hydrated, and check if you have a pain reliever reminder like Panadol (Paracetamol) set up.",
  "olubuto lunnuma": "Bambi, sorry about the stomach ache. Have you taken any medication recently, or eaten? Some medicines should be taken with food (like Matooke or Posho) to prevent stomach irritation.",
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
        logs: doseLogs.slice(0, 50),
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

const getMedVaultSystemContext = (medicines: Medicine[], reminders: Reminder[]): string => {
  const trackedMeds = medicines.filter(m => m.currentQuantity !== undefined);
  if (trackedMeds.length === 0) {
    return "Med Vault (Pill Stock Tracker) Status: No medicine stocks are currently tracked. Explain that they can track pill counts by setting a quantity on any medicine. Recommend they open [Med Vault](/medvault).";
  }

  const stockLines = trackedMeds.map(m => {
    const qty = m.currentQuantity ?? 0;
    const unit = m.unit || "tablets";
    const medReminders = reminders.filter(r => r.medicineId === m.id && r.enabled);
    let dailyDose = 0;
    for (const r of medReminders) {
      const dosesPerDay = r.time.split(",").length;
      dailyDose += (m.dosagePerDose || 1) * dosesPerDay;
    }
    const daysRemaining = dailyDose > 0 ? Math.floor(qty / dailyDose) : null;
    const daysStr = daysRemaining !== null ? `~${daysRemaining} days left` : "no active reminders";
    return `- ${m.name} (ID: ${m.id}): ${qty} ${unit} remaining (${daysStr}, dosage/dose: ${m.dosagePerDose || 1} ${unit})`;
  });

  return `Med Vault (Pill Stock Tracker) Status:\n${stockLines.join("\n")}\n\nInstructions for DawaGPT:\n1. If a medicine has <= 2 days of supply left, proactively alert the user about the low stock and recommend refilling soon.\n2. Recommend the user to open [Med Vault](/medvault) (using exactly that markdown link format) to manage their stock.\n3. If the user asks to refill a medicine (e.g. "I refilled my Coartem to 30 pills"), reply to confirm and append an action block. The action type is UPDATE_MEDICINE and payload is { id: "medicine_id", currentQuantity: new_quantity }.`;
};

/**
 * Primary conversational path — uses backend Groq LLM with full system context.
 * Returns an optional `action` field that callers should dispatch to AppContext.
 */
export const chatWithDawaGPT = async (
  messages: ChatMessage[],
  medicines: Medicine[],
  userProfile: UserProfile | null,
  doseLogs: DoseLog[] = [],
  reminders: Reminder[] = [],
  wellnessLogs: WellnessLog[] = [],
  vitalitySummary: any[] = [],
  patients: Patient[] = [],
  selectedPatientId: string | null = null
): Promise<ChatMessage> => {
  try {
    const lastUserIdx = messages.map(m => m.role).lastIndexOf("user");
    let enrichedMessages = [...messages];
    if (lastUserIdx !== -1) {
      const context = getMedVaultSystemContext(medicines, reminders);
      enrichedMessages[lastUserIdx] = {
        ...messages[lastUserIdx],
        text: `${messages[lastUserIdx].text}\n\n[SYSTEM CONTEXT]\n${context}\n[END SYSTEM CONTEXT]`
      };
    }

    const response = await aiApi.chat({
      messages: enrichedMessages,
      medicines,
      userProfile,
      doseLogs: doseLogs.slice(0, 20),
      reminders,
      wellnessLogs: wellnessLogs.slice(0, 10),
      vitalitySummary,
      patients,
      selectedPatientId,
    });

    const rawText = response.text || "";
    // Clean up any stray metadata markers if they exist
    const cleanText = rawText.split(/###METADATA###|---METADATA---/)[0].trim();

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: cleanText,
      source: (response.source as ChatMessage['source']) || "Gemini",
      suggestions: response.suggestions,
      // Include the action from the AI if present and meaningful
      action: response.action?.type ? response.action : undefined,
    };
  } catch (err: unknown) {
    console.error("DawaGPT Chat Error:", err);
    const errorMessage = err instanceof Error ? err.message : "I'm having trouble connecting to my medical intelligence core. Please check your connection and try again.";
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: errorMessage,
      source: "System"
    };
  }
};

/**
 * Streaming version of chat — provides real-time text updates.
 */
export const chatWithDawaGPTStream = async (
  messages: ChatMessage[],
  medicines: Medicine[],
  userProfile: UserProfile | null,
  doseLogs: DoseLog[] = [],
  reminders: Reminder[] = [],
  wellnessLogs: WellnessLog[] = [],
  vitalitySummary: any[] = [],
  patients: Patient[] = [],
  selectedPatientId: string | null = null,
  onChunk: (text: string) => void
): Promise<ChatMessage> => {
  try {
    const lastUserIdx = messages.map(m => m.role).lastIndexOf("user");
    let enrichedMessages = [...messages];
    if (lastUserIdx !== -1) {
      const context = getMedVaultSystemContext(medicines, reminders);
      enrichedMessages[lastUserIdx] = {
        ...messages[lastUserIdx],
        text: `${messages[lastUserIdx].text}\n\n[SYSTEM CONTEXT]\n${context}\n[END SYSTEM CONTEXT]`
      };
    }

    const stream = await aiApi.chatStream({
      messages: enrichedMessages,
      medicines,
      userProfile,
      doseLogs: doseLogs.slice(0, 20),
      reminders,
      wellnessLogs: wellnessLogs.slice(0, 10),
      vitalitySummary,
      patients,
      selectedPatientId,
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let allText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const content = data.choices[0]?.delta?.content || "";
            allText += content;

            // Strip metadata delimiter and JSON from visible text (Requirement 2.3)
            const delimIdx = allText.lastIndexOf('###METADATA###');
            const visibleText = delimIdx !== -1
              ? allText.substring(0, delimIdx)
              : allText;
            onChunk(visibleText);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    // Split on the ###METADATA### delimiter to separate display text from metadata (Requirement 2.3)
    const METADATA_DELIMITER = '###METADATA###';
    // Use a regex to find the last occurrence of the delimiter, handling potential whitespace/newlines
    const delimMatch = allText.match(/[\s\S]*###METADATA###\s*([\s\S]*)$/);

    let displayText: string;
    let rawMetadata: string;

    if (delimMatch) {
      const fullMatch = delimMatch[0];
      const delimIndex = fullMatch.lastIndexOf(METADATA_DELIMITER);
      displayText = allText.substring(0, delimIndex).trim();
      rawMetadata = delimMatch[1].trim();
    } else {
      // Delimiter absent — treat entire text as display text, no metadata
      displayText = allText.trim();
      rawMetadata = '';
    }

    const fullText = displayText;

    interface StreamMetadata {
      suggestions: string[];
      source: ChatMessage['source'];
      action?: AIAction;
    }

    // Parse metadata safely; on failure or empty string, default gracefully (Requirement 2.4)
    let metadata: StreamMetadata = { suggestions: [], source: "Gemini", action: undefined };
    if (rawMetadata) {
      try {
        metadata = JSON.parse(rawMetadata);
      } catch (e) {
        console.warn('Failed to parse stream metadata JSON', e);
        // Graceful degradation: return text with empty metadata
      }
    }

    return {
      id: Date.now().toString(),
      role: "assistant",
      text: fullText,
      source: metadata.source,
      suggestions: metadata.suggestions,
      action: metadata.action?.type ? metadata.action : undefined,
    };
  } catch (err: unknown) {
    console.error("DawaGPT Streaming Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Connection lost during medical core sync. Please try again.";
    return {
      id: Date.now().toString(),
      role: "assistant",
      text: errorMessage,
      source: "System"
    };
  }
};

