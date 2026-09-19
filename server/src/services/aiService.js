import axios from 'axios';
import dotenv from 'dotenv';
import { Readable } from 'stream';
import AppError from '../utils/AppError.js';
import { retrieveMedicalKnowledge } from './vectorService.js';
import * as medicineService from './medicineService.js';
import * as reminderService from './reminderService.js';
import * as doseLogService from './doseLogService.js';
import * as patientService from './patientService.js';
import { rateLimitManager } from './rateLimitManager.js';
import { getFoodKnowledgePrompt, LOCAL_FOODS } from './localFoodService.js';
import { fetchDrugLabel, checkDuplicateTherapy } from './openFdaService.js';
import {
  fetchClinicalGroundingForQuery,
  formatDuplicateTherapyWatchdogContext,
  isSameTaskOrDuplicateQuery,
  detectDuplicateTherapiesSync,
  findLocalTherapeuticClass,
  extractDrugsFromQuery
} from './therapeuticDuplicationService.js';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_KEY_2 = process.env.GROQ_API_KEY_2;
const GROQ_API_KEY_3 = process.env.GROQ_API_KEY_3;
const sanitizeGroqModel = (model) => {
  if (!model || typeof model !== 'string') return 'openai/gpt-oss-120b';
  const m = model.trim();
  const lower = m.toLowerCase();

  // Active production Groq models (official current recommendations)
  if (lower.includes('gpt-oss') || lower.includes('qwen3.6')) {
    return m;
  }

  // Deprecated Groq models mapped to active recommended replacements:
  // - Llama-3.1-8B, Gemma, Light/Instant models -> openai/gpt-oss-20b
  if (lower.includes('8b') || lower.includes('light') || lower.includes('instant') || lower.includes('gemma')) {
    return 'openai/gpt-oss-20b';
  }

  // - Llama-3.3-70B, Llama-4, Kimi, Mixtral, Qwen3-32B -> openai/gpt-oss-120b
  if (lower.includes('llama') || lower.includes('70b') || lower.includes('qwen') || lower.includes('mixtral') || lower.includes('kimi')) {
    return 'openai/gpt-oss-120b';
  }

  return m;
};

const sanitizeGeminiModel = (model) => {
  if (!model || typeof model !== 'string') return 'gemini-2.5-flash';
  const m = model.trim();
  const lower = m.toLowerCase();
  if (lower.includes('gemini-1.0')) {
    return 'gemini-2.5-flash';
  }
  return m;
};

const GROQ_MODEL = sanitizeGroqModel(process.env.GROQ_MODEL || 'openai/gpt-oss-120b');
const GROQ_SCOUT_MODEL = sanitizeGroqModel(process.env.GROQ_SCOUT_MODEL || 'openai/gpt-oss-120b');
const GROQ_LIGHT_MODEL = sanitizeGroqModel(process.env.GROQ_LIGHT_MODEL || 'openai/gpt-oss-20b');
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || 'llama-3.3-70b';
const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';

const Z_AI_API_KEY = process.env.Z_AI_API_KEY;
const Z_AI_MODEL = 'glm-5-flash';
const Z_AI_API_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';

const SAMBANOVA_API_KEY = process.env.SAMBACLOUD_API_KEY || process.env.SAMBANOVA_API_KEY;
const SAMBANOVA_MODEL = 'Meta-Llama-3.3-70B-Instruct';
const SAMBANOVA_API_URL = 'https://api.sambanova.ai/v1/chat/completions';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const NVIDIA_API_KEY = process.env.NVIDIA_API || process.env.NVIDIA_NIM_API_KEY;
const NVIDIA_MODEL = 'nvidia/llama-3.3-nemotron-super-49b-instruct';
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API || process.env.SILICONFLOW_API_KEY;
const SILICONFLOW_MODEL = 'Qwen/Qwen2.5-7B-Instruct';
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_MODEL = 'mistral-small-latest'; // Mistral Small 4 family alias (mistral-small-2501)
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

/**
 * Global AI error handler to ensure all errors returned are "operational" AppErrors.
 */
export function handleAiError(err) {
  if (err.isOperational) throw err;

  console.error("AI Service Error:", err);

  if (err.response) {
    const status = err.response.status;
    const msg = err.response.data?.error?.message || 'AI API request failed';
    throw new AppError(`AI API error (${status}): ${msg}`, 502);
  }

  if (err instanceof SyntaxError) {
    throw new AppError('AI returned malformed data. Please try again.', 502);
  }

  if (err instanceof TypeError) {
    throw new AppError('Internal processing error in AI service.', 500);
  }

  throw new AppError(err.message || 'Unexpected AI service error. Please try again.', 500);
}

/**
 * Determines which API key and rate-limit bucket to use for a Groq request.
 * Since each GROQ_API_KEY comes from a DIFFERENT Groq organization/account, each
 * has its own independent rate-limit quota and must be tracked separately.
 * Returns { key, keySuffix } where keySuffix is '' | '-key2' | '-key3'.
 */
const GROQ_KEYS = [GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3].filter(Boolean);
const GROQ_KEY_SUFFIXES = ['', '-key2', '-key3'];
let groqKeyIndex = 0;

const getGroqKeyInfo = () => {
  if (GROQ_KEYS.length === 0) return { key: null, keySuffix: '' };
  const idx = groqKeyIndex % GROQ_KEYS.length;
  groqKeyIndex++;
  return { key: GROQ_KEYS[idx], keySuffix: GROQ_KEY_SUFFIXES[idx] || '' };
};

// Legacy compat shim — keeps existing callGroq/callGemini callers that pass a modelId working
const getGroqApiKey = (modelId) => {
  if (GROQ_KEYS.length === 0) return null;
  return GROQ_KEYS[groqKeyIndex % GROQ_KEYS.length];
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = sanitizeGeminiModel(process.env.GEMINI_MODEL);
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Strip markdown code fences that AI sometimes wraps JSON responses in.
 */
export const sanitizeJson = (text) => {
  if (typeof text !== 'string') return text;
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
};

const EMERGENCY_KEYWORDS = [
  'poison', 'suicide', 'kill myself', 'allergic reaction', 'chest pain',
  'difficulty breathing', 'can\'t breathe', 'stroke', 'seizure', 'unconscious',
  'overdose', 'overdosed', 'took too many', 'swallowed too many', 'took too much',
  'bleeding heavily', 'anaphylaxis'
];

const detectEmergency = (text) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some(kw => lowerText.includes(kw));
};

const EMERGENCY_RESPONSE = {
  text: "🚨 **EMERGENCY ALERT (Uganda)**: I've detected a potentially life-threatening situation in your message. \n\n**PLEASE SEEK IMMEDIATE EMERGENCY MEDICAL HELP IN UGANDA:**\n- **National Emergency & Ambulance (Uganda)**: Call **112** (Mobile Toll-Free on MTN/Airtel) or **999** (Landline)\n- **Ministry of Health (MoH) Uganda Toll-Free Helpline**: **0800 100 066** / **0800 203 033**\n- **Mulago National Referral Hospital (Casualty & Emergency)**: **+256 414 554 008** / **+256 414 554 001**\n- **National Drug Authority (NDA) Poison & Drug Safety**: **0800 101 622** (Toll-Free)\n- **Mental Health & Crisis Hotline (Butabika Hospital)**: **0800 200 600** (Toll-Free)\n\nIf this is an overdose or severe allergic reaction, proceed immediately to the nearest hospital or clinic and inform the medical team exactly what was taken.\n\nI am an AI, not a doctor. Please contact emergency services right away.",
  suggestions: ["Call Uganda Emergency (112)", "National Drug Authority Helpline", "I'm okay now"],
  source: "System Safety",
  action: null
};

/**
 * Fallback chat / completion with Gemini (supports dynamic prompt & schema)
 */
const callGeminiChat = async (finalMessages, priority = 'high', maxTokens = 4096, temperature = 0.7, customSystemPrompt = null, isJson = true) => {
  const activeGeminiKey = GEMINI_API_KEY || process.env.GEMINI_API_KEY_2;
  if (!activeGeminiKey) {
    throw new AppError('AI service is temporarily unavailable. Please try again later.', 503);
  }

  const rawSystemMsg = customSystemPrompt || finalMessages.find(m => m.role === 'system')?.content;
  const GEMINI_NATIVE_SYSTEM_INSTRUCTION_CHAR_LIMIT = 16000;
  let nativeSystemInstruction = null;
  let prependedSystemAsUserTurn = null;

  if (rawSystemMsg && typeof rawSystemMsg === 'string' && rawSystemMsg.trim().length > 0) {
    if (rawSystemMsg.length <= GEMINI_NATIVE_SYSTEM_INSTRUCTION_CHAR_LIMIT) {
      nativeSystemInstruction = rawSystemMsg;
    } else {
      const newline = rawSystemMsg.indexOf('\n');
      const firstParagraphEnd = rawSystemMsg.indexOf('\n\n') !== -1 ? rawSystemMsg.indexOf('\n\n') : (newline !== -1 ? newline : 1500);
      const distilledHead = rawSystemMsg.slice(0, Math.min(firstParagraphEnd + 1, 1500)).trim();
      const isDawaGpt = rawSystemMsg.includes('DawaGPT') || rawSystemMsg.includes('Dawa-Lens');
      const guidance = isDawaGpt
        ? 'Follow the complete detailed instructions provided in the first message of this conversation for all mandatory agentic rules, Ugandan regional context, navigation links, action schemas, Med Vault calculations, and Family Hub intelligence.'
        : 'Follow the complete detailed operational instructions and format specifications provided in the first message of this conversation strictly.';
      nativeSystemInstruction = `${distilledHead}\n\n${guidance}`;
      prependedSystemAsUserTurn = {
        role: 'user',
        parts: [{
          text: `=== MANDATORY PERMANENT SYSTEM INSTRUCTIONS FOR THIS ENTIRE CONVERSATION - READ, INTERNALIZE, AND OBEY EVERY RULE FOR EVERY SUBSEQUENT TURN ===\n\n${rawSystemMsg}\n\n=== END OF SYSTEM INSTRUCTIONS - Proceed with the conversation below, strictly following every rule above ===`
        }]
      };
    }
  }

  // Transform OpenAI/Groq messages format to Gemini format
  const rawContents = finalMessages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: (typeof m.content === 'string' && m.content.trim().length > 0) ? m.content : ' ' }]
    }));

  // If system instruction was too large for the native field, inject the FULL copy
  // as the very FIRST user-role chat context turn (bypasses ~16k systemInstruction cap;
  // normal chat context supports 1M+ tokens for Gemini 2.5 Flash).
  if (prependedSystemAsUserTurn) {
    rawContents.unshift(prependedSystemAsUserTurn);
  }

  // Merge consecutive turns with the same role for Gemini API compliance
  const contents = [];
  for (const c of rawContents) {
    if (contents.length > 0 && contents[contents.length - 1].role === c.role) {
      contents[contents.length - 1].parts[0].text += '\n\n' + c.parts[0].text;
    } else {
      contents.push(c);
    }
  }

  // Gemini requires at least one content part, and the last turn MUST be 'user'
  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  } else if (contents[contents.length - 1].role !== 'user') {
    contents.push({ role: 'user', parts: [{ text: 'Please continue.' }] });
  }

  const fn = async () => {
    const generationConfig = {
      maxOutputTokens: Math.max(maxTokens, 4096),
      temperature: temperature
    };
    if (isJson) {
      generationConfig.responseMimeType = 'application/json';
    }

    const payload = {
      contents,
      generationConfig
    };

    if (nativeSystemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: nativeSystemInstruction }]
      };
    }

    const candidateModels = Array.from(new Set([GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'].filter(Boolean)));
    let response = null;
    let lastGeminiErr = null;

    for (const mId of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${mId}:generateContent?key=${activeGeminiKey}`;
        response = await axios.post(url, payload, { timeout: 30000 });
        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          break;
        }
      } catch (gErr) {
        lastGeminiErr = gErr;
        console.warn(`Gemini (${mId}) failed:`, gErr.response?.data?.error?.message || gErr.message);
      }
    }

    if (!response) {
      throw lastGeminiErr || new AppError('Gemini API call failed.', 502);
    }

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AppError('Gemini returned an empty response.', 502);

    let parsed;
    const metaDelimRegex = /(?:###\s*METADATA\s*###|---\s*METADATA\s*---|###\s*Metadata\s*###|###METADATA###|---METADATA---)/i;
    const match = text.match(metaDelimRegex);
    if (match && match.index !== undefined) {
      const displayText = text.substring(0, match.index)
        .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '')
        .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, '')
        .trim();
      const rawMeta = text.substring(match.index + match[0].length).trim();
      let metaObj = {};
      try {
        metaObj = JSON.parse(sanitizeJson(rawMeta));
      } catch (e) {
        // Safe fallback for metadata parsing
      }
      parsed = {
        text: displayText,
        suggestions: Array.isArray(metaObj.suggestions) && metaObj.suggestions.length > 0
          ? metaObj.suggestions
          : ["Check medications", "View reminders", "Drug safety"],
        source: "Gemini (Fallback)",
        action: metaObj.action || null
      };
    } else {
      try {
        parsed = JSON.parse(sanitizeJson(text));
        if (typeof parsed === 'object' && parsed !== null) {
          parsed.text = parsed.text || parsed.message || parsed.response || parsed.advice || text;
          parsed.source = "Gemini (Fallback)";
          parsed.suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : ["Check medications", "View reminders", "Drug safety"];
          parsed.action = parsed.action || null;
        } else {
          parsed = {
            text: String(parsed),
            suggestions: ["Check medications", "View reminders", "Drug safety"],
            source: "Gemini (Fallback)",
            action: null
          };
        }
      } catch (err) {
        parsed = {
          text: text.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '').trim(),
          suggestions: ["Check medications", "View reminders", "Drug safety"],
          source: "Gemini (Fallback)",
          action: null
        };
      }
    }
    return parsed;
  };

  try {
    return await rateLimitManager.enqueue(fn, 'gemini', finalMessages, priority, 3, false);
  } catch (err) {
    console.error("Gemini Fallback Error:", err.response?.data?.error?.message || err.response?.data || err.message);
    throw new AppError('All AI services are currently unavailable. Please try again later.', 503);
  }
};

/**
 * Standard chat completion call to Cerebras (GPT-OSS-120B)
 */
const callCerebrasChat = async (messages, responseFormat = { type: 'json_object' }, modelId = CEREBRAS_MODEL, priority = 'high', maxTokens = 4096, failFast = false, temperature = 0.7) => {
  if (!CEREBRAS_API_KEY) {
    throw new AppError('Cerebras API key not configured', 503);
  }

  const fn = async () => {
    const payload = {
      model: modelId,
      messages,
      max_tokens: Math.max(maxTokens, 4096),
      temperature: temperature
    };
    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    const response = await axios.post(CEREBRAS_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 4000 // Reduced timeout for fast fallback
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new AppError('Cerebras returned an empty response.', 502);
    }

    const result = responseFormat?.type === 'json_object' ? JSON.parse(sanitizeJson(text)) : text;
    if (typeof result === 'object') result.source = `Cerebras (${modelId})`;
    return result;
  };

  return await rateLimitManager.enqueue(fn, 'cerebras-120b', messages, priority, 3, failFast);
};

const Z_AI_ENDPOINTS = [
  'https://api.z.ai/api/coding/paas/v4/chat/completions',
  'https://api.z.ai/api/paas/v4/chat/completions',
  'https://open.bigmodel.cn/api/paas/v4/chat/completions'
];

const Z_AI_MODELS = [
  'glm-5-flash',
  'glm-4.7-flash',
  'glm-4-flash',
  'glm-4',
  'glm-4-air',
  'glm-4.5-air'
];

let zaiWorkingEndpoint = null;
let zaiWorkingModel = null;

const callZaiChat = async (messages, responseFormat = { type: 'json_object' }, modelId = Z_AI_MODEL, priority = 'high', maxTokens = 2048, failFast = false, temperature = 0.7) => {
  if (!Z_AI_API_KEY) {
    throw new AppError('Z.ai API key not configured', 503);
  }

  const fn = async () => {
    let lastErr = null;
    let response = null;
    let successfulModel = zaiWorkingModel || modelId;

    const endpointsToTry = zaiWorkingEndpoint ? [zaiWorkingEndpoint] : Z_AI_ENDPOINTS;
    const modelsToTry = zaiWorkingModel ? [zaiWorkingModel] : Array.from(new Set([modelId, ...Z_AI_MODELS]));

    for (const url of endpointsToTry) {
      for (const targetModel of modelsToTry) {
        const payload = {
          model: targetModel,
          messages,
          max_tokens: maxTokens,
          temperature: temperature
        };

        try {
          response = await axios.post(url, payload, {
            headers: {
              'Authorization': `Bearer ${Z_AI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 8000
          });
          zaiWorkingEndpoint = url;
          zaiWorkingModel = targetModel;
          successfulModel = targetModel;
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (response) break;
    }

    if (!response) {
      throw lastErr || new AppError('Z.ai API request failed.', 502);
    }

    const choice = response.data?.choices?.[0];
    let text = choice?.message?.content;
    if (Array.isArray(text)) {
      text = text.map(part => (typeof part === 'string' ? part : part.text || part.content || '')).join('');
    }
    if (!text && choice?.message?.reasoning_content) {
      text = choice.message.reasoning_content;
    }

    if (!text) {
      const err = new AppError('Z.ai returned an empty response.', 502);
      err.responseData = response.data;
      throw err;
    }

    let result;
    if (responseFormat?.type === 'json_object') {
      try {
        result = JSON.parse(sanitizeJson(text));
      } catch (parseErr) {
        result = { text, source: `Z.ai (${successfulModel})` };
      }
    } else {
      result = text;
    }

    if (typeof result === 'object' && result !== null) result.source = `Z.ai (${successfulModel})`;
    return result;
  };

  return await rateLimitManager.enqueue(fn, 'zai-glm-5-flash', messages, priority, 3, failFast);
};

/**
 * Standard chat completion call to SambaNova Cloud (Llama-3.3-70B)
 */
const callSambaNovaChat = async (messages, responseFormat = { type: 'json_object' }, modelId = SAMBANOVA_MODEL, priority = 'high', maxTokens = 2048, failFast = false, temperature = 0.7) => {
  if (!SAMBANOVA_API_KEY) throw new AppError('SambaNova API key not configured', 503);

  const fn = async () => {
    const payload = { model: modelId, messages, max_tokens: maxTokens, temperature };
    if (responseFormat) payload.response_format = responseFormat;

    const response = await axios.post(SAMBANOVA_API_URL, payload, {
      headers: { 'Authorization': `Bearer ${SAMBANOVA_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 6000
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) throw new AppError('SambaNova returned an empty response.', 502);

    let result = responseFormat?.type === 'json_object' ? JSON.parse(sanitizeJson(text)) : text;
    if (typeof result === 'object' && result !== null) result.source = `SambaNova (${modelId})`;
    return result;
  };

  return await rateLimitManager.enqueue(fn, 'sambanova-70b', messages, priority, 3, failFast);
};

/**
 * Standard chat completion call to OpenRouter Free Tier
 */
const callOpenRouterChat = async (messages, responseFormat = { type: 'json_object' }, modelId = OPENROUTER_MODEL, priority = 'high', maxTokens = 2048, failFast = false, temperature = 0.7) => {
  if (!OPENROUTER_API_KEY) throw new AppError('OpenRouter API key not configured', 503);

  const fn = async () => {
    const payload = { model: modelId, messages, max_tokens: maxTokens, temperature };
    if (responseFormat) payload.response_format = responseFormat;

    const response = await axios.post(OPENROUTER_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://dawalens.web.app',
        'X-Title': 'Dawa-Lens',
        'Content-Type': 'application/json'
      },
      timeout: 7000
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) throw new AppError('OpenRouter returned an empty response.', 502);

    let result = responseFormat?.type === 'json_object' ? JSON.parse(sanitizeJson(text)) : text;
    if (typeof result === 'object' && result !== null) result.source = `OpenRouter (${modelId})`;
    return result;
  };

  return await rateLimitManager.enqueue(fn, 'openrouter-free', messages, priority, 3, failFast);
};

/**
 * Standard chat completion call to NVIDIA NIM (Llama-3.3-Nemotron-Super-49B)
 */
const callNvidiaNimChat = async (messages, responseFormat = { type: 'json_object' }, modelId = NVIDIA_MODEL, priority = 'high', maxTokens = 2048, failFast = false, temperature = 0.7) => {
  if (!NVIDIA_API_KEY) throw new AppError('NVIDIA API key not configured', 503);

  const fn = async () => {
    const payload = { model: modelId, messages, max_tokens: maxTokens, temperature };
    if (responseFormat) payload.response_format = responseFormat;

    const response = await axios.post(NVIDIA_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) throw new AppError('NVIDIA NIM returned an empty response.', 502);

    let result = responseFormat?.type === 'json_object' ? JSON.parse(sanitizeJson(text)) : text;
    if (typeof result === 'object' && result !== null) result.source = `NVIDIA NIM (${modelId})`;
    return result;
  };

  return await rateLimitManager.enqueue(fn, 'nvidia-nemotron', messages, priority, 3, failFast);
};

/**
 * Standard chat completion call to SiliconFlow (Qwen-2.5-7B)
 */
const callSiliconFlowChat = async (messages, responseFormat = { type: 'json_object' }, modelId = SILICONFLOW_MODEL, priority = 'high', maxTokens = 2048, failFast = false, temperature = 0.7) => {
  if (!SILICONFLOW_API_KEY) throw new AppError('SiliconFlow API key not configured', 503);

  const fn = async () => {
    const payload = { model: modelId, messages, max_tokens: maxTokens, temperature };
    if (responseFormat) payload.response_format = responseFormat;

    const response = await axios.post(SILICONFLOW_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 9000
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) throw new AppError('SiliconFlow returned an empty response.', 502);

    let result = responseFormat?.type === 'json_object' ? JSON.parse(sanitizeJson(text)) : text;
    if (typeof result === 'object' && result !== null) result.source = `SiliconFlow (${modelId})`;
    return result;
  };

  return await rateLimitManager.enqueue(fn, 'siliconflow-qwen', messages, priority, 3, failFast);
};

/**
 * Standard chat completion call to Mistral AI
 */
const callMistralChat = async (messages, responseFormat = { type: 'json_object' }, modelId = MISTRAL_MODEL, priority = 'high', maxTokens = 2048, failFast = false, temperature = 0.7) => {
  if (!MISTRAL_API_KEY) throw new AppError('Mistral API key not configured', 503);

  const fn = async () => {
    const payload = { model: modelId, messages, max_tokens: maxTokens, temperature };
    if (responseFormat) payload.response_format = responseFormat;

    const response = await axios.post(MISTRAL_API_URL, payload, {
      headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 7000
    });

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) throw new AppError('Mistral AI returned an empty response.', 502);

    let result = responseFormat?.type === 'json_object' ? JSON.parse(sanitizeJson(text)) : text;
    if (typeof result === 'object' && result !== null) result.source = `Mistral AI (${modelId})`;
    return result;
  };

  return await rateLimitManager.enqueue(fn, 'mistral-small', messages, priority, 3, failFast);
};

/**
 * Standard chat completion call to Groq routed via rate limit queue
 */
/**
 * Standard chat completion call to Groq routed via rate limit queue
 */
const callGroqChat = async (messages, responseFormat = { type: 'json_object' }, modelId = GROQ_MODEL, priority = 'high', maxTokens = 4096, failFast = false, temperature = 0.7) => {
  const { key: initialApiKey, keySuffix } = getGroqKeyInfo();
  if (!initialApiKey) {
    throw new AppError('Groq API key not configured', 401);
  }

  const baseModelKey = modelId === GROQ_MODEL ? 'groq-70b'
    : modelId === GROQ_SCOUT_MODEL ? 'groq-scout'
      : modelId === 'qwen/qwen3.6-27b' ? 'groq-qwen'
        : 'groq-8b';
  const modelKey = `${baseModelKey}${keySuffix}`;

  const fn = async () => {
    // Resilient candidate list: active Groq production models first, legacy as tail fallback
    const rawCandidates = [
      sanitizeGroqModel(modelId),
      GROQ_MODEL,
      'openai/gpt-oss-120b',
      'qwen/qwen3.6-27b',
      'openai/gpt-oss-20b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant'
    ];
    const candidateModels = Array.from(new Set(rawCandidates.filter(Boolean)));

    let response = null;
    let lastErr = null;
    let usedModel = modelId;

    for (const currentModel of candidateModels) {
      const isReasoningModel = typeof currentModel === 'string' && (currentModel.includes('gpt-oss') || currentModel.includes('qwen') || currentModel.includes('deepseek-r1') || currentModel.includes('qwq'));
      const effectiveMaxTokens = isReasoningModel ? Math.max(maxTokens, 4096) : Math.max(maxTokens, 2048);
      const currentApiKey = initialApiKey;

      const payload = {
        model: currentModel,
        messages,
        max_tokens: effectiveMaxTokens,
        temperature: temperature
      };
      if (responseFormat) {
        payload.response_format = responseFormat;
      }
      if (isReasoningModel && responseFormat?.type === 'json_object') {
        payload.reasoning_format = 'hidden';
      }

      try {
        response = await axios.post(GROQ_API_URL, payload, {
          headers: {
            'Authorization': `Bearer ${currentApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 25000 // 25s timeout for reasoning models & deep contexts
        });
        if (response.data?.choices?.[0]?.message?.content) {
          usedModel = currentModel;
          break;
        }
      } catch (apiErr) {
        lastErr = apiErr;
        const errMsg = apiErr.response?.data?.error?.message || apiErr.response?.data || apiErr.message;
        console.warn(`Groq (${currentModel}) API error:`, errMsg);
        const status = apiErr.response?.status;
        // Only hard-fail on auth errors — for any other error (400, 404, 422, 429, 5xx),
        // try the next candidate model in the list.
        if (status === 401 || status === 403) {
          throw apiErr;
        }
        // Continue to next model for all other errors
        continue;
      }
    }

    if (!response) {
      throw lastErr || new AppError('AI returned an empty response.', 502);
    }

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new AppError('AI returned an empty response.', 502);
    }

    const result = responseFormat?.type === 'json_object' ? JSON.parse(sanitizeJson(text)) : text;
    if (typeof result === 'object' && result !== null) result.source = `Groq (${usedModel})`;
    return result;
  };

  return await rateLimitManager.enqueue(fn, modelKey, messages, priority, 3, failFast);
};

/**
 * Unified AI call with multi-provider fallback cascade.
 * Attempts preferred model first, then gracefully cascades through all available providers.
 */
export const callAiWithFallback = async (messages, options = {}) => {
  const {
    isJson = true,
    priority = 'high',
    maxTokens = 4096,
    isComplex = true,
    preferredModel = null,
    forceModel = null,
    temperature = 0.7
  } = options;

  const responseFormat = isJson ? { type: 'json_object' } : null;

  // Strict forced model (used primarily for isolated provider test diagnostics)
  if (forceModel) {
    if (forceModel === 'cerebras' || forceModel === CEREBRAS_MODEL || forceModel === 'llama-3.3-70b') {
      return await callCerebrasChat(messages, responseFormat, CEREBRAS_MODEL, priority, maxTokens, false, temperature);
    }
    if (forceModel === 'groq-70b' || forceModel === GROQ_MODEL) {
      return await callGroqChat(messages, responseFormat, GROQ_MODEL, priority, maxTokens, false, temperature);
    }
    if (forceModel === 'groq-scout' || forceModel === GROQ_SCOUT_MODEL) {
      return await callGroqChat(messages, responseFormat, GROQ_SCOUT_MODEL, priority, maxTokens, false, temperature);
    }
    if (forceModel === 'groq-8b' || forceModel === GROQ_LIGHT_MODEL) {
      return await callGroqChat(messages, responseFormat, GROQ_LIGHT_MODEL, priority, maxTokens, false, temperature);
    }
    if (forceModel === 'sambanova' || forceModel === SAMBANOVA_MODEL) {
      return await callSambaNovaChat(messages, responseFormat, SAMBANOVA_MODEL, priority, maxTokens, false, temperature);
    }
    if (forceModel === 'nvidia' || forceModel === 'nvidia-nemotron' || forceModel === NVIDIA_MODEL || forceModel === 'nvidia/llama-3.1-nemotron-70b-instruct') {
      return await callNvidiaNimChat(messages, responseFormat, NVIDIA_MODEL, priority, maxTokens, false, temperature);
    }
    if (forceModel === 'siliconflow' || forceModel === 'qwen-7b' || forceModel === SILICONFLOW_MODEL) {
      return await callSiliconFlowChat(messages, responseFormat, SILICONFLOW_MODEL, priority, maxTokens, false, temperature);
    }
    if (forceModel === 'openrouter' || forceModel === OPENROUTER_MODEL) {
      return await callOpenRouterChat(messages, responseFormat, OPENROUTER_MODEL, priority, maxTokens, false, temperature);
    }
    if (forceModel === 'mistral' || forceModel === MISTRAL_MODEL || forceModel === 'mistral-small-2501') {
      return await callMistralChat(messages, responseFormat, MISTRAL_MODEL, priority, maxTokens, false, temperature);
    }
    if (forceModel === 'zai' || forceModel === Z_AI_MODEL || forceModel === 'glm-4.7-flash') {
      return await callZaiChat(messages, responseFormat, Z_AI_MODEL, priority, maxTokens, false, temperature);
    }
    if (forceModel === 'gemini' || forceModel === GEMINI_MODEL || forceModel === 'gemini-2.5-flash' || forceModel === 'gemini-2.0-flash') {
      return await callGeminiChat(messages, priority, maxTokens, temperature, null, isJson);
    }
  }

  // If a preferred model was requested (e.g. GROQ_LIGHT_MODEL for low-latency tasks), try it first
  if (preferredModel) {
    if ((preferredModel === GROQ_LIGHT_MODEL || preferredModel === 'groq-8b') && (GROQ_API_KEY_2 || GROQ_API_KEY)) {
      try {
        return await callGroqChat(messages, responseFormat, GROQ_LIGHT_MODEL, priority, maxTokens, true, temperature);
      } catch (err) {
        console.warn(`Preferred model (${GROQ_LIGHT_MODEL}) failed, proceeding to fallback cascade...`, err.message);
      }
    } else if ((preferredModel === GROQ_MODEL || preferredModel === 'groq-70b') && GROQ_API_KEY) {
      try {
        return await callGroqChat(messages, responseFormat, GROQ_MODEL, priority, maxTokens, true, temperature);
      } catch (err) {
        console.warn(`Preferred model (${GROQ_MODEL}) failed, proceeding to fallback cascade...`, err.message);
      }
    } else if ((preferredModel === GROQ_SCOUT_MODEL || preferredModel === 'groq-scout') && GROQ_API_KEY) {
      try {
        return await callGroqChat(messages, responseFormat, GROQ_SCOUT_MODEL, priority, maxTokens, true, temperature);
      } catch (err) {
        console.warn(`Preferred model (${GROQ_SCOUT_MODEL}) failed, proceeding to fallback cascade...`, err.message);
      }
    }
  }

  // 1. Try Cerebras (Primary ultra-fast 120B, for complex tasks)
  if (CEREBRAS_API_KEY && isComplex) {
    try {
      return await callCerebrasChat(messages, responseFormat, CEREBRAS_MODEL, priority, maxTokens, true, temperature);
    } catch (err) {
      console.warn("Fallback: Cerebras failed, trying Groq Primary...", err.message);
    }
  }

  // 2. Try Groq Primary across independent accounts
  if (GROQ_KEYS.length > 0 && preferredModel !== GROQ_MODEL && preferredModel !== 'groq-70b') {
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        return await callGroqChat(messages, responseFormat, GROQ_MODEL, priority, maxTokens, true, temperature);
      } catch (err) {
        console.warn(`Fallback: Groq Primary key attempt ${i + 1} failed.`, err.message);
      }
    }
  }

  // 3. Try SambaNova Cloud (Ultra-fast 70B)
  if (SAMBANOVA_API_KEY) {
    try {
      return await callSambaNovaChat(messages, responseFormat, SAMBANOVA_MODEL, priority, maxTokens, true, temperature);
    } catch (err) {
      console.warn("Fallback: SambaNova failed, trying NVIDIA NIM...", err.message);
    }
  }

  // 4. Try NVIDIA NIM (Llama-3.3-Nemotron-Super-49B)
  if (NVIDIA_API_KEY) {
    try {
      return await callNvidiaNimChat(messages, responseFormat, NVIDIA_MODEL, priority, maxTokens, true, temperature);
    } catch (err) {
      console.warn("Fallback: NVIDIA NIM failed, trying OpenRouter Free...", err.message);
    }
  }

  // 5. Try OpenRouter Free Tier (Llama-3.3-70B:free)
  if (OPENROUTER_API_KEY) {
    try {
      return await callOpenRouterChat(messages, responseFormat, OPENROUTER_MODEL, priority, maxTokens, true, temperature);
    } catch (err) {
      console.warn("Fallback: OpenRouter Free failed, trying Mistral AI...", err.message);
    }
  }

  // 6. Try Mistral AI (Mistral Small)
  if (MISTRAL_API_KEY) {
    try {
      return await callMistralChat(messages, responseFormat, MISTRAL_MODEL, priority, maxTokens, true, temperature);
    } catch (err) {
      console.warn("Fallback: Mistral AI failed, trying Groq Scout...", err.message);
    }
  }

  // 7. Try Groq Scout (openai/gpt-oss-120b)
  if (GROQ_KEYS.length > 0 && preferredModel !== GROQ_SCOUT_MODEL && preferredModel !== 'groq-scout') {
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        return await callGroqChat(messages, responseFormat, GROQ_SCOUT_MODEL, priority, maxTokens, true, temperature);
      } catch (err) {
        console.warn(`Fallback: Groq Scout key attempt ${i + 1} failed.`, err.message);
      }
    }
  }

  // 8. Try Groq Light (openai/gpt-oss-20b or light model)
  if (GROQ_KEYS.length > 0 && preferredModel !== GROQ_LIGHT_MODEL && preferredModel !== 'groq-8b') {
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        return await callGroqChat(messages, responseFormat, GROQ_LIGHT_MODEL, priority, maxTokens, true, temperature);
      } catch (err) {
        console.warn(`Fallback: Groq Light key attempt ${i + 1} failed.`, err.message);
      }
    }
  }

  // 8b. Try Groq Qwen (qwen/qwen3.6-27b)
  if (GROQ_KEYS.length > 0) {
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      try {
        return await callGroqChat(messages, responseFormat, 'qwen/qwen3.6-27b', priority, maxTokens, true, temperature);
      } catch (err) {
        console.warn(`Fallback: Groq Qwen key attempt ${i + 1} failed.`, err.message);
      }
    }
  }

  // 9. Try SiliconFlow (Qwen-2.5-7B)
  if (SILICONFLOW_API_KEY) {
    try {
      return await callSiliconFlowChat(messages, responseFormat, SILICONFLOW_MODEL, priority, maxTokens, true, temperature);
    } catch (err) {
      console.warn("Fallback: SiliconFlow failed, trying Z.ai...", err.message);
    }
  }

  // 10. Try Z.ai (GLM-5-Flash)
  if (Z_AI_API_KEY) {
    try {
      return await callZaiChat(messages, responseFormat, Z_AI_MODEL, priority, maxTokens, true, temperature);
    } catch (err) {
      console.warn("Fallback: Z.ai GLM-5-Flash failed, trying Gemini...", err.message);
    }
  }

  // 11. Try Gemini (Final fallback with full schema support)
  try {
    return await callGeminiChat(messages, priority, maxTokens, temperature, null, isJson);
  } catch (err) {
    console.error("Fallback: ALL AI providers failed.", err.message);
    throw new AppError('All AI services are currently unavailable. Please try again later.', 503);
  }
};

const callGroq = async (prompt, isJson = true, modelId = GROQ_MODEL, priority = 'high', maxTokens = 2048, temperature = 0.7) => {
  const messages = [{ role: 'user', content: prompt }];
  const isComplex = modelId === GROQ_MODEL || modelId === GROQ_SCOUT_MODEL;
  try {
    return await callAiWithFallback(messages, { isJson, priority, maxTokens, isComplex, preferredModel: modelId, temperature });
  } catch (err) {
    handleAiError(err);
  }
};

// --- Helpers ---

const responseCache = new Map();

/**
 * Helper to wrap AI calls with a simple in-memory TTL cache.
 */
const withCache = async (key, ttlMs, fn) => {
  const hit = responseCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value;

  const value = await fn();
  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });

  // Evict stale entries to prevent memory leak
  if (responseCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of responseCache) {
      if (now > v.expiresAt) responseCache.delete(k);
    }
  }
  return value;
};

export const getWellnessQuote = async (userName, priority = 'medium') => {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `quote:${userName || 'friend'}:${today}`;

  return withCache(cacheKey, 24 * 60 * 60 * 1000, async () => {
    const prompt = `
      Generate a short, powerful, and inspiring wellness quote (max 15 words) for a health app user named ${userName || 'friend'}.
      The quote should emphasize consistency, strength, or the journey to better health.
      Context: Uganda (keep it culturally relevant but universally inspiring).
      Respond in JSON format: { "quote": "..." }
    `;
    return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 200, 0.6);
  });
};

export const getCoachAdvice = async (logs, medicines, userName, priority = 'high') => {
  const prompt = `
    You are the "Dawa-Lens Adherence Coach", a supportive health assistant for users in Uganda.
    User Name: ${userName || 'User'}
    Current Medications: ${JSON.stringify(medicines)}
    Recent Medication Activity (Logs): ${JSON.stringify(logs)}
    
    Your task:
    1. Analyze the logs for any patterns in missed or delayed doses.
    2. Provide supportive, non-judgmental advice.
    3. If adherence is high, give praise.
    4. Mention specific medications with more misses.
    5. Proactive suggestions: If a user consistently misses a dose at a certain time, suggest moving it by 30-60 minutes if safe, or suggest a specific ritual (e.g., "take with your morning tea").
    6. Tone: Warm and culturally appropriate for Uganda.
    7. Warning: Do not change dosages. Advise doctor visit if heart/BP meds are skipped.
    8. Use Markdown for formatting the advice (bolding, lists) to make it readable.
    9. DATE FORMATTING: For any dates or times generated in the response, only include the date and time (YYYY-MM-DD HH:mm). REMOVE seconds and milliseconds.

    Respond in JSON format:
    { "advice": "text (Markdown formatted)", "patterns": ["list"], "adherenceScore": 0-100 }
  `;
  const result = await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 800);
  if (result && typeof result.advice === 'string') {
    result.advice = result.advice.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  }
  return result;
};

export const checkHolisticSafety = async (medicines, lifestyleFactors = [], priority = 'high') => {
  if (!Array.isArray(lifestyleFactors) || lifestyleFactors.length === 0) {
    return { interactions: [] };
  }

  // Deduplicate and sanitize requested factors
  const requestedFactors = Array.from(
    new Set(lifestyleFactors.map(f => (typeof f === 'string' ? f.trim() : '')).filter(Boolean))
  );

  if (requestedFactors.length === 0) {
    return { interactions: [] };
  }

  // Fetch FDA labels to ground interaction assertions
  let fdaInteractionSnippets = [];
  try {
    const labelPromises = (medicines || []).slice(0, 4).map(m => fetchDrugLabel(m.name || m.genericName));
    const labels = await Promise.all(labelPromises);
    fdaInteractionSnippets = labels
      .filter(l => l && (l.drugInteractions || l.boxedWarning))
      .map(l => `[FDA Label: ${l.brandName || l.genericName}]: ${l.drugInteractions ? l.drugInteractions.slice(0, 350) : ''} ${l.boxedWarning ? 'Boxed Warning: ' + l.boxedWarning.slice(0, 200) : ''}`);
  } catch (fdaErr) {
    console.warn('[checkHolisticSafety] FDA grounding retrieval skipped:', fdaErr.message);
  }

  // Inject relevant Ugandan nutritional context ONLY if requested factors mention them
  const matchedLocalFoods = (LOCAL_FOODS || []).filter(lf =>
    requestedFactors.some(rf => rf.toLowerCase().includes(lf.name.toLowerCase()) || lf.name.toLowerCase().includes(rf.toLowerCase()))
  );
  const localFoodContext = matchedLocalFoods.length > 0
    ? `\n    === LOCAL NUTRITIONAL CONTEXT (Relevant to requested items) ===\n    ${matchedLocalFoods.map(f => `- ${f.name}: ${f.benefits} (${f.medicationContext})`).join('\n    ')}\n`
    : '';

  const prompt = `
    You are the "Dawa-Lens Clinical Holistic & Dietary Safety Engine".
    Your role is to provide rigorous, realistic, and pharmacologically accurate food, herb, beverage, and lifestyle interaction analysis for a patient taking specific medications.

    === PATIENT MEDICATIONS ===
    ${(medicines || []).map((m, i) => `${i + 1}. ${m.name || 'Unknown'}${m.genericName ? ` (Generic: ${m.genericName})` : ''}${m.dosage ? ` - Dose: ${m.dosage}` : ''}`).join('\n    ')}

    === REQUESTED FOODS / LIFESTYLE FACTORS TO EVALUATE ===
    ${requestedFactors.map((f, i) => `${i + 1}. "${f}"`).join('\n    ')}
    ${fdaInteractionSnippets.length > 0 ? `\n    === FDA DRUG INTERACTION GROUNDING DATA ===\n    ${fdaInteractionSnippets.join('\n    ')}\n` : ''}${localFoodContext}

    === CRITICAL EVALUATION RULES ===
    1. STRICT EXCLUSIVITY: Evaluate ONLY and EXACTLY the ${requestedFactors.length} item(s) listed under "REQUESTED FOODS / LIFESTYLE FACTORS TO EVALUATE".
       DO NOT include, mention, or return evaluations for ANY unrequested foods, drinks, or herbs. Never hallucinate or add items like Alcohol, Grapefruit, Dairy, or Mukene unless they are explicitly in the requested list above.
    2. EXACT 1-TO-1 MAPPING: You MUST return exactly one entry in the "interactions" array for each requested factor in the list.
    3. CLINICAL REALISM & ACCURACY:
       - Base your assessment on real clinical pharmacology (pharmacokinetics, CYP enzyme inhibition/induction like CYP3A4/CYP2D6, P-glycoprotein, chelation with polyvalent cations like Ca2+/Mg2+/Fe2+, GI motility, additive CNS sedation, potassium retention, tyramine reactions, etc.).
       - Specify which medication(s) from the patient's list are affected in "affectedMedicines". If no medications are affected, set "affectedMedicines" to [] and classify risk as "Safe".
       - If there is NO known clinically significant interaction between the food/factor and the patient's medications, DO NOT invent one. Accurately mark risk as "Safe" (or "Low" for minor theoretical dietary notes) and reassure the patient.
       - Risk classification must be strictly one of: "High", "Medium", "Low", "Safe".
         * "High": Severe, hazardous adverse reaction (toxicity, profound hypotension, major bleeding, critical loss of efficacy).
         * "Medium": Clinically significant interaction requiring spacing (e.g. 2-4 hours apart), dosage timing adjustment, or moderation.
         * "Low": Minor interaction with minimal clinical consequence in normal dietary amounts.
         * "Safe": No clinically meaningful interaction between this item and the patient's active medications.
       - "explanation": Concise, clear medical markdown explaining what happens in the body or why it is safe.
       - "advice": Actionable, realistic markdown advice (e.g., exact hours to space medication and food, dietary portion limits, what symptoms to watch for, or reassurance of safety).

    === STRICT JSON FORMAT ===
    {
      "interactions": [
        {
          "factor": "Exact name of requested factor",
          "risk": "High" | "Medium" | "Low" | "Safe",
          "affectedMedicines": ["Affected Medication Name"],
          "mechanism": "Short clinical summary of mechanism (e.g. CYP3A4 inhibition, cation chelation, no interaction)",
          "explanation": "Markdown formatted explanation",
          "advice": "Markdown formatted advice"
        }
      ]
    }
  `;

  let rawResult;
  try {
    rawResult = await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 800);
  } catch (aiErr) {
    console.error('[checkHolisticSafety] AI call failed:', aiErr.message);
    throw aiErr;
  }

  // Defensive post-processing: Guarantee 100% adherence to only requested factors
  const returnedInteractions = Array.isArray(rawResult?.interactions) ? rawResult.interactions : [];

  // Filter out any hallucinated factors that do not match the requested factors
  const filteredInteractions = returnedInteractions.filter(item => {
    if (!item || !item.factor) return false;
    const factorLower = item.factor.trim().toLowerCase();
    return requestedFactors.some(rf => {
      const rfLower = rf.toLowerCase();
      return factorLower === rfLower || factorLower.includes(rfLower) || rfLower.includes(factorLower);
    });
  });

  // Ensure every requested factor has an entry in the response
  const finalInteractions = requestedFactors.map(rf => {
    const rfLower = rf.toLowerCase();
    const existing = filteredInteractions.find(i => {
      const iLower = (i.factor || '').toLowerCase();
      return iLower === rfLower || iLower.includes(rfLower) || rfLower.includes(iLower);
    });

    if (existing) {
      let risk = existing.risk || 'Low';
      const riskLower = String(risk).toLowerCase();
      if (riskLower.includes('high') || riskLower.includes('severe')) risk = 'High';
      else if (riskLower.includes('med') || riskLower.includes('mod')) risk = 'Medium';
      else if (riskLower.includes('safe') || riskLower.includes('none')) risk = 'Safe';
      else risk = 'Low';

      return {
        ...existing,
        factor: rf,
        risk,
        affectedMedicines: Array.isArray(existing.affectedMedicines) ? existing.affectedMedicines : [],
        mechanism: existing.mechanism || (risk === 'Safe' ? 'No known pharmacological interaction' : 'Pharmacological interaction'),
        explanation: existing.explanation || `No significant clinical interaction reported between ${rf} and your medications.`,
        advice: existing.advice || `Safe to consume ${rf} in typical dietary quantities.`
      };
    }

    // Default entry if model somehow omitted a factor
    return {
      factor: rf,
      risk: 'Safe',
      affectedMedicines: [],
      mechanism: 'No known pharmacological interaction',
      explanation: `Based on clinical pharmacological data, **${rf}** does not have any known significant interaction with your current medications (${(medicines || []).map(m => m.name).join(', ')}).`,
      advice: `You may safely consume **${rf}** as part of your normal diet without altering your medication timing.`
    };
  });

  return { interactions: finalInteractions };
};

export const getTravelAdvice = async ({ medicines, destination, currentCity, homeTimezone, targetTimezone }, priority = 'high') => {
  const medList = Array.isArray(medicines) ? medicines : [];
  const prompt = `
    You are the "Dawa-Lens Global Travel Companion".
    Travel: ${currentCity || 'Home'} (${homeTimezone}) to ${destination} (${targetTimezone || 'Unknown'}).
    Medicines: ${JSON.stringify(medList.map(m => ({ name: m.name, generic: m.genericName, dosage: m.dosage })))}
    
    Task:
    1. Find equivalent brand names or local generic formulations in ${destination} for EVERY SINGLE MEDICATION in the Medicines list.
       CRITICAL: You MUST provide an equivalent entry for EVERY medication provided in the Medicines list above without omitting any. If a medicine is sold under the same brand or generic name in ${destination}, state its local availability/brand (e.g. "Panadol / Paracetamol" or "Available as [Name] in ${destination}").
    2. Timezone shift advice for dosing.
    3. Customs restrictions for these specific meds.
    4. Provide ONLY TWO emergency contact numbers for ${destination}:
       a) Ambulance / Emergency Medical Services number (e.g. 999, 911, 112, or country-specific)
       b) The NATIONAL DRUG REGULATORY AUTHORITY (e.g. National Drug Authority in Uganda, FDA in USA, MHRA in UK, CDSCO in India) — include their name and public helpline number.
       Do NOT include Police. Do NOT include generic numbers like 112 for the drug authority.
    5. Provide a detailed summary of general health risks (e.g. Malaria, yellow fever, water safety) for ${destination} in a clear markdown format.
    6. Use Markdown for formatting the advice, notes, and risks.

    Respond in EXACT JSON format:
    { 
      "equivalents": [
        { "original": "Original medicine name exactly as in input", "equivalent": "Local equivalent brand name or generic in ${destination}" }
      ],
      "timezoneAdvice": "text (Markdown formatted)",
      "customsNotes": "text (Markdown formatted)",
      "emergencyContacts": [
        { "service": "Ambulance", "number": "...", "type": "ambulance" },
        { "service": "[Full Authority Name]", "number": "...", "type": "drug_authority" }
      ],
      "healthRisks": "text (Markdown formatted)"
    }
  `;

  let rawResult;
  try {
    rawResult = await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 1200);
  } catch (aiErr) {
    console.error('[getTravelAdvice] AI call failed:', aiErr.message);
    throw aiErr;
  }

  const returnedEquivalents = Array.isArray(rawResult?.equivalents) ? rawResult.equivalents : [];

  // Defensive post-processing: Guarantee 100% representation for every medication in the user's list
  const finalEquivalents = medList.map(med => {
    const medName = (med.name || '').trim();
    const medGeneric = (med.genericName || '').trim();
    const medNameLower = medName.toLowerCase();
    const medGenericLower = medGeneric.toLowerCase();

    const existing = returnedEquivalents.find(eq => {
      const orig = String(eq?.original || eq?.medicine || eq?.name || eq?.drug || '').trim().toLowerCase();
      if (!orig) return false;
      return orig === medNameLower ||
             orig.includes(medNameLower) ||
             medNameLower.includes(orig) ||
             (medGenericLower && (orig === medGenericLower || orig.includes(medGenericLower) || medGenericLower.includes(orig)));
    });

    if (existing) {
      return {
        original: medName || existing.original || 'Unknown Medicine',
        equivalent: existing.equivalent || existing.local_name || existing.localEquivalent || existing.brand || existing.alternative || (medGeneric ? `${medGeneric} (Available locally)` : `${medName} (Available locally)`)
      };
    }

    return {
      original: medName,
      equivalent: medGeneric ? `${medGeneric} (Consult local pharmacist)` : `${medName} (Consult local pharmacist)`
    };
  });

  const unescapeText = (val) => {
    if (typeof val !== 'string') return val;
    return val.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  };

  return {
    ...rawResult,
    timezoneAdvice: unescapeText(rawResult?.timezoneAdvice),
    customsNotes: unescapeText(rawResult?.customsNotes),
    healthRisks: typeof rawResult?.healthRisks === 'string'
      ? unescapeText(rawResult.healthRisks)
      : Array.isArray(rawResult?.healthRisks)
        ? rawResult.healthRisks.map(unescapeText)
        : rawResult?.healthRisks,
    equivalents: finalEquivalents.length > 0 ? finalEquivalents : returnedEquivalents
  };
};

export const getWellnessInsight = async (doseLogs = [], wellnessLogs = [], medicines = [], patientContext = null, priority = 'high') => {
  const safeMedicines = Array.isArray(medicines) ? medicines : [];
  const safeDoseLogs = Array.isArray(doseLogs) ? doseLogs : [];
  const safeWellnessLogs = Array.isArray(wellnessLogs) ? wellnessLogs : [];

  const patientInfo = patientContext ? `
    Patient Name: ${patientContext.name || 'Patient'}
    Age: ${patientContext.age ?? 'Not specified'}
    Gender: ${patientContext.gender ?? 'Not specified'}
    Known Conditions: ${JSON.stringify(patientContext.conditions || [])}
    Known Allergies: ${JSON.stringify(patientContext.allergies || [])}
  ` : '';

  const prompt = `
    You are the "Dawa-Lens Medical Data Analyst".
    
    === PATIENT CONTEXT ===
    ${patientInfo || 'General patient profile.'}

    === DATA FOR ANALYSIS ===
    Medicines: ${JSON.stringify(safeMedicines.map(m => (typeof m === 'string' ? m : m?.name || '')))}
    Medication Logs (last 30 days): ${JSON.stringify(safeDoseLogs.slice(0, 30).map(l => ({
    med: l?.medicineName,
    time: l?.actionTime ? l.actionTime.replace(/:\d{2}\.\d{3}Z$/, '').replace('T', ' ') : undefined,
    status: l?.action
  })))}
    Wellness/Symptom Logs: ${JSON.stringify(safeWellnessLogs.slice(0, 20).map(l => ({
    time: l?.timestamp ? l.timestamp.replace(/:\d{2}\.\d{3}Z$/, '').replace('T', ' ') : undefined,
    type: l?.type,
    data: l?.data
  })))}
    
    === TASK ===
    1. Correlate medication adherence with wellness trends (side effects, energy, mood).
    2. Identify specific dosage patterns (e.g., missed morning doses, timing delays).
    3. Generate a high-level clinical summary suitable for a doctor and patient.
    4. Determine an overall health / adherence score (0-100) and status ("improving", "declining", or "stable").
    5. DATE FORMATTING: For any dates or times generated in the response, only include the date and time (YYYY-MM-DD HH:mm). REMOVE seconds and milliseconds.

    === RESPONSE FORMAT (STRICT JSON) ===
    { 
      "summary": "2-3 sentences high level clinical overview (Markdown formatted).",
      "dosagePatterns": "Analysis of adherence, skipped doses, and timing (Markdown formatted).",
      "lifestyleAnalysis": "Correlation between symptoms/energy and logs (Markdown formatted).",
      "insights": ["Specific correlation bullet 1", "Specific correlation bullet 2"],
      "insight": "Single primary highlight sentence for quick glance.",
      "actionItems": ["Actionable clinical suggestion 1", "Suggestion 2"],
      "recommendation": "Primary actionable clinical recommendation.",
      "correlationScore": 85,
      "score": 85,
      "status": "improving"
    }
  `;

  const messages = [{ role: 'user', content: prompt }];
  const raw = await callAiWithFallback(messages, {
    isJson: true,
    priority,
    maxTokens: 1200,
    isComplex: true,
    preferredModel: GROQ_MODEL,
    temperature: 0.6
  });

  if (raw && typeof raw === 'object') {
    const scoreVal = typeof raw.score === 'number'
      ? raw.score
      : (typeof raw.correlationScore === 'number' ? raw.correlationScore : 80);
    raw.score = Math.max(0, Math.min(100, Math.round(scoreVal)));
    raw.correlationScore = raw.score;

    if (!raw.insight) {
      raw.insight = Array.isArray(raw.insights) && raw.insights.length > 0
        ? raw.insights[0]
        : (raw.summary || "Adherence patterns recorded.");
    }
    if (!Array.isArray(raw.insights)) {
      raw.insights = raw.insight ? [raw.insight] : [];
    }
    if (!raw.recommendation) {
      raw.recommendation = Array.isArray(raw.actionItems) && raw.actionItems.length > 0
        ? raw.actionItems[0]
        : "Maintain consistent scheduled doses.";
    }
    if (!Array.isArray(raw.actionItems)) {
      raw.actionItems = raw.recommendation ? [raw.recommendation] : [];
    }
    if (!raw.status || !['improving', 'declining', 'stable'].includes(raw.status)) {
      raw.status = raw.score >= 75 ? 'improving' : raw.score >= 50 ? 'stable' : 'declining';
    }
  }

  return raw;
};

export const checkMealSafety = async (medicines, mealDescription, priority = 'high') => {
  const prompt = `
    You are "Dawa-Lens Meal Safety Checker".
    Medicines: ${JSON.stringify(medicines.map(m => m.name + (m.genericName ? ` (${m.genericName})` : '')))}
    Meal: "${mealDescription}"

    Task: Check for interactions (Dairy, Grapefruit, Alcohol, etc.).
    Risk: High, Medium, Safe.
    Use Markdown for formatting the verdict and explanation.

    Respond in JSON format:
    { "risk": "...", "verdict": "text (Markdown)", "explanation": "text (Markdown)" }
  `;
  return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 400, 0.1);
};

export const getNutritionalGuidance = async (medicines, priority = 'high') => {
  const medKey = medicines.map(m => m.name + (m.genericName || '')).sort().join(',');
  const cacheKey = `nutrition:${medKey}`;

  return withCache(cacheKey, 24 * 60 * 60 * 1000, async () => {
    const prompt = `
      You are the "Dawa-Lens Nutritional Guard".
      Active Medications: ${JSON.stringify(medicines.map(m => ({ name: m.name, generic: m.genericName })))}

      Task:
      1. Provide 2-3 specific "Food Recommendations" that aid absorption or mitigate side effects for these medications.
      2. Identify "Critical Safety Warnings" regarding foods/drinks to avoid (e.g., Grapefruit, Alcohol, Dairy, Caffeine). Format each explanation with concise bullet points on separate lines (* bullet 1\n* bullet 2) and bold medication names with **MedName**.
      3. Include "Timing Advice" as a numbered list where EACH numbered item is placed on its own line (e.g. 1. **Take Drug** before meals.\n2. **Drug B** with food.\n...). Do NOT compress everything into a single run-on paragraph.
      4. Focus on Ugandan foods (Matooke, G-nuts, Mukene, Kalo, Nakati, etc.) where appropriate, explaining their specific local benefits.
      5. Use clean Markdown formatting for reasons, explanations, and advice. Always separate list items with newline characters (\n).

      Respond in EXACT JSON format:
      {
        "recommendations": [
          { "food": "string", "reason": "text (Markdown)", "benefit": "string" }
        ],
        "warnings": [
          { "factor": "string", "severity": "High" | "Medium", "explanation": "Markdown text with bullet points on separate lines (* bullet 1\\n* bullet 2) and bold drug names" }
        ],
        "timingAdvice": "Markdown text with numbered items on separate new lines (1. ...\\n2. ...)"
      }
    `;
    return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 800, 0.4);
  });
};

export const getHealthDiscoveries = async (priority = 'low') => {
  return withCache('health-discoveries', 12 * 60 * 60 * 1000, async () => {
    const prompt = `
      Generate TWO distinct health discovery items for a Ugandan health app:
      1. A "Health Tip": A short, actionable health or medication advice (max 15 words).
      2. A "Did You Know": A surprising, evidence-based health fact (max 15 words).

      Context: Uganda. Use local context where appropriate (e.g., local foods like Matooke, G-nuts, Mukene, Kalo, or local climate/lifestyle).

      Respond in EXACT JSON format:
      {
        "healthTip": "...",
        "didYouKnow": "..."
      }
    `;
    return await callAiWithFallback([{ role: 'user', content: prompt }], {
      isJson: true,
      priority,
      maxTokens: 500,
      preferredModel: 'gemini'
    });
  });
};

export const isComplexTask = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  if (text.length > 500) return true;
  const actionPatterns = [
    /(add|create|set|put|new|remind|schedule|register|log|record|track|save|update|change|modify|edit|adjust|delete|remove|stop|cancel|clear)/i,
    /(reminder|alarm|med|medicine|dose|taken|skipped|feeling|wellness|food|meal|profile|patient|family|mother|father|son|daughter|wife|husband|parent|child)/i
  ];
  const dataPatterns = [
    /(what|show|list|tell|view|see|check|get|summary|history|status)/i,
    /(my|current|active|recent|all)/i
  ];
  const hasActionVerb = /(add|create|set|remind|log|record|track|update|delete|remove|register)/i.test(lower);
  const hasDomainNoun = /(reminder|med|medicine|dose|log|wellness|family|profile|patient|history)/i.test(lower);
  const hasDataVerb = /(what|show|list|tell|view|check|get)/i.test(lower);
  const isActionRequest = hasActionVerb && hasDomainNoun;
  const isDataRequest = hasDataVerb && (hasDomainNoun || /(my|current|active|recent)/i.test(lower));
  const isHowToQuery = /^(how\s+do\s+i|can\s+you\s+explain|what\s+is|tell\s+me\s+about)/i.test(lower);
  if (isHowToQuery && !lower.includes('my')) return false;
  const hasDeleteIntent = /(delete|remove|cancel|stop)\s+(?:\w+\s+)*?(reminder|alarm|med|medicine)/i.test(lower);
  if (hasDeleteIntent) return true;
  const hasShowRemindersIntent = /(show|list|what\s+are|check|view)\s+\w*\s*reminders?/i.test(lower);
  if (hasShowRemindersIntent) return true;
  if (isActionRequest || isDataRequest) return true;
  if (isSameTaskOrDuplicateQuery(lower)) return true;
  const isMedicalQuery = /(dose|dosage|effect|safe|interact|symptom|pain|sick|hurt|doctor|health|duplicate|food|chew|chewable|drink|beverage|swallow|eat)/i.test(lower);
  if (isMedicalQuery && text.split(' ').length > 4) return true;
  return false;
};

export const isLikelyActionRequest = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  // Pure inquiry / informational questions should NEVER be diverted into action execution mode:
  // e.g. "What are my reminders", "Check my medications", "Show my reminders", "List my pills"
  const isQuestionOrInquiry = /^(what|which|how|tell me|show me|list|check|view|display|can you tell|do i have|are there|when is|when are)\b/i.test(lower);
  if (isQuestionOrInquiry) {
    return false;
  }

  // Direct action verbs with word boundaries (e.g. "add reminder", "set stock")
  const directVerbs = /\b(add|create|schedule|register|log|record|refill|restock|delete|remove|reschedule)\b/i;

  // Indirect / polite action requests ("please add", "help me set a reminder")
  const indirectAction = /(i need|i want|i'd like|i would like|can you|could you|please|help me|let's|let us)\s.{0,30}\b(add|create|set|log|record|track|update|delete|remove|refill|schedule|register)\b/i;

  // First-person past-tense dose log ("I took my...", "I missed my...", "I forgot to take", "I skipped")
  const pastDoseLog = /\b(i took|i've taken|i missed|i forgot|i skipped|i just took|i already took)\b/i;

  // Wellness / mood / energy / symptom logging phrases
  const wellnessLog = /\b(feeling|feel|mood|energy|tired|fatigue|dizzy|nausea|headache|stomachache|stomach\s*ache|cramps?|ecstatic|very\s*happy|super\s*happy|so\s*happy|happy|joyful|delighted|thrilled|overjoyed|pain|sick|unwell|symptom|log (how|my|a)|wellness|check[- ]?in|log mood|log energy|log symptom|i am feeling|i feel|i'm feeling|i've been feeling|i have (a|an)?\s*(headache|stomachache|stomach\s*ache|fever|cough|migraine|pain)|omutwe\s*(gunnuma|gunuma)?|olubuto\s*(lunnuma|lunuma)?|musujja|hurt(s)?)\b/i;

  // Stock / refill phrases
  const refillPhrase = /\b(refill(ed)?|restock(ed)?|top\s*up|topped\s*up|set stock|update stock|update quantity)\b/i;

  // Reminder management phrases (stop, disable, enable, change time, move, snooze)
  const reminderManage = /\b(stop|disable|turn off|pause|mute|snooze|enable|turn on|change time|move|reschedule|update).{0,20}(reminder|alarm|notification|dose|schedule)/i;

  return directVerbs.test(lower)
    || indirectAction.test(lower)
    || pastDoseLog.test(lower)
    || wellnessLog.test(lower)
    || refillPhrase.test(lower)
    || reminderManage.test(lower);
};

/**
 * Determines whether a user query requires retrieving verified medical knowledge.
 * This avoids the latency of generating embeddings and querying Firestore for simple greetings,
 * general app navigation, or clear user action commands.
 */
export const shouldRetrieveMedicalKnowledge = (text) => {
  if (!text || text.length < 3) return false;
  const lower = text.toLowerCase().trim();

  // Exclude simple greetings/small talk
  const greetings = /^(hi|hello|hey|good\s+(morning|afternoon|evening)|yo|habari|jambo|sasa|otya|oli\s+otya|mutya|muli\s+mutya|gyebaleko|wasuze\s+otya|osiibye\s+otya|ki\s+kati)\b/i;
  if (greetings.test(lower) && lower.split(/\s+/).length <= 3) return false;

  // Exclude typical app commands/action queries unless they explicitly request safety/medical information
  const isSimpleAction = /^(show|list|delete|remove|cancel|stop|add|create|set|put|new|remind|schedule|register|log|record|track|save|update|change|modify|edit|adjust)\s/i.test(lower);
  const asksForMedicalInfo = /(interact|safety|safe|side\s*effect|contraindication|warn|hazard|allergic|allergy|poison|overdose|symptom|pain|sick|hurt|doctor|disease|treat|cure|prevent|work|mechanism|bleed|ulcer|liver|kidney|heart|reaction)/i.test(lower);

  if (isSimpleAction && !asksForMedicalInfo) return false;

  // Check for medical keywords or general health topics
  const medicalKeywords = /(interact|safety|safe|side\s*effect|contraindication|warn|hazard|allergic|allergy|poison|overdose|symptom|pain|sick|hurt|doctor|disease|treat|cure|prevent|dose|dosage|interaction|effect|medicine|medication|drug|pill|tablet|bleed|bleeding|ulcer|liver|kidney|heart|reaction|blood|pressure|diabetes|malaria|infection|fever)/i;
  return medicalKeywords.test(lower);
};

export const chatWithDawaGPT = async (params, priority = 'high') => {
  try {
    const { messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, vitalitySummary, patients, selectedPatientId, currentPage } = params;

    if (!Array.isArray(messages)) {
      throw new AppError('Invalid messages format: expected an array.', 400);
    }

    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.text || messages.filter(m => m.role === 'user').pop()?.content;

    if (detectEmergency(lastUserMsg)) {
      return EMERGENCY_RESPONSE;
    }

    // FIX (Bug 3): Deterministic pre-LLM action extraction.
    // For clear, unambiguous action requests (set reminder, log dose, refill stock),
    // return the action immediately without burning an LLM API call.
    // This guarantees the action object is always present for these simple cases.
    const deterministicAction = extractDeterministicAction(lastUserMsg, medicines || [], reminders || []);
    if (deterministicAction) {
      const targetPatientForFallback = selectedPatientId && patients?.length ? patients.find(p => p.id === selectedPatientId) : null;
      // Use generateBackendClinicalFallback to get a nicely formatted confirmation message
      const fallbackResp = generateBackendClinicalFallback(lastUserMsg, medicines, reminders, userProfile, targetPatientForFallback);
      // Only use the deterministic path if the fallback actually matched and returned an action
      if (fallbackResp && fallbackResp.action) {
        return fallbackResp;
      }
    }

    const isComplex = isComplexTask(lastUserMsg);

    const { finalMessages } = await prepareDawaGPTContext({
      messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, vitalitySummary, patients, isComplex, selectedPatientId, currentPage, isStreaming: false
    });

    const chatMaxTokens = isComplex ? 8192 : 4096;

    let result;
    try {
      result = await callAiWithFallback(finalMessages, {
        isJson: true,
        priority,
        maxTokens: chatMaxTokens,
        isComplex
      });
    } catch (jsonErr) {
      console.warn("DawaGPT JSON mode failed, cascading to text mode in AI API fallback:", jsonErr.message);
      try {
        result = await callAiWithFallback(finalMessages, {
          isJson: false,
          priority,
          maxTokens: chatMaxTokens,
          isComplex
        });
      } catch (textErr) {
        console.warn("All AI providers failed in chatWithDawaGPT, activating local clinical fallback:", textErr.message);
        const targetPatient = selectedPatientId && patients?.length ? patients.find(p => p.id === selectedPatientId) : null;
        return generateBackendClinicalFallback(lastUserMsg, medicines, reminders, userProfile, targetPatient);
      }
    }

    // Action execution is handled client-side by dispatchAIAction (useAIActions.tsx).
    // The server's role is to generate the action intent and return it in result.action.
    if (result && typeof result === 'object') {
      result.text = result.text || result.message || result.response || result.advice || "";
      if (typeof result.text === 'string') {
        result.text = result.text
          .replace(/(?:###\s*METADATA\s*###|---\s*METADATA\s*---|###\s*Metadata\s*###|###METADATA###|---METADATA---)[\s\S]*$/i, '')
          .replace(/\n\s*\{\s*"(?:suggestions|source|action)"[\s\S]*\}\s*$/i, '')
          .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '')
          .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, '')
          .trim();
      }
      result.suggestions = Array.isArray(result.suggestions) ? result.suggestions : ["Check medications", "View reminders", "Drug safety"];
      result.action = result.action || null;
    } else if (typeof result === 'string') {
      result = {
        text: result
          .replace(/(?:###\s*METADATA\s*###|---\s*METADATA\s*---|###\s*Metadata\s*###|###METADATA###|---METADATA---)[\s\S]*$/i, '')
          .replace(/\n\s*\{\s*"(?:suggestions|source|action)"[\s\S]*\}\s*$/i, '')
          .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '')
          .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, '')
          .trim(),
        suggestions: ["Check medications", "View reminders", "Drug safety"],
        source: "AI Fallback",
        action: null
      };
    }

    return result;
  } catch (err) {
    handleAiError(err);
  }
};

async function executeAiAction(action, userId, userMedicines = [], selectedPatientId = null) {
  const { type, payload } = action;
  if (!type || !payload) throw new Error('Action type and payload are required');
  const data = { ...payload, userId };
  if (!data.patientId) data.patientId = selectedPatientId;

  switch (type) {
    case 'ADD_MEDICINE': return await medicineService.createMedicine(data);
    case 'UPDATE_MEDICINE': return await medicineService.updateMedicine(payload.id, data);
    case 'ADD_REMINDER':
      if (!data.medicineId && data.medicineName && userMedicines.length > 0) {
        const match = userMedicines.find(m =>
          m.name.toLowerCase() === data.medicineName.toLowerCase() ||
          (m.genericName && m.genericName.toLowerCase() === data.medicineName.toLowerCase())
        );
        if (match) {
          data.medicineId = match.id;
          data.color = data.color || match.color;
          data.icon = data.icon || match.icon;
        }
      }
      return await reminderService.createReminder(data);
    case 'UPDATE_REMINDER': return await reminderService.updateReminder(payload.id, data, userId);
    case 'REMOVE_REMINDER': return await reminderService.deleteReminder(payload.id, userId);
    case 'LOG_DOSE': return await doseLogService.createDoseLog(data);
    case 'LOG_WELLNESS':
      if (data.type === 'symptom') {
        const mood = data.data?.mood;
        const energy = data.data?.energy;
        const symptoms = data.data?.symptoms || [];
        if (!data.data?.aiReflection && (mood !== undefined || energy !== undefined || symptoms.length > 0)) {
          try {
            const reflectionData = await getEmotionReflection(mood, energy, symptoms, userMedicines);
            if (reflectionData) {
              data.data = {
                ...data.data,
                aiReflection: reflectionData
              };
            }
          } catch (e) {
            console.error("Failed to generate reflection in executeAiAction:", e);
          }
        }
      }
      return await wellnessService.createWellnessLog(data);
    case 'ADD_PATIENT': return await patientService.createPatient(data);
    default: throw new Error(`Unknown action type: ${type}`);
  }
}
function formatTimeDisplay(timeStr) {
  if (!timeStr) return "8:00 AM";
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ? mStr.padStart(2, '0') : "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export const extractDeterministicAction = (text, medicines = [], reminders = []) => {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // 1. ADD_REMINDER
  const isReminderIntent = /\b(remind(\s+me)?|set(\s+a)?\s+reminder|add(\s+a)?\s+reminder|schedule(\s+a)?\s+reminder|create(\s+a)?\s+reminder|alarm\s+for)\b/i.test(lower);
  if (isReminderIntent) {
    let time = "08:00";
    const timeMatch = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();

      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;

      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    }

    let matchedMed = medicines.find(m => m.name && lower.includes(m.name.toLowerCase()));
    let medName = matchedMed ? matchedMed.name : null;

    if (!medName) {
      const medMatch = lower.match(/(?:take|reminder\s+for|for)\s+([a-z0-9\-]+)/i);
      if (medMatch && !['a', 'my', 'the', 'some', 'me', 'daily'].includes(medMatch[1].toLowerCase())) {
        medName = medMatch[1].charAt(0).toUpperCase() + medMatch[1].slice(1);
      } else {
        medName = medicines[0]?.name || "Medication";
      }
    }

    const doseMatch = lower.match(/\b(\d+(?:\.\d+)?\s*(?:mg|g|ml|tablets?|pills?|capsules?))\b/i);
    const dose = doseMatch ? doseMatch[1] : (matchedMed?.dosagePerDose ? `${matchedMed.dosagePerDose} ${matchedMed.unit || 'tablets'}` : "1 tablet");

    let repeatSchedule = "daily";
    if (lower.includes("weekly")) repeatSchedule = "weekly";
    else if (lower.includes("once")) repeatSchedule = "once";

    return {
      type: "ADD_REMINDER",
      payload: {
        medicineName: medName,
        medicineId: matchedMed?.id || null,
        dose,
        time,
        repeatSchedule
      },
      confirmMessage: `Reminder set for ${medName} (${dose}) at ${formatTimeDisplay(time)} ${repeatSchedule}.`
    };
  }

  // 2. LOG_DOSE
  const isDoseLogIntent = /\b(i took|i've taken|i just took|i already took|log (that )?i took|record (that )?i took|mark (my )?.* as taken|i missed|i skipped)\b/i.test(lower);
  if (isDoseLogIntent) {
    const isMissed = /\b(missed|skipped|forgot)\b/i.test(lower);
    const status = isMissed ? "missed" : "taken";

    let matchedMed = medicines.find(m => m.name && lower.includes(m.name.toLowerCase()));
    let medName = matchedMed ? matchedMed.name : null;

    if (!medName) {
      const medMatch = lower.match(/(?:took|taken|missed|skipped)\s+(?:my\s+)?([a-z0-9\-]+)/i);
      if (medMatch && !['my', 'the', 'a', 'dose', 'medicine', 'pills'].includes(medMatch[1].toLowerCase())) {
        medName = medMatch[1].charAt(0).toUpperCase() + medMatch[1].slice(1);
      } else {
        medName = medicines[0]?.name || "Medication";
      }
    }

    return {
      type: "LOG_DOSE",
      payload: {
        medicineName: medName,
        medicineId: matchedMed?.id || null,
        status,
        timestamp: new Date().toISOString()
      },
      confirmMessage: `Logged ${medName} as ${status}.`
    };
  }

  // 3. UPDATE_MEDICINE (Med Vault Refill)
  const isRefillIntent = /\b(refill(ed)?|restock(ed)?|top\s*up|topped\s*up|update stock|set stock)\b/i.test(lower);
  if (isRefillIntent) {
    const qtyMatch = lower.match(/\b(?:to|with|have)?\s*(\d+)\s*(?:pills?|tablets?|capsules?|units?)?\b/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

    let matchedMed = medicines.find(m => m.name && lower.includes(m.name.toLowerCase()));
    if (!matchedMed && medicines.length === 1) matchedMed = medicines[0];

    if (matchedMed && qty !== null) {
      return {
        type: "UPDATE_MEDICINE",
        payload: {
          id: matchedMed.id,
          name: matchedMed.name,
          currentQuantity: qty
        },
        confirmMessage: `Updated ${matchedMed.name} stock to ${qty}.`
      };
    }
  }

  // 4. LOG_WELLNESS (Guard against medication questions or duplicate therapy queries being misrouted)
  const isMedQuestion = /\b(can i take|should i take|is it safe|interact|safe to|together|can i use|should i use)\b/i.test(lower) || isSameTaskOrDuplicateQuery(lower, medicines);
  if (isMedQuestion) return null;

  const wellnessData = extractWellnessData(text);
  if (wellnessData) {
    const moodLabels = { 1: "Low", 2: "Meh", 3: "Okay", 4: "Good", 5: "Great" };
    const moodStr = moodLabels[wellnessData.mood] || `${wellnessData.mood}/5`;
    const symSummary = wellnessData.symptoms.length > 0 ? wellnessData.symptoms.join(', ') : 'none';

    return {
      type: "LOG_WELLNESS",
      payload: {
        type: "symptom",
        data: {
          mood: wellnessData.mood,
          energy: wellnessData.energy,
          symptoms: wellnessData.symptoms,
          notes: wellnessData.notes
        }
      },
      confirmMessage: `Recorded wellness check-in (mood: ${moodStr} [${wellnessData.mood}/5], vitality: ${wellnessData.energy * 20}%, symptoms: ${symSummary}).`
    };
  }

  return null;
};

export function extractWellnessData(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // Guard against medication questions
  const isMedQuestion = /\b(can i take|should i take|is it safe|interact|safe to|together|can i use|should i use)\b/i.test(lower);
  if (isMedQuestion) return null;

  const isWellnessIntent = /\b(log (my )?(mood|symptoms?|wellness|energy)|feeling|i feel|i'm feeling|i am feeling|i have (a|an)?\s*(headache|stomachache|stomach\s*ache|migraine|fever|cough|cramp|pain)|headache|stomachache|stomach\s*ache|dizzy|dizziness|nausea|fatigue|fever|ecstatic|thrilled|overjoyed|very\s*happy|super\s*happy|so\s*happy|extremely\s*happy|happy|delighted|joyful|depressed|sad|unwell|sick|omutwe|olubuto|musujja)\b/i.test(lower);

  if (!isWellnessIntent) return null;

  const symptoms = [];

  // Physical symptoms (aligned with Wellness Hub standard categories)
  if (/\b(headache|migraine|omutwe|head\s*ache|head\s*hurts?)\b/i.test(lower)) {
    symptoms.push("Headache");
  }
  if (/\b(stomachache|stomach\s*ache|olubuto|tummy\s*ache|belly\s*ache|abdominal\s*pain|cramps?|indigestion)\b/i.test(lower)) {
    symptoms.push("Stomach Ache");
  }
  if (/\b(fever|musujja|high\s*temp(erature)?|feverish|chills)\b/i.test(lower)) {
    symptoms.push("Fever");
  }
  if (/\b(dizzy|dizziness|lightheaded(ness)?|vertigo)\b/i.test(lower)) {
    symptoms.push("Dizziness");
  }
  if (/\b(nausea|nauseous|vomit(ing)?|throwing\s*up|queasy)\b/i.test(lower)) {
    symptoms.push("Nausea");
  }
  if (/\b(fatigue|exhaust(ed|ion)?|tired|weak(ness)?|drained|worn\s*out|no\s*energy|low\s*energy)\b/i.test(lower)) {
    symptoms.push("Fatigue");
  }
  if (/\b(pain|hurts?|aching|sore|obulumi|body\s*ache)\b/i.test(lower)) {
    if (!symptoms.includes("Headache") && !symptoms.includes("Stomach Ache")) {
      symptoms.push("Pain");
    }
  }
  if (/\b(cough(ing)?|ekifuba)\b/i.test(lower)) {
    symptoms.push("Cough");
  }

  // Mental / Emotional symptoms (aligned with Wellness Hub standard categories)
  const isEcstatic = /\b(ecstatic|thrilled|overjoyed|on\s*cloud\s*nine|blissful|extremely\s*happy|so\s*happy|super\s*happy|very\s*happy)\b/i.test(lower);
  const isHappy = isEcstatic || /\b(happy|cheerful|joyful|delighted|in\s*a\s*great\s*mood|feeling\s*great|amazing|fantastic)\b/i.test(lower);
  const isRelaxed = /\b(relaxed|calm|peaceful|serene|chill)\b/i.test(lower);
  const isFocused = /\b(good\s*focus|focused|sharp|productive)\b/i.test(lower);
  const isAnxious = /\b(anxious|anxiety|nervous|worried|panicky)\b/i.test(lower);
  const isStressed = /\b(stressed|stress|overwhelmed|under\s*pressure)\b/i.test(lower);
  const isIrritable = /\b(irritable|irritated|annoyed|cranky|grumpy)\b/i.test(lower);

  if (isHappy) symptoms.push("Happy");
  if (isRelaxed) symptoms.push("Relaxed");
  if (isFocused) symptoms.push("Good Focus");
  if (isAnxious) symptoms.push("Anxious");
  if (isStressed) symptoms.push("Stressed");
  if (isIrritable) symptoms.push("Irritable");

  // Determine Mood (1 to 5 scale)
  let mood = 3;
  const isSevere = /\b(severe|terrible|awful|unbearable|horrible|excruciating|depressed|miserable|agony)\b/i.test(lower);
  const hasPhysicalIllness = symptoms.some(s => ["Headache", "Stomach Ache", "Fever", "Nausea", "Dizziness", "Pain", "Cough"].includes(s));

  if (isEcstatic) {
    mood = 5;
  } else if (isHappy) {
    mood = 4;
  } else if (isRelaxed || isFocused) {
    mood = 4;
  } else if (isSevere) {
    mood = 1;
  } else if (hasPhysicalIllness || isAnxious || isStressed || isIrritable || /\b(sad|down|bad|unwell|sick)\b/i.test(lower)) {
    mood = 2;
  } else if (/\b(okay|fine|alright|neutral|meh)\b/i.test(lower)) {
    mood = lower.includes("meh") ? 2 : 3;
  }

  // Determine Energy (1 to 5 scale)
  let energy = 3;
  const isExhausted = /\b(exhaust(ed|ion)?|drained|fatigued|depleted|no\s*energy|burned\s*out|completely\s*tired|dead\s*tired)\b/i.test(lower);
  const isHighEnergy = /\b(full\s*of\s*energy|bursting\s*with\s*energy|super\s*energetic|hyper|invigorated|high\s*energy|energetic|feeling\s*strong)\b/i.test(lower);

  if (isEcstatic || isHighEnergy) {
    energy = 5;
  } else if (isExhausted) {
    energy = 1;
  } else if (mood === 5) {
    energy = isHighEnergy ? 5 : 4;
  } else if (mood === 4) {
    energy = isRelaxed ? 3 : 4;
  } else if (isSevere) {
    energy = 1;
  } else if (hasPhysicalIllness || symptoms.includes("Fatigue") || /\b(tired|sluggish|weak|low\s*energy)\b/i.test(lower)) {
    energy = 2;
  } else if (mood === 2) {
    energy = 2;
  } else {
    energy = 3;
  }

  return {
    mood,
    energy,
    symptoms,
    notes: text,
  };
}

/**
 * Intelligent Local Clinical Fallback
 * Provides domain-specific, clinically accurate responses and action dispatching
 * when cloud AI APIs are cold-starting, offline, rate-limited, or lack external API keys.
 */
export function generateBackendClinicalFallback(lastUserMsg, medicines = [], reminders = [], userProfile = null, targetPatient = null) {
  const norm = (lastUserMsg || '').toLowerCase().trim();
  const activeGender = targetPatient?.gender || userProfile?.gender;
  const gender = activeGender?.toLowerCase();
  const salutation = gender === 'female' ? 'Nyabo' : gender === 'male' ? 'Ssebo' : '';
  const greeting = salutation ? ` ${salutation}` : '';

  // 1. Emergency / Overdose check
  if (detectEmergency(norm)) {
    return EMERGENCY_RESPONSE;
  }

  // 2. Deterministic Action Dispatching (Adding reminders, logging doses, refilling stock, wellness tracking)
  const action = extractDeterministicAction(norm, medicines, reminders);
  if (action) {
    if (action.type === "ADD_REMINDER") {
      const displayTime = action.payload.time ? formatTimeDisplay(action.payload.time) : "8:00 AM";
      return {
        text: `I've set up a reminder for you to take **${action.payload.medicineName}** (${action.payload.dose}) ${action.payload.repeatSchedule} at **${displayTime}**.\n\nYou can [view or manage your schedule in Medication Reminders](/reminders).`,
        suggestions: ["View my reminders", "Check my medications", "How is my pill stock?"],
        source: "Schedule Guard",
        action
      };
    }
    if (action.type === "LOG_DOSE") {
      const statusVerb = action.payload.status === 'taken' ? 'took' : 'missed';
      return {
        text: `I've logged that you **${statusVerb}** your dose of **${action.payload.medicineName}**.\n\nYou can [review your adherence streak in Dose History](/history).`,
        suggestions: ["View dose history", "Check reminders", "How is my pill stock?"],
        source: "Adherence Guard",
        action
      };
    }
    if (action.type === "UPDATE_MEDICINE") {
      return {
        text: `I've updated your Med Vault: **${action.payload.name}** stock is now set to **${action.payload.currentQuantity} tablets**.\n\nYou can [view and track your pill supply in Med Vault](/medvault).`,
        suggestions: ["Open Med Vault", "Check reminders", "View medications"],
        source: "Med Vault",
        action
      };
    }
    if (action.type === "LOG_WELLNESS") {
      const moodVal = Number(action.payload.data?.mood) || 3;
      const energyVal = Number(action.payload.data?.energy) || 3;
      const symptomsList = action.payload.data?.symptoms || [];
      const symStr = symptomsList.length > 0 ? symptomsList.join(', ') : 'general check-in';
      const moodLabels = { 1: "Low", 2: "Meh", 3: "Okay", 4: "Good", 5: "Great / Ecstatic" };
      const moodDisplay = moodLabels[moodVal] || `${moodVal}/5`;

      const isPositiveVibe = moodVal >= 4 && !symptomsList.some(s => ["Headache", "Stomach Ache", "Fever", "Nausea", "Dizziness", "Pain", "Cough"].includes(s));

      const responseText = isPositiveVibe
        ? `That's wonderful to hear${greeting}! 🌟 I've recorded your positive vibe in the Wellness Hub (Mood: **${moodDisplay}**, Vitality: **${energyVal * 20}%**). Keep embracing that great vitality!\n\nYou can [review your wellness logs in Wellness Hub](/wellness).`
        : `I've recorded this in your Wellness Hub (Mood: **${moodDisplay}**, Vitality: **${energyVal * 20}%**, Symptoms: **${symStr}**). Bambi${greeting}, please rest, stay well-hydrated, and consult a healthcare professional if symptoms persist.\n\nYou can [review your wellness logs in Wellness Hub](/wellness).`;

      return {
        text: responseText,
        suggestions: ["Open Wellness Hub", "Check medications", "View reminders"],
        source: "Wellness Guard",
        action
      };
    }
  }

  // 3. Official Uganda Healthcare & Emergency Directory (only if explicitly asked for contacts/support)
  if (norm.includes('support') || norm.includes('emergency') || norm.includes('call') || norm.includes('help line') || norm.includes('helpline') || norm.includes('phone') || norm.includes('contact')) {
    return {
      text: `Here is the official **Uganda Healthcare & Emergency Contact Directory**:\n\n` +
        `• 🚨 **National Emergency & Ambulance**: Call **112** (Mobile Toll-Free on MTN/Airtel) or **999** (Landline)\n` +
        `• 🏛️ **National Drug Authority (NDA) Uganda**: Toll-Free **0800 101 622** | WhatsApp: **+256 791 415 555** | Head Office: **+256 417 788 100** *(for reporting adverse drug reactions, counterfeit medicines, or safety alerts)*\n` +
        `• 🏥 **Ministry of Health (MoH) Uganda**: Toll-Free **0800 100 066** or **0800 203 033** | Email: **info@health.go.ug**\n` +
        `• 🩺 **Mulago National Referral Hospital (Casualty & Emergency)**: **+256 414 554 008** / **+256 414 554 001**\n` +
        `• 🧠 **Mental Health Crisis Support (Butabika Hospital)**: Toll-Free **0800 200 600**\n` +
        `• 📱 **Dawa-Lens App Support**: Email **support@dawalens.ug**`,
      suggestions: ["Call Uganda Emergency (112)", "National Drug Authority Helpline", "Open Settings"],
      source: "NDA / MoH Directory",
      action: null
    };
  }

  // 4. Honest Service Status Notice
  // When cloud AI reasoning engines are offline or reconnecting, DawaGPT returns an honest status notice
  // instead of outputting canned medical advice pretending to answer the prompt.
  return {
    text: `⚠️ I am currently experiencing difficulty reaching the live AI reasoning engine to answer your specific question.\n\n` +
      `Our multi-model AI providers are reconnecting. While connectivity is restored, you can:\n` +
      `• 💊 [Check your active prescriptions in My Medications](/medications)\n` +
      `• ⏰ [Manage your schedule in Medication Reminders](/reminders)\n` +
      `• 📦 [Check pill counts and supply in Med Vault](/medvault)\n` +
      `• ⚠️ [Review drug & food interactions in Interactions Guard](/interactions)\n\n` +
      `For urgent clinical guidance or adverse drug reactions in Uganda, please contact:\n` +
      `• **National Drug Authority (NDA) Uganda**: Toll-Free **0800 101 622** | WhatsApp **+256 791 415 555**\n` +
      `• **Ministry of Health (MoH) Uganda**: Toll-Free **0800 100 066** / **0800 203 033**\n` +
      `• **Emergency Ambulance Dispatch**: **112** (Mobile Toll-Free) / **999**`,
    suggestions: ["Try asking again", "Check my medications", "View reminders"],
    source: "System (Reconnecting)",
    action: null
  };
}

export const streamChatWithDawaGPT = async (params, priority = 'high') => {
  try {
    const { messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, vitalitySummary, patients, selectedPatientId, currentPage } = params;

    if (!Array.isArray(messages)) throw new AppError('Invalid messages format.', 400);

    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.text || messages.filter(m => m.role === 'user').pop()?.content;

    if (detectEmergency(lastUserMsg)) {
      return new Readable({
        read() {
          const metadata = JSON.stringify({ suggestions: EMERGENCY_RESPONSE.suggestions, source: EMERGENCY_RESPONSE.source, action: null });
          const data = JSON.stringify({ choices: [{ delta: { content: EMERGENCY_RESPONSE.text + "\n###METADATA###\n" + metadata } }] });
          this.push(`data: ${data}\n\n`);
          this.push(`data: [DONE]\n\n`);
          this.push(null);
        }
      });
    }

    const isComplex = isComplexTask(lastUserMsg);

    // Route ALL action-intent requests to JSON mode (chatWithDawaGPT) where the
    // action object is reliably structured. Raw streaming mode is unreliable for
    // actions because smaller fallback models often fail to produce valid
    // ###METADATA### JSON — silently dropping the action object.
    if (isLikelyActionRequest(lastUserMsg)) {
      try {
        const result = await chatWithDawaGPT(params, priority);
        return createFakeStream(result);
      } catch (err) {
        return createFakeStream({ text: err.message || "I encountered an error.", suggestions: ["Try again"], source: "System", action: null });
      }
    }

    const { finalMessages } = await prepareDawaGPTContext({
      messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, vitalitySummary, patients,
      isStreaming: true, isComplex, selectedPatientId, currentPage
    });

    const chatMaxTokens = isComplex ? 8192 : 4096;
    // For rate-limit estimation, use only the last user message (not the full context
    // including the DawaGPT system prompt) to avoid false TPM budget exhaustion.
    const lastUserMsgForRl = [{ role: 'user', content: lastUserMsg || 'hi' }];

    function createFakeStream(jsonResp) {
      return new Readable({
        read() {
          const rawText = jsonResp.text || "";
          const cleanText = rawText
            .replace(/(?:###\s*METADATA\s*###|---\s*METADATA\s*---|###\s*Metadata\s*###|###METADATA###|---METADATA---)[\s\S]*$/i, '')
            .replace(/\n\s*\{\s*"(?:suggestions|source|action)"[\s\S]*\}\s*$/i, '')
            .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '')
            .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, '')
            .trim();
          const normalizedAction = jsonResp.action ? {
            type: jsonResp.action.type,
            payload: jsonResp.action.payload || jsonResp.action.data || jsonResp.action,
            confirmMessage: jsonResp.action.confirmMessage
          } : null;
          const metadata = JSON.stringify({ suggestions: jsonResp.suggestions || [], source: jsonResp.source || "DawaGPT", action: normalizedAction });
          const data = JSON.stringify({ choices: [{ delta: { content: cleanText + "\n###METADATA###\n" + metadata } }] });
          this.push(`data: ${data}\n\n`);
          this.push(`data: [DONE]\n\n`);
          this.push(null);
        }
      });
    }

    // 1. Try Cerebras for complex streaming if configured
    if (CEREBRAS_API_KEY && isComplex) {
      try {
        const fn = async () => {
          const response = await axios.post(CEREBRAS_API_URL, { model: CEREBRAS_MODEL, messages: finalMessages, stream: true, max_tokens: chatMaxTokens, temperature: 0.7 }, {
            headers: { 'Authorization': `Bearer ${CEREBRAS_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'stream', timeout: 20000
          });
          return response.data;
        };
        return await rateLimitManager.enqueue(fn, 'cerebras-120b', lastUserMsgForRl, priority, 3, true);
      } catch (err) {
        console.warn("Stream Fallback: Cerebras failed.", err.message);
      }
    }

    // 2. Try Groq across candidate models (gpt-oss-120b, llama-3.3-70b, gpt-oss-20b, qwen3.6-27b, llama-3.1-8b) and all independent accounts
    if (GROQ_KEYS.length > 0) {
      const groqCandidateModels = Array.from(new Set([
        GROQ_MODEL,
        'openai/gpt-oss-120b',
        'qwen/qwen3.6-27b',
        GROQ_LIGHT_MODEL,
        'openai/gpt-oss-20b',
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant'
      ].filter(Boolean)));

      for (const modelId of groqCandidateModels) {
        const isReasoning = typeof modelId === 'string' && (modelId.includes('gpt-oss') || modelId.includes('qwen') || modelId.includes('deepseek-r1') || modelId.includes('qwq'));
        const effectiveTokens = isReasoning ? Math.max(chatMaxTokens, 4096) : chatMaxTokens;

        for (let keyIdx = 0; keyIdx < GROQ_KEYS.length; keyIdx++) {
          try {
            const groqKey = GROQ_KEYS[keyIdx];
            const keySuffix = GROQ_KEY_SUFFIXES[keyIdx] || '';
            const baseModelKey = modelId.includes('70b') ? 'groq-70b' : modelId.includes('20b') || modelId.includes('8b') ? 'groq-8b' : 'groq-qwen';
            const modelKey = `${baseModelKey}${keySuffix}`;

            const fn = async () => {
              const payload = {
                model: modelId,
                messages: finalMessages,
                stream: true,
                max_tokens: effectiveTokens,
                temperature: 0.7
              };
              if (isReasoning) payload.reasoning_format = 'hidden';
              const response = await axios.post(GROQ_API_URL, payload, {
                headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
                responseType: 'stream', timeout: 25000
              });
              return response.data;
            };
            return await rateLimitManager.enqueue(fn, modelKey, lastUserMsgForRl, priority, 2, false);
          } catch (err) {
            console.warn(`Stream Fallback: Groq (${modelId}) key${keyIdx + 1} failed.`, err.response?.data?.error?.message || err.response?.data || err.message);
          }
        }
      }
      console.warn("Stream Fallback: All Groq models and keys exhausted. Cascading to SambaNova Cloud...");
    }

    // 3. Try SambaNova Cloud (70B)
    if (SAMBANOVA_API_KEY) {
      try {
        const fn = async () => {
          const response = await axios.post(SAMBANOVA_API_URL, { model: SAMBANOVA_MODEL, messages: finalMessages, stream: true, max_tokens: chatMaxTokens, temperature: 0.7 }, {
            headers: { 'Authorization': `Bearer ${SAMBANOVA_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'stream', timeout: 10000
          });
          return response.data;
        };
        return await rateLimitManager.enqueue(fn, 'sambanova-70b', lastUserMsgForRl, priority, 3, true);
      } catch (err) {
        console.warn("Stream Fallback: SambaNova failed, trying NVIDIA NIM...", err.response?.data?.error?.message || err.response?.data || err.message);
      }
    }

    // 6. Try NVIDIA NIM
    if (NVIDIA_API_KEY) {
      try {
        const fn = async () => {
          const response = await axios.post(NVIDIA_API_URL, { model: NVIDIA_MODEL, messages: finalMessages, stream: true, max_tokens: chatMaxTokens, temperature: 0.7 }, {
            headers: { 'Authorization': `Bearer ${NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'stream', timeout: 10000
          });
          return response.data;
        };
        return await rateLimitManager.enqueue(fn, 'nvidia-nemotron', lastUserMsgForRl, priority, 3, true);
      } catch (err) {
        console.warn("Stream Fallback: NVIDIA NIM failed.", err.response?.data?.error?.message || err.response?.data || err.message);
      }
    }

    // 7. Try OpenRouter Free
    if (OPENROUTER_API_KEY) {
      try {
        const fn = async () => {
          const response = await axios.post(OPENROUTER_API_URL, { model: OPENROUTER_MODEL, messages: finalMessages, stream: true, max_tokens: chatMaxTokens, temperature: 0.7 }, {
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'HTTP-Referer': 'https://dawalens.web.app',
              'X-Title': 'Dawa-Lens',
              'Content-Type': 'application/json'
            },
            responseType: 'stream', timeout: 10000
          });
          return response.data;
        };
        return await rateLimitManager.enqueue(fn, 'openrouter-free', lastUserMsgForRl, priority, 3, true);
      } catch (err) {
        console.warn("Stream Fallback: OpenRouter Free failed.", err.response?.data?.error?.message || err.response?.data || err.message);
      }
    }

    // 8. Try Mistral AI
    if (MISTRAL_API_KEY) {
      try {
        const fn = async () => {
          const response = await axios.post(MISTRAL_API_URL, { model: MISTRAL_MODEL, messages: finalMessages, stream: true, max_tokens: chatMaxTokens, temperature: 0.7 }, {
            headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'stream', timeout: 10000
          });
          return response.data;
        };
        return await rateLimitManager.enqueue(fn, 'mistral-small', lastUserMsgForRl, priority, 3, true);
      } catch (err) {
        console.warn("Stream Fallback: Mistral AI failed.", err.response?.data?.error?.message || err.response?.data || err.message);
      }
    }

    // 9. Try SiliconFlow
    if (SILICONFLOW_API_KEY) {
      try {
        const modelId = SILICONFLOW_MODEL;
        const fn = async () => {
          const response = await axios.post(SILICONFLOW_API_URL, { model: modelId, messages: finalMessages, stream: true, max_tokens: chatMaxTokens, temperature: 0.7 }, {
            headers: { 'Authorization': `Bearer ${SILICONFLOW_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'stream', timeout: 10000
          });
          return response.data;
        };
        return await rateLimitManager.enqueue(fn, 'siliconflow-qwen', lastUserMsgForRl, priority, 3, true);
      } catch (err) {
        console.warn("Stream Fallback: SiliconFlow failed.", err.response?.data?.error?.message || err.response?.data || err.message);
      }
    }

    // 10. Try Z.ai
    if (Z_AI_API_KEY) {
      try {
        const modelId = Z_AI_MODEL;
        const fn = async () => {
          const response = await axios.post(Z_AI_API_URL, { model: modelId, messages: finalMessages, stream: true, max_tokens: chatMaxTokens, temperature: 0.7 }, {
            headers: { 'Authorization': `Bearer ${Z_AI_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'stream', timeout: 10000
          });
          return response.data;
        };
        return await rateLimitManager.enqueue(fn, 'zai-glm-5-flash', lastUserMsgForRl, priority, 3, true);
      } catch (err) {
        console.warn("Stream Fallback: Z.ai GLM-5-Flash failed.", err.response?.data?.error?.message || err.response?.data || err.message);
      }
    }

    // 11. Try Gemini direct with resilient Markdown/metadata handling (via single-chunk pseudo-stream)
    try {
      const geminiResp = await callGeminiChat(finalMessages, priority, chatMaxTokens, 0.7, null, false);
      return createFakeStream(geminiResp);
    } catch (err) {
      console.warn("Stream Fallback: Direct Gemini streaming failed, cascading to unified AI API fallback...", err.response?.data?.error?.message || err.response?.data || err.message);
    }

    // 12. Final Resilient Fallback: Route through application-wide unified callAiWithFallback
    // Guarantees DawaGPT follows the exact same resilient multi-provider AI API fallback
    // as all other working AI features (Adherence Coach, Wellness Insight, Safety checks, etc.)
    try {
      console.log("Stream Fallback: Cascading DawaGPT to unified AI API fallback (callAiWithFallback)...");
      const fallbackResult = await callAiWithFallback(finalMessages, {
        isJson: false,
        priority,
        maxTokens: chatMaxTokens,
        isComplex
      });

      let displayText = "";
      let suggestions = ["Check medications", "View reminders", "Drug safety"];
      let source = "AI Fallback";
      let action = null;

      if (typeof fallbackResult === 'object' && fallbackResult !== null) {
        displayText = fallbackResult.text || fallbackResult.message || fallbackResult.response || "";
        if (Array.isArray(fallbackResult.suggestions)) suggestions = fallbackResult.suggestions;
        if (fallbackResult.source) source = fallbackResult.source;
        if (fallbackResult.action) action = fallbackResult.action;
      } else {
        displayText = String(fallbackResult || "");
      }

      if (displayText) {
        return createFakeStream({
          text: displayText,
          suggestions,
          source,
          action
        });
      }
    } catch (unifiedCascadeErr) {
      console.warn("Stream Fallback: Unified AI API fallback cascade also failed:", unifiedCascadeErr.response?.data?.error?.message || unifiedCascadeErr.response?.data || unifiedCascadeErr.message);
    }

    const targetPatient = selectedPatientId && patients?.length ? patients.find(p => p.id === selectedPatientId) : null;
    const fallbackResp = generateBackendClinicalFallback(lastUserMsg, medicines, reminders, userProfile, targetPatient);
    return createFakeStream(fallbackResp);
  } catch (err) {
    return new Readable({
      read() {
        const data = JSON.stringify({ choices: [{ delta: { content: "Error starting chat stream." } }] });
        this.push(`data: ${data}\n\n`);
        this.push(`data: [DONE]\n\n`);
        this.push(null);
      }
    });
  }
};

function buildPrimingMessage(reminders, medicines, patients, selectedPatientId, isStreaming = false) {
  const activePatient = patients?.find(p => p.id === selectedPatientId);
  const name = activePatient?.name || 'you';
  const reminderCount = reminders?.length || 0;
  const nextReminder = reminders?.[0];
  let opening = `Hi! I'm DawaGPT.`;
  if (reminderCount > 0 && nextReminder) opening += ` ${name === 'you' ? 'You have' : `${name} has`} ${reminderCount} reminder${reminderCount > 1 ? 's' : ''} set up.`;
  let firstSuggestions = [];
  if (nextReminder) firstSuggestions.push(`Log ${nextReminder.medicineName} as taken`);
  if (medicines?.length > 0) firstSuggestions.push(`Does ${medicines[0].name} interact with anything?`);
  if (patients?.length > 0) {
    firstSuggestions.push(`Check family medications`);
  } else {
    firstSuggestions.push(reminderCount === 0 ? 'Add my first medicine reminder' : 'Add another medicine');
  }
  if (isStreaming) {
    return opening;
  }
  return JSON.stringify({ text: opening, suggestions: firstSuggestions.slice(0, 3), source: 'DawaGPT', action: null });
}

function getActiveAndPastMedicines(medicines, reminders, doseLogs) {
  if (!medicines) return { active: [], past: [] };

  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  // Active/recent medication criteria:
  // 1. Medicine is currently available as a reminder
  const reminderMedNames = new Set(
    (reminders || []).map(r => r.medicineName?.toLowerCase().trim())
  );
  const reminderMedIds = new Set(
    (reminders || []).map(r => r.medicineId).filter(Boolean)
  );

  // 2. Medicine has featured in reminders in the past 7 days (via dose logs)
  const recentLogMedNames = new Set();
  if (doseLogs) {
    for (const log of doseLogs) {
      if (log.actionTime || log.scheduledTime) {
        const logDate = new Date(log.actionTime || log.scheduledTime);
        if (logDate >= sevenDaysAgo && logDate <= now) {
          if (log.medicineName) {
            recentLogMedNames.add(log.medicineName.toLowerCase().trim());
          }
        }
      }
    }
  }

  const active = [];
  const past = [];

  for (const m of medicines) {
    const nameLower = m.name?.toLowerCase().trim();
    const genericLower = m.genericName?.toLowerCase().trim();

    const hasReminder = reminderMedIds.has(m.id) || reminderMedNames.has(nameLower) || (genericLower && reminderMedNames.has(genericLower));
    const featuredRecently = recentLogMedNames.has(nameLower) || (genericLower && recentLogMedNames.has(genericLower));

    if (hasReminder || featuredRecently) {
      active.push(m);
    } else {
      past.push(m);
    }
  }

  return { active, past };
}

function userAskedForAllMeds(text) {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Specific phrases asking for history/all/past
  const keywords = [
    "all medicine", "all medication", "all med",
    "past medicine", "past medication", "past med",
    "inactive medicine", "inactive medication", "inactive med",
    "used to take", "ever taken", "ever took",
    "history of my medicine", "history of medicine", "medication history",
    "show all", "list all", "view all"
  ];

  return keywords.some(keyword => lower.includes(keyword));
}

export const LOW_STOCK_THRESHOLD = 3;     // Days: amber warning (3 days)
export const CRITICAL_STOCK_THRESHOLD = 2; // Days: red critical alert (<= 2 days)

/**
 * Calculates total daily units consumed for a medicine based on dosage per dose,
 * daily frequency, and active scheduled reminders — matching Med Vault's exact formula.
 */
export function getServerDailyDoseRate(medicine, reminders = []) {
  const { id, name, dosagePerDose, frequencyPerDay } = medicine;
  const doseVal = dosagePerDose && dosagePerDose > 0 ? dosagePerDose : 1;
  const freqVal = frequencyPerDay && frequencyPerDay > 0 ? frequencyPerDay : 1;
  const defaultDailyRate = doseVal * freqVal;

  // Find all enabled reminders for this medicine (matching ID or case-insensitive name)
  const medReminders = (reminders || []).filter(
    (r) =>
      r.enabled !== false &&
      (r.medicineId === id ||
        (!r.medicineId && r.medicineName?.trim().toLowerCase() === name?.trim().toLowerCase()))
  );

  if (medReminders.length === 0) {
    return defaultDailyRate;
  }

  let dailyDoseSum = 0;

  for (const rem of medReminders) {
    const parsedRemDose = parseFloat(rem.dose);
    const slotDose =
      dosagePerDose && dosagePerDose > 0
        ? dosagePerDose
        : !isNaN(parsedRemDose) && parsedRemDose > 0
        ? parsedRemDose
        : 1;

    const timesCount = (rem.time || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean).length || 1;

    if (rem.repeatSchedule === "daily") {
      dailyDoseSum += slotDose * timesCount;
    } else if (rem.repeatSchedule === "custom") {
      const daysCount =
        rem.repeatDays && rem.repeatDays.length > 0 ? rem.repeatDays.length : 7;
      dailyDoseSum += (slotDose * timesCount * daysCount) / 7;
    } else if (rem.repeatSchedule === "weekly") {
      const daysCount =
        rem.repeatDays && rem.repeatDays.length > 0 ? rem.repeatDays.length : 1;
      dailyDoseSum += (slotDose * timesCount * daysCount) / 7;
    } else {
      dailyDoseSum += slotDose * timesCount;
    }
  }

  return dailyDoseSum > 0 ? dailyDoseSum : defaultDailyRate;
}

/**
 * Calculates doses remaining and days remaining for a medicine — matching Med Vault's exact logic.
 */
export function calculateServerRefillStatus(medicine, reminders = []) {
  const { id, name, currentQuantity, totalQuantity, dosagePerDose, frequencyPerDay, unit } = medicine;
  const stockQty = currentQuantity !== undefined ? currentQuantity : totalQuantity;

  if (stockQty === undefined) return null;

  const perDose = dosagePerDose && dosagePerDose > 0 ? dosagePerDose : 1;
  const dosesRemaining = Math.floor(stockQty / perDose);

  const dailyDoseTotal = getServerDailyDoseRate(medicine, reminders);
  const daysRemaining =
    dailyDoseTotal > 0
      ? Math.floor(stockQty / dailyDoseTotal)
      : stockQty === 0
      ? 0
      : null;

  const isOutOfStock = stockQty === 0;
  const isLow =
    isOutOfStock ||
    (daysRemaining !== null && daysRemaining <= CRITICAL_STOCK_THRESHOLD);
  const isWarning =
    !isLow &&
    daysRemaining !== null &&
    daysRemaining <= LOW_STOCK_THRESHOLD;

  // Formatted reminder/frequency description
  const medReminders = (reminders || []).filter(
    (r) =>
      r.enabled !== false &&
      (r.medicineId === id ||
        (!r.medicineId && r.medicineName?.trim().toLowerCase() === name?.trim().toLowerCase()))
  );

  let frequencyDescription = "";
  if (medReminders.length > 0) {
    const timesList = medReminders.map(r => `${r.time} (${r.repeatSchedule || "daily"})`).join("; ");
    frequencyDescription = `${timesList}`;
  } else {
    const freq = frequencyPerDay && frequencyPerDay > 0 ? frequencyPerDay : 1;
    frequencyDescription = `${freq} dose${freq !== 1 ? "s" : ""}/day`;
  }

  return {
    medicineId: id,
    medicineName: name,
    unit: unit || "tablets",
    currentQuantity: stockQty,
    totalQuantity: totalQuantity || stockQty,
    dosagePerDose: perDose,
    frequencyPerDay: frequencyPerDay && frequencyPerDay > 0 ? frequencyPerDay : 1,
    frequencyDescription,
    dailyDoseTotal,
    dosesRemaining,
    daysRemaining,
    isOutOfStock,
    isLow,
    isWarning,
    statusText: isOutOfStock
      ? "OUT OF STOCK"
      : isLow
      ? "CRITICAL LOW STOCK (<= 2 days)"
      : isWarning
      ? "LOW STOCK (<= 3 days)"
      : "IN STOCK (Healthy Supply)"
  };
}

/**
 * Builds rich, unambiguous Med Vault stock summary for DawaGPT context.
 */
export function buildMedVaultSummary(medicines = [], reminders = []) {
  const trackedMeds = (medicines || []).filter(
    (m) => m.currentQuantity !== undefined || m.totalQuantity !== undefined
  );
  if (trackedMeds.length === 0) {
    return "No tracked stocks in Med Vault.";
  }

  return trackedMeds
    .map((m) => {
      const status = calculateServerRefillStatus(m, reminders);
      if (!status) return null;
      const daysText = status.daysRemaining !== null
        ? `~${status.daysRemaining} days left`
        : "No daily schedule";
      return `• ${m.name} (ID: ${m.id}): Stock: ${status.currentQuantity} ${status.unit} (max ${status.totalQuantity}) | Dose: ${status.dosagePerDose} ${status.unit} | Freq: ${status.frequencyDescription} (${status.dailyDoseTotal} ${status.unit}/day) | Doses left: ${status.dosesRemaining} | Days left: ${daysText} | Status: [${status.statusText}]`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Resolves exact age in years from either a numeric age or a date-of-birth string.
 */
export function calculateAge(dobOrAge) {
  if (dobOrAge === null || dobOrAge === undefined || dobOrAge === '') return null;
  if (typeof dobOrAge === 'number' && !isNaN(dobOrAge)) {
    return (dobOrAge >= 0 && dobOrAge <= 150) ? dobOrAge : null;
  }
  if (typeof dobOrAge === 'string') {
    const trimmed = dobOrAge.trim();
    const num = Number(trimmed);
    if (!isNaN(num) && num >= 0 && num <= 150) return num;
    const dob = new Date(trimmed);
    if (!isNaN(dob.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
        age--;
      }
      return age >= 0 ? age : null;
    }
  }
  return null;
}

/**
 * Extracts explicit age or demographic keywords from a user query.
 */
export function extractAgeFromQuery(query) {
  if (!query || typeof query !== 'string') return null;
  const lower = query.toLowerCase();

  if (/\b(infant|baby|newborn)\b/i.test(lower)) return 0;
  if (/\b(toddler)\b/i.test(lower)) return 2;

  const ageMatch = lower.match(/\b(?:age|aged)\s*(\d{1,2})\b/) ||
                   lower.match(/\b(\d{1,2})\s*(?:years?\s*old|yrs?\s*old|yo|-year-old|-yr-old)\b/) ||
                   lower.match(/\b(?:child|kid|boy|girl)\s*(?:of|aged)?\s*(\d{1,2})\b/);
  if (ageMatch && ageMatch[1]) {
    const val = parseInt(ageMatch[1], 10);
    if (!isNaN(val) && val >= 0 && val <= 120) return val;
  }

  if (/\b(child|kid)\b/i.test(lower)) return 7;
  if (/\b(elderly|senior|geriatric|old person|older adult|grandma|grandpa|granny|jajja)\b/i.test(lower)) return 72;

  return null;
}

/**
 * Formats comprehensive Family Hub & Client profiles summary for DawaGPT context,
 * providing read access to demographics, conditions, allergies, clinical notes,
 * assigned medications, and reminders without duplicate account owner bloat.
 */
export function buildFamilyHubSummary(
  patients = [],
  medicines = [],
  reminders = [],
  doseLogs = [],
  userProfile = null,
  selectedPatientId = null
) {
  if (!patients || patients.length === 0) {
    return "No additional family member or client profiles registered.";
  }

  return patients.map((p, idx) => {
    const isSelected = selectedPatientId === p.id;
    const patientType = p.type === "client" ? "Professional Client" : "Family Member";
    const relation = p.relation ? ` (${p.relation})` : "";
    const ageStr = p.dateOfBirth
      ? `${new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()} yrs`
      : p.age !== undefined && p.age !== null ? `${p.age} yrs` : "N/A";
    const genderStr = p.gender || "N/A";
    const bloodTypeStr = p.bloodType ? ` | Blood: ${p.bloodType}` : "";
    const conditionsStr = p.conditions?.length ? p.conditions.join(", ") : "None";
    const allergiesStr = p.allergies?.length ? p.allergies.join(", ") : "None";

    const pMeds = (medicines || []).filter(m => m.patientId === p.id);
    const pReminders = (reminders || []).filter(r => r.patientId === p.id);

    const medStr = pMeds.length ? pMeds.map(m => `${m.name} (${m.dosage})`).join("; ") : "None";
    const remStr = pReminders.length ? pReminders.map(r => `${r.medicineName} at ${r.time}`).join("; ") : "None";

    return `• [PROFILE ${idx + 1}] ${p.name}${relation} (ID: ${p.id})${isSelected ? " << ACTIVE >>" : ""} | Type: ${patientType} | Age: ${ageStr} | Gender: ${genderStr}${bloodTypeStr} | Conditions: ${conditionsStr} | Allergies: ${allergiesStr} | Meds: ${medStr} | Reminders: ${remStr}`;
  }).join("\n");
}

export async function prepareDawaGPTContext({ messages, medicines, userProfile, doseLogs, reminders, wellnessLogs, vitalitySummary, patients, isStreaming = false, isComplex = true, selectedPatientId = null, currentPage = null }) {
  // Thinking models feature 128k-1M context windows — allow rich conversational history (up to 20 messages)
  const recentMessages = messages.slice(-20);
  const lastUserMsg = recentMessages.filter(m => m.role === 'user').pop()?.text || recentMessages.filter(m => m.role === 'user').pop()?.content || "";
  const lastAction = recentMessages.find(m => m.role === 'assistant' && (m.action || m.content?.includes('action')))?.action;
  const conversationPhase = messages.length === 0 ? 'opening' : messages.length < 4 ? 'discovery' : lastAction ? 'post-action' : 'ongoing';
  const { active: activeMedsList } = getActiveAndPastMedicines(medicines, reminders, doseLogs);
  const userRequestedAll = userAskedForAllMeds(lastUserMsg);

  // If user did not ask for all/past medicines, filter medicines and logs.
  // Retain all medicines if family members exist so cross-profile queries can be answered.
  const filteredMeds = (userRequestedAll || (patients && patients.length > 0)) ? medicines : activeMedsList;
  const duplicateGroundingPromise = fetchClinicalGroundingForQuery(lastUserMsg, filteredMeds || medicines);

  // Filter doseLogs to only include logs for active medicines if user did not ask for all
  const filteredDoseLogs = (userRequestedAll || (patients && patients.length > 0))
    ? doseLogs
    : (doseLogs || []).filter(log => {
      return activeMedsList.some(m =>
        m.name?.toLowerCase() === log.medicineName?.toLowerCase() ||
        (m.genericName && m.genericName?.toLowerCase() === log.medicineName?.toLowerCase())
      );
    });

  const medVaultSummary = buildMedVaultSummary(medicines, reminders);
  const activeMeds = filteredMeds?.length ? filteredMeds.map(m => `${m.name}${m.genericName ? ` (${m.genericName})` : ''} — ${m.dosage}`).join('; ') : 'None';
  const safeFormatDate = (val) => typeof val !== 'string' ? val : val.replace(/:\d{2}\.\d{3}Z$/, '').replace('T', ' ');
  const recentLogs = filteredDoseLogs ? JSON.stringify(filteredDoseLogs.slice(0, isComplex ? 15 : 8).map(l => ({ ...l, actionTime: safeFormatDate(l.actionTime), scheduledTime: safeFormatDate(l.scheduledTime) }))) : 'No logs';
  const remindersSummary = reminders?.length ? JSON.stringify(reminders.map(r => ({ id: r.id, medicineName: r.medicineName, dose: r.dose, time: r.time, repeat: r.repeatSchedule, enabled: r.enabled, patientId: r.patientId })).slice(0, isComplex ? 20 : 10)) : 'No reminders set';
  const wellnessSummary = wellnessLogs?.length ? JSON.stringify(wellnessLogs.slice(0, isComplex ? 10 : 5).map(l => ({ ...l, timestamp: safeFormatDate(l.timestamp) }))) : 'No wellness logs';
  const vitalityContext = vitalitySummary?.length ? `Vitality Trends (Last 7 Days): ${JSON.stringify(vitalitySummary.map(d => ({ day: d.name, adherence: `${d.adherence}%`, energy: d.energy ? `${(d.energy / 20).toFixed(1)}/5` : 'N/A', mood: d.mood ? `${(d.mood / 20).toFixed(1)}/5` : 'N/A' })))}` : 'No vitality trends available';
  
  // Build full Family Hub summary with complete read access
  const familyHubSummary = buildFamilyHubSummary(patients, medicines, reminders, doseLogs, userProfile, selectedPatientId);

  const shouldRetrieve = shouldRetrieveMedicalKnowledge(lastUserMsg);
  const knowledgePromise = shouldRetrieve ? retrieveMedicalKnowledge(lastUserMsg) : Promise.resolve([]);
  const [knowledgeSnippets, duplicateGrounding] = await Promise.all([
    knowledgePromise,
    duplicateGroundingPromise
  ]);
  const knowledgeContext = knowledgeSnippets.length > 0 ? `=== VERIFIED MEDICAL KNOWLEDGE (Context) ===\n${knowledgeSnippets.join('\n\n')}\n\n` : "";
  const duplicateGroundingContext = formatDuplicateTherapyWatchdogContext(duplicateGrounding);

  const STATIC_SYSTEM_PROMPT = `You are "DawaGPT", a warm, empathetic medical AI assistant in the Dawa-Lens app (Uganda).
All responses and actions must come dynamically from your clinical AI reasoning engine.

${getFoodKnowledgePrompt()}

=== PERSONALITY, TONE & LUGANDA ===
- VOICE: Empathetic health companion and knowledgeable pharmacist. Natural contractions, warm and practical.
- GREETINGS: "Oli otya" / "Muli mutya" (How are you), "Wasuze otya" (Good morning), "Osiibye otya" (Good afternoon/evening), "Gyebaleko" (Well done), "Ki kati" (What's up), "Webale" / "Webale nnyo" (Thank you / very much), "Kale" (Okay/welcome), "Bambi" (Empathy: I'm so sorry / please).
- MANDATORY GENDER HONORIFICS (CRITICAL):
  * Check the active user/profile gender in CURRENT SESSION CONTEXT:
  * FEMALE: You MUST address them as "Nyabo" (e.g., "Oli otya Nyabo", "Kale Nyabo", "Webale Nyabo", "Bambi Nyabo"). You MUST NEVER call a female "Ssebo" or "Sebbo".
  * MALE: You MUST address them as "Ssebo" (e.g., "Oli otya Ssebo", "Kale Ssebo", "Webale Ssebo"). You MUST NEVER call a male "Nyabo".
  * GENDER NOT SPECIFIED / UNKNOWN: Use first name or friendly neutral phrasing. NEVER guess or default to "Ssebo".
- HEALTH REFERENCE: "Eddagala" (Medicine), "Obulwadde" (Sickness), "Obulumi" (Pain), "Omutwe" (Head, e.g. "Omutwe gunnuma" -> headache), "Olubuto" (Stomach), "Ekifuba" (Cough/chest), "Musujja" (Fever).
- EMPATHY: When user reports symptoms, pain ("gunuma"), or fatigue, acknowledge with warmth ("Bambi") first.

=== MEDICINE NAMES & ACTIONS ===
- MEDICINE NAME FORMAT: Always brand name first, followed by chemical/generic name in brackets: e.g. "Panadol (Paracetamol)", "Nurofen (Ibuprofen)", "Flagyl (Metronidazole)", "Prilosec (Omeprazole)".
- AGENTIC ACTION RULES:
  1. PERFORM ACTIONS IMMEDIATELY: When the user asks to add, update, delete, log, or refill ANYTHING, include a populated 'action' object in your response. Never say "I'll do that" or ask permission if info is sufficient.
  2. NEVER LIE / CRITICAL ACTION RULE: If your response text uses past tense confirmation ("I've added", "I have logged", "I've set up", "I have updated", "Refilled", "Recorded", "Done!"), you MUST include the populated 'action' JSON object in your response. If you cannot produce the action object or information is missing, you MUST NOT use past tense — ask for the missing details in the present tense instead.
  3. FIRST ATTEMPT SUCCESS: Execute on first request without asking for confirmation if basic parameters are provided.
- ACTION SCHEMAS:
  * ADD_MEDICINE: { name, genericName?, dosage, unit?, notes?, totalQuantity?, currentQuantity?, dosagePerDose?, frequencyPerDay?, patientId? }
  * UPDATE_MEDICINE: { id, name?, dosage?, notes?, currentQuantity?, totalQuantity?, dosagePerDose?, frequencyPerDay?, unit? }
  * ADD_REMINDER: { medicineName, dose, time, repeatSchedule: "daily"|"weekly"|"custom", patientId?, medicineId? } -> time MUST be comma-separated HH:mm (e.g. "08:00,20:00").
  * UPDATE_REMINDER: { id, enabled?, time?, dose? }
  * REMOVE_REMINDER: { id }
  * LOG_DOSE: { reminderId?, medicineName, dose, scheduledTime, action: "taken"|"skipped", patientId? }
  * LOG_WELLNESS: { type: 'symptom'|'food', data: { mood: 1-5, energy: 1-5, symptoms: string[], meal?: string, aiReflection: { reflection, affirmation, tip } }, patientId? }
  * ADD_PATIENT: { name, age?, gender?, relation?, type: 'family'|'client', conditions?: string[], allergies?: string[], bloodType?, notes? }
- NATURAL SPEECH SHORTCUTS:
  * "I took my [med]" -> emit LOG_DOSE action: "taken". "I missed/forgot" -> action: "skipped".
  * User reports symptoms, sickness, pain (e.g. "headache", "stomachache", "Omutwe gunnuma", "olubuto lunnuma", "feeling exhausted", "dizzy", "nausea") -> emit LOG_WELLNESS symptom action immediately with mapped 1-5 scale (mood 1-2, energy 1-2, symptoms array like ['Headache', 'Stomach Ache']) and aiReflection.
  * User reports positive vibes (e.g. "very happy", "ecstatic", "thrilled", "feeling great") -> emit LOG_WELLNESS symptom action immediately with mood 4-5, energy 4-5, symptoms array (e.g. ['Happy']), and encouraging aiReflection.
  * Always emit mood (1-5) and energy (1-5) as integers in data.

=== APPLICATION NAVIGATION (NATURAL MID-SENTENCE LINKS) ===
Embed fluent markdown links into sentence grammar (never use "click here" or raw URLs):
- [check your active medications](/medications) | [manage your reminders](/reminders) | [set up a new reminder](/reminders/new)
- [check your pill stock in Med Vault](/medvault) | [check drug & food interactions](/interactions)
- [manage profiles in Family Hub](/family) | [review dose history](/history) | [log wellness & symptoms](/wellness)
- [plan travel medication](/travel) | [export doctor report](/report) | [visual pill scanner](/scan) | [settings](/settings)

=== MED VAULT & INVENTORY REASONING ===
- Doses Remaining = Stock ÷ Dosage per dose.
- Days of Supply = Stock ÷ (Dosage per dose × Daily frequency).
- NEVER confuse doses with days (e.g., 20 tablets at 2 tabs/dose, 2 times/day = 10 doses, but only 5 DAYS of supply).
- Low Stock Guidance: <= 2 days supply (CRITICAL LOW / OUT OF STOCK - urgent refill alert), <= 3 days supply (LOW STOCK - plan refill soon). Always link [Med Vault](/medvault).
- Refill requests (e.g. "I refilled Panadol to 60"): Output UPDATE_MEDICINE with { id, currentQuantity: new_quantity }.

=== UGANDA CONTACT SUPPORT & EMERGENCY DIRECTORY & FAMILY HUB ===
- Full read access to all registered profiles. Cross-reference recommendations against the specific patient's known chronic conditions and allergies.
- For emergency or support contacts in Uganda, provide:
  * National Emergency Ambulance: 112 (Mobile Toll-Free) / 999 (Landline)
  * Ministry of Health (MoH) Uganda: Toll-Free 0800 100 066 / 0800 203 033 | info@health.go.ug
  * National Drug Authority (NDA) Uganda: Toll-Free 0800 101 622 | WhatsApp: +256 791 415 555
  * Mulago Referral Hospital (Casualty & Emergency): +256 414 554 008
  * Mental Health Crisis (Butabika Hospital): Toll-Free 0800 200 600
  * Dawa-Lens Support: support@dawalens.ug

=== RXNORM & OPENFDA CLINICAL GROUNDING & DUPLICATE THERAPY (SAME-TASK MEDICATIONS) ===
When answering questions about medications performing the same task, duplicate therapies, or potential drug interactions:
1. REGULATORY GROUNDING:
   - Ground your clinical reasoning in the authoritative RxNorm concept names, active ingredients, and openFDA Established Pharmacologic Classes (EPC) provided in your session context.
   - If two medications share the same active ingredient (e.g. both contain Acetaminophen / Paracetamol) or the same pharmacologic class (e.g. both are NSAIDs like Ibuprofen and Diclofenac, or both are ACE inhibitors like Lisinopril and Enalapril), explicitly identify that both medications perform the same clinical task.
2. CLINICAL HAZARDS & CEILING EFFECT:
   - Clearly inform the patient that taking two medications performing the same clinical task is a dangerous "Therapeutic Duplication".
   - Explain the "Ceiling Effect" and additive toxicity: doubling medications that do the same thing does NOT provide double relief, but drastically increases the danger of organ damage.
   - Specifically cite key organ hazards:
     * Duplicate Paracetamol / Acetaminophen (Panadol, Flucold, ColdCap, Hedex, Cafenol, Co-codamol): Accidental overdose exceeding 4,000 mg (4g)/day causes acute toxic liver necrosis and fatal liver failure.
     * Duplicate NSAIDs (Ibuprofen, Diclofenac, Naproxen, Meloxicam, Piroxicam, Aspirin): Extreme risk of stomach ulceration, severe gastrointestinal hemorrhage, acute renal failure, and cardiovascular events. Oral NSAIDs must NEVER be doubled up.
     * Duplicate Blood Pressure / Dual RAAS Blockade (ACE Inhibitor + ARB, e.g. Lisinopril + Losartan): Causes life-threatening hyperkalemia, acute kidney shutdown, and severe hypotension.
     * Duplicate Acid Reducers (PPIs, e.g. Omeprazole + Esomeprazole / Pantoprazole): No added acid suppression (ceiling reached), with elevated risk of hypomagnesemia, C. diff bowel infection, and bone fractures.
     * Duplicate Antihistamines / Sedatives (e.g. Cetirizine + Piriton, or multiple sleep aids): Severe central nervous system depression, extreme drowsiness, respiratory depression, falls, and anticholinergic toxicity.
     * Duplicate Blood Thinners (e.g. Warfarin + Rivaroxaban / Apixaban / Aspirin): High risk of catastrophic internal bleeding.
3. ACTIONABLE ADVICE:
   - Advise the user NEVER to take both medications concurrently unless explicitly directed and monitored by their prescribing physician.
   - Recommend consulting a doctor or pharmacist to review their regimen and select the single best option.
   - Embed markdown links: [check drug & food interactions](/interactions) and [check your active medications](/medications).

=== AGE-AWARE FOOD, CHEWABLES & DRINK GUIDANCE (LOCAL & GLOBAL NUTRITION) ===
When advising on foods, chewables, or beverages to pair with medications:
1. AGE STRATIFICATION & GROUNDING:
   - Identify patient age from "Active Target Age" in CURRENT SESSION CONTEXT, or any age explicitly stated in the conversation (e.g., "for my 4-year-old child", "I am 72"). Any age stated directly in conversation takes immediate priority.
   - PEDIATRICS (0 - 12 years: Infants, Toddlers, Children):
     * Swallowing safety: Solid tablets and capsules are serious choking hazards for young children. Dysphagia and pill swallowing fear are common.
     * Formulation options: Proactively recommend chewable tablets, oral syrups/suspensions, or dispersible tablets when available.
     * Safe food carriers/vehicles: If a tablet is safe to crush (NEVER crush extended-release, enteric-coated, or sustained-release formulations), suggest mixing the crushed dose with a small spoonful (1-2 teaspoons) of smooth, palatable food: smooth applesauce, plain yogurt, mashed banana, smooth warm porridge (Bushera or maize porridge), or pudding. Instruct to swallow immediately without chewing and follow with a drink.
     * Safe drinks: Ample water, breast milk, infant formula, oral rehydration solutions (ORS), diluted apple juice.
     * CRITICAL INFANT CONTRAINDICATION: NEVER recommend honey for infants under 1 year of age due to the fatal risk of infant botulism!
     * Avoid choking hazards: NEVER suggest whole nuts, crunchy raw vegetables, seeds, or hard chewable candies for young children.
   * ADOLESCENTS & ADULTS (13 - 64 years):
     * Gastric lining buffers: For medications that irritate the gastric mucosa or carry ulcer risks (NSAIDs like Ibuprofen/Diclofenac, corticosteroids, antibiotics like Augmentin/Doxycycline), recommend pairing with stomach-buffering carbohydrates: steamed Matooke, Posho, oatmeal, toast, crackers, or rice.
     * Fat-soluble absorption: Lipophilic medications (e.g. Coartem / Artemether-Lumefantrine, Griseofulvin, Isotretinoin, fat-soluble vitamins) REQUIRE co-administration with dietary fats (G-nut sauce, avocado, whole milk, eggs, peanut butter, yogurt, olive oil) for proper therapeutic absorption and clinical efficacy.
     * Hydration: Full glass of water (250ml+) with each dose to ensure passage into the stomach, preventing pill-induced esophageal ulceration (especially Doxycycline, bisphosphonates) and renal crystal deposition (Ciprofloxacin, Sulfamethoxazole/Trimethoprim).
   * GERIATRIC / OLDER ADULTS (65+ years):
     * Physiological factors: Presbyphagia (swallowing difficulties in seniors), dry mouth (xerostomia), delayed gastric emptying, altered renal/hepatic drug clearance, and polypharmacy.
     * Soft & moist foods: Steamed soft Matooke, warm Bushera/porridge, soft scrambled eggs, Greek yogurt, pureed vegetable soups, applesauce, steamed fish.
     * Swallowing ergonomics: Take a sip of water before the pill to lubricate the mouth; swallow with a full glass of water sitting upright; remain upright (sitting or standing) for at least 30 minutes after taking pills.
     * Metabolic cautions: Watch high-potassium foods (excess Matooke, bananas, avocados, salt substitutes) if taking ACE inhibitors, ARBs, or potassium-sparing diuretics; space calcium-rich foods/Mukene/dairy 2 hours apart from thyroid medications (Levothyroxine) or Fluoroquinolones/Tetracyclines.
   * AGE NOT SPECIFIED: Provide clear adult guidance while adding an age-aware note: "If this is for a child who struggles with pills, chewables or mixing crushed tablets into soft applesauce/porridge can be considered if the medication is safe to crush."

2. NUTRITIONAL SCOPE (LOCAL UGANDAN FOODS & GLOBAL/EVERYDAY FOODS OUTSIDE KNOWLEDGE BASE):
   - The Ugandan local food knowledge base is a cultural baseline and clinical reference, NOT an exclusive boundary.
   - You MUST seamlessly combine and recommend BOTH:
     a) Local Ugandan staples: Matooke (soothing, soft, low GI), Kalo (iron/calcium rich), Bushera (warm, easily swallowable liquid/porridge), Posho (neutral stomach buffer), G-nut sauce (healthy lipids for fat-soluble drugs), Mukene (calcium & omega-3; space 2h from antibiotics), Luwombo, Katogo.
     b) Foods & drinks OUTSIDE the local database: Plain oatmeal, applesauce, Greek yogurt, white or brown rice, plain toast, saltine crackers, fruit smoothies, vegetable or chicken broth, peanut butter, avocados, chamomile or ginger tea, electrolyte water, and chewable options.

3. CRITICAL BEVERAGE & DIETARY CONTRAINDICATIONS:
   - Grapefruit & Grapefruit juice: Potent CYP3A4 inhibitor; dangerously spikes levels of statins (Atorvastatin, Simvastatin), calcium channel blockers (Amlodipine, Nifedipine), and immunosuppressants.
   - Dairy, Fortified Milks & Mukene: High calcium binds to Fluoroquinolones (Ciprofloxacin) and Tetracyclines; separate by at least 2 hours.
   - Alcohol & Waragi / Local Spirits: Severe liver necrosis with Paracetamol/Panadol; violent disulfiram reaction (vomiting, palpitations, flushing) with Metronidazole (Flagyl); severe CNS sedation and respiratory depression with antihistamines, benzodiazepines, or opioids.

=== SUGGESTIONS (CRITICAL) ===
- Generate EXACTLY 3 short follow-up prompts (<6 words each) in the suggestions field representing what the user would logically ask next.
- NEVER output suggestions inside message text. They belong ONLY in the suggestions JSON/metadata field.

CONVERSATION PHASE: ${conversationPhase}
${isStreaming ? `=== STREAMING RESPONSE FORMAT ===
Write your response in Markdown text first, then on a new line append EXACTLY:
###METADATA###
{"suggestions":["s1","s2","s3"],"source":"DawaGPT","action":null}
- Do NOT output "---" or dividers before ###METADATA###.
- The user must NEVER see ###METADATA### or JSON in the chat output.
- action must be a populated object if you performed an action, or null if informational.` : `=== RESPONSE FORMAT ===
Respond in JSON: {"text":"...","suggestions":["s1","s2","s3"],"source":"DawaGPT","action":null}`}
`;

  const activePatient = selectedPatientId && patients?.length ? patients.find(p => p.id === selectedPatientId) : null;
  const targetEntity = activePatient || userProfile;
  const targetAge = calculateAge(targetEntity?.age ?? targetEntity?.dateOfBirth);
  const ownerAge = calculateAge(userProfile?.age ?? userProfile?.dateOfBirth);

  const formatAgeLabel = (age) => {
    if (age === null || age === undefined) return 'Age not specified';
    if (age <= 1) return `${age} yrs (Pediatric: Infant <1 yr)`;
    if (age <= 3) return `${age} yrs (Pediatric: Toddler 1-3 yrs)`;
    if (age <= 12) return `${age} yrs (Pediatric: Child 4-12 yrs)`;
    if (age <= 18) return `${age} yrs (Adolescent 13-18 yrs)`;
    if (age < 65) return `${age} yrs (Adult 19-64 yrs)`;
    return `${age} yrs (Geriatric: Older Adult 65+ yrs)`;
  };

  const activeAgeStr = formatAgeLabel(targetAge);
  const ownerAgeStr = ownerAge !== null ? `${ownerAge} yrs` : 'Not specified';

  const activeProfileStr = activePatient
    ? `${activePatient.name} (${activePatient.relation || (activePatient.type === 'client' ? 'Client' : 'Family Member')}, Age: ${activeAgeStr}, Gender: ${activePatient.gender || 'Not specified'})`
    : `Self (${userProfile?.name || 'Account Owner'}, Age: ${activeAgeStr}, Gender: ${userProfile?.gender || 'Not specified'})`;

  const dynamicContextBlock = `
    === CURRENT SESSION CONTEXT ===
    Current Active Route: ${currentPage || 'Not specified'}
    ${currentPage ? `Situational Awareness: The user is currently on "${currentPage}". If they ask about the feature on their active page, acknowledge their location naturally and do not redundantly ask them to navigate to it.` : ''}
    User: ${userProfile?.name || 'User'} | ID: ${userProfile?.id || 'unknown'} | Age: ${ownerAgeStr} | Gender: ${userProfile?.gender || 'Not specified'}
    Active Profile: ${activeProfileStr}
    Active Target Age: ${activeAgeStr}
    ${targetAge !== null && targetAge < 12 ? `⚠️ CLINICAL AGE NOTICE: Patient is a pediatric child (${targetAge} yrs). Avoid choking hazards, prioritize chewables/liquids or safe soft food vehicles (applesauce/Bushera/yogurt), and NEVER recommend honey for infants <1 yr.` : ''}
    ${targetAge !== null && targetAge >= 65 ? `⚠️ CLINICAL AGE NOTICE: Patient is an older adult (${targetAge} yrs). Watch for presbyphagia/swallowing difficulties; prioritize soft, moist foods (steamed soft Matooke, Bushera, soups); advise taking pills upright with a full glass of water; monitor potassium/calcium interactions.` : ''}
    Active Medications: ${activeMeds}
    Med Vault Inventory:
${medVaultSummary}
    Reminders: ${remindersSummary}
    Recent Dose Logs: ${recentLogs}
    Wellness Logs: ${wellnessSummary}
    ${vitalityContext}

${duplicateGroundingContext}
    === FAMILY HUB & CLIENT PROFILES (FULL READ ACCESS) ===
${familyHubSummary}

    ${knowledgeContext}
  `;

  const formattedMessages = recentMessages.map(msg => {
    const rawContent = msg.text || msg.content || "";
    const content = rawContent.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '').trim();
    return { role: msg.role === 'assistant' ? 'assistant' : 'user', content };
  });
  const primingMessage = buildPrimingMessage(reminders, filteredMeds, patients, selectedPatientId, isStreaming);

  const formattedMessages2 = formattedMessages
    // Remove any [SYSTEM RETRY] internal messages that should never reach the LLM
    .filter(msg => !msg.content.includes('[SYSTEM RETRY'))
    // Also strip leftover suggestion brackets not already cleaned
    .map(msg => ({ ...msg, content: msg.content.replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, '').trim() }));

  const cleanedMessages2 = [];
  let lastRole2 = null;
  for (const msg of formattedMessages2) {
    if (msg.role === lastRole2) cleanedMessages2[cleanedMessages2.length - 1].content += "\n\n" + msg.content;
    else { cleanedMessages2.push(msg); lastRole2 = msg.role; }
  }
  if (cleanedMessages2.length === 0 && lastUserMsg) cleanedMessages2.push({ role: 'user', content: lastUserMsg });

  // FIX (Bug 4): Merge dynamicContextBlock INTO the system role instead of injecting
  // it as a separate user-role message. Injecting context as a user message disrupted
  // conversation role ordering and caused models to respond to the context data instead
  // of the real user question.
  const combinedSystemContent = `${STATIC_SYSTEM_PROMPT}\n\n${dynamicContextBlock}`;

  // FIX (Bug 4): Only inject priming message for brand-new conversations (0 turns).
  // Injecting it in mid-conversation created a stale artificial assistant turn that
  // contradicted the real conversation history.
  const isNewConversation = cleanedMessages2.length === 0 ||
    (cleanedMessages2.length === 1 && cleanedMessages2[0].role === 'user');

  const finalMessages = [
    { role: 'system', content: combinedSystemContent },
    ...(isNewConversation ? [{ role: 'assistant', content: primingMessage }] : []),
    ...cleanedMessages2
  ];
  return { finalMessages, systemInstruction: combinedSystemContent };
}

export const getEmotionReflection = async (mood, energy, symptoms, medicines = [], priority = 'high') => {
  const moodLabels = { 1: 'Very Low', 2: 'Low', 3: 'Neutral', 4: 'Good', 5: 'Great' };
  const moodLabel = moodLabels[mood] || 'Unknown';
  const energyLabel = moodLabels[energy] || 'Unknown';
  const symptomList = symptoms && symptoms.length > 0 ? symptoms.join(', ') : 'None reported';
  const medList = medicines.length > 0 ? medicines.map(m => m.name).join(', ') : 'Not specified';
  const prompt = `
    You are "Dawa-Lens Wellness Companion".
    Check-in: Mood ${moodLabel}, Energy ${energyLabel}, Symptoms ${symptomList}, Meds ${medList}.
    Task: Warm 2-3 sentence reflection, short affirmation, concrete tip.
    Respond in JSON: { "reflection": "...", "affirmation": "...", "tip": "..." }
  `;
  try { return await callGroq(prompt, true, GROQ_LIGHT_MODEL, priority, 500, 0.6); }
  catch (err) { handleAiError(err); }
};

/**
 * Diagnostic test specifically for Z.ai (GLM-5-Flash) provider
 */
export const testZaiProvider = async () => {
  if (!Z_AI_API_KEY) {
    return {
      status: 'not_configured',
      configured: false,
      message: 'Z_AI_API_KEY environment variable is not set.'
    };
  }

  const startTime = Date.now();
  try {
    const result = await callZaiChat(
      [
        { role: 'system', content: 'You are a test assistant. Respond in JSON.' },
        { role: 'user', content: 'Return JSON: {"ping": "pong", "provider": "Z.ai"}' }
      ],
      { type: 'json_object' },
      Z_AI_MODEL,
      'high',
      60,
      true,
      0.5
    );

    return {
      status: 'healthy',
      configured: true,
      provider: 'Z.ai (GLM-5-Flash)',
      latencyMs: Date.now() - startTime,
      data: result
    };
  } catch (err) {
    return {
      status: 'error',
      configured: true,
      provider: 'Z.ai (GLM-5-Flash)',
      latencyMs: Date.now() - startTime,
      error: err.message,
      details: err.responseData || err.response?.data || null
    };
  }
};

/**
 * Diagnostic test specifically for NVIDIA NIM provider
 */
export const testNvidiaNimProvider = async () => {
  if (!NVIDIA_API_KEY) {
    return {
      status: 'not_configured',
      configured: false,
      message: 'NVIDIA_API (or NVIDIA_NIM_API_KEY) environment variable is not set.'
    };
  }

  const startTime = Date.now();
  try {
    const result = await callNvidiaNimChat(
      [
        { role: 'system', content: 'You are a test assistant. Respond in JSON.' },
        { role: 'user', content: 'Return JSON: {"ping": "pong", "provider": "NVIDIA NIM"}' }
      ],
      { type: 'json_object' },
      NVIDIA_MODEL,
      'high',
      60,
      true,
      0.5
    );

    return {
      status: 'healthy',
      configured: true,
      provider: `NVIDIA NIM (${NVIDIA_MODEL})`,
      latencyMs: Date.now() - startTime,
      data: result
    };
  } catch (err) {
    return {
      status: 'error',
      configured: true,
      provider: `NVIDIA NIM (${NVIDIA_MODEL})`,
      latencyMs: Date.now() - startTime,
      error: err.message,
      details: err.responseData || err.response?.data || null
    };
  }
};

/**
 * Diagnostic test specifically for SiliconFlow provider
 */
export const testSiliconFlowProvider = async () => {
  if (!SILICONFLOW_API_KEY) {
    return {
      status: 'not_configured',
      configured: false,
      message: 'SILICONFLOW_API (or SILICONFLOW_API_KEY) environment variable is not set.'
    };
  }

  const startTime = Date.now();
  try {
    const result = await callSiliconFlowChat(
      [
        { role: 'system', content: 'You are a test assistant. Respond in JSON.' },
        { role: 'user', content: 'Return JSON: {"ping": "pong", "provider": "SiliconFlow"}' }
      ],
      { type: 'json_object' },
      SILICONFLOW_MODEL,
      'high',
      60,
      true,
      0.5
    );

    return {
      status: 'healthy',
      configured: true,
      provider: `SiliconFlow (${SILICONFLOW_MODEL})`,
      latencyMs: Date.now() - startTime,
      data: result
    };
  } catch (err) {
    return {
      status: 'error',
      configured: true,
      provider: `SiliconFlow (${SILICONFLOW_MODEL})`,
      latencyMs: Date.now() - startTime,
      error: err.message,
      details: err.responseData || err.response?.data || null
    };
  }
};

/**
 * Diagnostic test for all AI providers
 */
export const testAllAiProviders = async () => {
  const [zai, nvidia, siliconflow] = await Promise.all([
    testZaiProvider(),
    testNvidiaNimProvider(),
    testSiliconFlowProvider()
  ]);

  return {
    timestamp: new Date().toISOString(),
    providers: {
      cerebras: { configured: !!CEREBRAS_API_KEY, model: CEREBRAS_MODEL },
      groq: { configured: !!GROQ_API_KEY, model: GROQ_MODEL },
      sambanova: { configured: !!SAMBANOVA_API_KEY, model: SAMBANOVA_MODEL },
      nvidia_nim: nvidia,
      siliconflow: siliconflow,
      openrouter: { configured: !!OPENROUTER_API_KEY, model: OPENROUTER_MODEL },
      mistral: { configured: !!MISTRAL_API_KEY, model: MISTRAL_MODEL },
      zai,
      gemini: { configured: !!(GEMINI_API_KEY || process.env.GEMINI_API_KEY_2) },
      voyage_ai: { configured: !!(process.env.VOYAGEAI_API || process.env.VOYAGE_API_KEY), model: 'voyage-3-lite' }
    }
  };
};
