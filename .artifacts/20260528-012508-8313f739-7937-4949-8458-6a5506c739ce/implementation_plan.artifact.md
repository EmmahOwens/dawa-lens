# Implementation Plan - Fix AI Fallback Logic and Cerebras Integration

The user is experiencing total failure in DawaGPT ("Both AI engines are unavailable") and reporting that Cerebras API is not being used despite having a key. Research revealed that:
1. Non-streaming chat completely bypasses Cerebras.
2. Streaming chat skips Groq fallback and goes straight from Cerebras to Gemini.
3. If a Groq API key is missing, the system jumps to Gemini even if Cerebras is available.
4. Fallback logic is inconsistent across different chat methods.

## Proposed Changes

### AI Service Refactoring

#### [aiService.js](file:///home/iammbayo/Documents/Projects/dawa-lens/server/src/services/aiService.js)

- **Unify Entry Points**: Update `chatWithDawaGPT` and `streamChatWithDawaGPT` to prioritize Cerebras for complex tasks when `CEREBRAS_API_KEY` is present.
- **Fix Fallback Chain**: Ensure the chain is always `Cerebras -> Groq -> Gemini`.
- **Decouple Keys**: Allow Cerebras to run even if `GROQ_API_KEY` is missing.
- **Improve Error Logging**: Add more context to error logs to help diagnose why specific engines fail.

Specifically:
- Refactor `chatWithDawaGPT` to call `callCerebrasChat` first if conditions are met.
- Refactor `streamChatWithDawaGPT` to have a proper fallback to `callGroqChat` (non-streaming) or Gemini if the stream fails.
- Update `callCerebrasChat` to ensure it falls back to `callGroqChat` correctly.
- Update `callGroqChat` to ensure it falls back to `callGeminiChat` correctly.

### Rate Limit Manager

#### [rateLimitManager.js](file:///home/iammbayo/Documents/Projects/dawa-lens/server/src/services/rateLimitManager.js)

- Verify model keys match between `aiService.js` and `rateLimitManager.js`.
- (Optional) Add `cerebras-120b` to the `getStats` output for better debugging.

## Verification Plan

### Automated Tests
- I will create a series of test scripts in `server/` that mock API failures to verify the fallback logic:
  - `test-fallback-cerebras-to-groq.js`: Mock Cerebras failure and verify Groq is called.
  - `test-fallback-groq-to-gemini.js`: Mock Groq failure and verify Gemini is called.
  - `test-cerebras-only.js`: Verify Cerebras is called when Groq key is missing but Cerebras key is present.
- Run the existing `test-ai.js` and `test-ai2.js` to ensure basic functionality remains intact.

### Manual Verification
- I will use `run_shell_command` to execute these test scripts and observe the logs.
- I will check the console logs for the correct "falling back to..." messages.
