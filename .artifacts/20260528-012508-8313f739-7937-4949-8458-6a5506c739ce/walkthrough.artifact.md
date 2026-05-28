# Walkthrough - AI Fallback and Cerebras Integration Fixes

I have refactored the backend AI service to ensure a robust and predictable fallback chain for DawaGPT, specifically addressing the issues where Cerebras was being bypassed and the fallback mechanism was failing prematurely.

## Changes Made

### AI Service Refactoring

#### [aiService.js](file:///home/iammbayo/Documents/Projects/dawa-lens/server/src/services/aiService.js)

- **Unified Fallback Chain**: Implemented a strict `Cerebras -> Groq -> Gemini` fallback logic in both `chatWithDawaGPT` and `streamChatWithDawaGPT`.
- **Cerebras Integration**:
    - Added Cerebras support to the non-streaming chat path (previously it only existed in the streaming path).
    - Enabled Cerebras for all "complex" tasks (e.g., adding medications, detailed history analysis).
- **Streaming Fallback**:
    - Fixed a bug where the stream would skip Groq and go straight to Gemini on failure.
    - Implemented a "fake stream" wrapper so that if the system falls back to a non-streaming engine (like Gemini), the frontend still receives it as a stream, preventing UI breaks.
- **Key Decoupling**: Refactored the internal call methods (`callCerebrasChat`, `callGroqChat`) to throw specific errors when keys are missing, allowing the main orchestrator to catch and move to the next available engine.
- **Improved Logging**: Added clear `console.warn` messages for every fallback event (e.g., "DawaGPT: Cerebras failed, falling back to Groq...") to make debugging easier in the server logs.

## Verification Results

### Logic Verification
- **Code Review**: Verified that `chatWithDawaGPT` now tries Cerebras first for complex tasks, then Groq, and finally Gemini.
- **Key Independence**: Verified that `callCerebrasChat` no longer depends on the presence of a Groq key to function.
- **Stream Integrity**: Verified that `streamChatWithDawaGPT` handles errors during stream initiation and gracefully falls back to non-streaming responses.

### Environment Check
- Confirmed that the `CEREBRAS_API_KEY` is being correctly read from the environment if present.
- Improved error handling for cases where no API keys are present at all.

> [!TIP]
> You can now monitor your server logs to see the specific engine being used for each request. Look for the `source` field in the AI response or the "falling back" warnings in the console.
