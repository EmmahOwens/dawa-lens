# Implementation Plan: DawaGPT Reliability & Agentic Task Fixes

## Overview

Surgical fixes across the server AI service, frontend streaming parser, action dispatcher hook,
and server startup logging. No architectural rewrites — each change is isolated to its identified
root cause. The implementation follows the dependency order: server-side fixes first (aiService.js),
then the frontend streaming parser (which depends on the new `###METADATA###` delimiter), then
independent frontend fixes, and finally the regression test file.

## Tasks

- [x] 1. Add Cerebras startup logging to `server/src/index.js`
  - After `dotenv.config()`, add a conditional log: `✅ Cerebras: active` if `CEREBRAS_API_KEY`
    is set, else `⚠️  Cerebras: not configured — falling back to Groq`
  - Server must continue without crashing when the key is absent
  - _Requirements: 1.1, 1.2_

- [x] 2. Document `CEREBRAS_API_KEY` in `server/.env.example`
  - Add `CEREBRAS_API_KEY="your-cerebras-api-key"` under the AI Service Keys section with a
    comment explaining it enables the fast 120B model for complex tasks
  - _Requirements: 1.4_

- [x] 3. Fix `aiService.js` — Cerebras error code, timeouts, streaming, routing, and prompts
  - [x] 3.1 Fix `callCerebrasChat` error status code
    - Change `throw new AppError('Cerebras API key not configured', 401)` to status `503`
    - This ensures the fallback chain triggers correctly instead of surfacing an auth error
    - _Requirements: 1.3_

  - [x] 3.2 Increase `callCerebrasChat` non-streaming timeout
    - Change `timeout: 8000` to `timeout: 15000` in the non-streaming Cerebras axios call
    - _Requirements: 6.1_

  - [x] 3.3 Fix `streamChatWithDawaGPT` — remove `response_format` and increase streaming timeout
    - Remove `response_format: { type: 'json_object' }` from the streaming axios request body
    - Change Cerebras streaming timeout from `8000` to `20000` (keep Groq at `15000`)
    - Add elapsed-time `console.warn` when Cerebras times out before falling back to Groq:
      `DawaGPT Stream: Cerebras timed out after ${elapsed}ms, falling back to Groq.`
    - _Requirements: 2.1, 6.2, 6.3_

  - [x] 3.4 Fix `isComplexTask` — add delete/remove intent and show-reminders patterns
    - Add regex for delete/remove intent + domain noun:
      `/(delete|remove|cancel|stop)\s+\w*\s*(reminder|alarm|med|medicine)/i`
    - Add regex for show/list reminders intent:
      `/(show|list|what\s+are|check|view)\s+\w*\s*reminders?/i`
    - Preserve the existing how-to guard and all other existing patterns
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 3.5 Write property tests for `isComplexTask` patterns (Property 6, 7, 8)
    - **Property 6: `isComplexTask` classifies delete+domain as complex**
    - **Property 7: `isComplexTask` classifies show-reminders as complex**
    - **Property 8: `isComplexTask` preserves how-to guard**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 3.6 Fix `prepareDawaGPTContext` — add streaming system prompt format
    - When `isStreaming: true`, replace the `=== RESPONSE FORMAT ===` section with the
      `=== STREAMING RESPONSE FORMAT ===` section that instructs the model to output plain
      Markdown followed by `###METADATA###` and a single-line JSON block
    - Update the `REMOVE_REMINDER` action description in the system prompt to instruct the
      model to always include the reminder `id` in the payload when the reminder list is in context
    - Non-streaming prompt tail must remain unchanged
    - _Requirements: 2.2, 4.3_

- [x] 4. Checkpoint — server-side fixes complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Fix `src/services/aiAssistantService.ts` — replace mid-stream JSON detection with `###METADATA###` delimiter splitting
  - [x] 5.1 Update chunk accumulation to strip metadata from visible text
    - During the read loop, compute `visibleText` as the portion of `allText` before any
      `###METADATA###` occurrence; pass `visibleText` (not `allText`) to `onChunk`
    - This prevents the delimiter and JSON from ever appearing in the UI
    - _Requirements: 2.3_

  - [x] 5.2 Replace post-stream metadata parsing with delimiter-based split
    - After the read loop, find `delimiterIndex = allText.indexOf('###METADATA###')`
    - If found: `displayText = allText.substring(0, delimiterIndex).trim()`,
      `rawMetadata = allText.substring(delimiterIndex + '###METADATA###'.length).trim()`
    - If not found: `displayText = allText.trim()`, `rawMetadata = ''`
    - Parse `rawMetadata` with `JSON.parse`; on failure or empty string, default to
      `{ suggestions: [], source: 'Gemini', action: undefined }` — do not throw
    - Remove the old regex-based `metadataStart` detection entirely
    - _Requirements: 2.3, 2.4_

  - [x] 5.3 Write property tests for streaming parser (Properties 1, 2, 3)
    - **Property 1: Streaming output never contains `###METADATA###` in visible text**
    - **Property 2: Metadata delimiter split is lossless**
    - **Property 3: Graceful degradation on absent or malformed metadata**
    - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 6. Fix `src/hooks/useAIActions.ts` — `REMOVE_REMINDER` fallback, error messages, unknown action toast
  - [x] 6.1 Add fuzzy name-matching fallback to `REMOVE_REMINDER` case
    - If `payload.id` is absent, search `reminders` for a case-insensitive match on `medicineName`
    - If a match is found, use `match.id` as `targetId`
    - If no match is found, throw `new Error("Could not find a reminder for ${payload.medicineName || 'the specified medicine'}")`
    - Mirror the existing `UPDATE_REMINDER` pattern exactly
    - _Requirements: 4.1, 4.2_

  - [x] 6.2 Write property tests for `REMOVE_REMINDER` fuzzy match (Properties 4, 5)
    - **Property 4: `REMOVE_REMINDER` fuzzy match correctness**
    - **Property 5: `REMOVE_REMINDER` fails descriptively when no match exists**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 6.3 Improve error toast to surface specific failure reason
    - In the `catch` block of `dispatchAIAction`, change the fallback description from
      `"I couldn't complete that action. Please try manually."` to
      `"Action failed. Please try again or do it manually."`
    - The specific error message (e.g. `"Could not find a reminder for Paracetamol"`) will
      surface automatically via `(e as Error).message`
    - _Requirements: 7.1_

  - [x] 6.4 Add toast for unknown action types in `default` case
    - After the existing `console.warn("Unknown AI action type:", action.type)`, add a toast:
      title `"⚠️ Unsupported action"`, description
      `"DawaGPT tried an unsupported action. Please try rephrasing your request."`,
      variant `"destructive"`
    - _Requirements: 7.3_

- [x] 7. Fix `src/components/DawaGPT.tsx` — network error message
  - In the `catch (e)` block of `handleSend`, set the error text to:
    `"Connection lost. Please check your internet and try again."`
  - _Requirements: 7.2_

- [x] 8. Checkpoint — frontend fixes complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create `server/src/test-isComplexTask.js` — regression test file
  - [x] 9.1 Export `isComplexTask` from `aiService.js` for testing
    - Add a named export (or test-only export) so the test file can import the function
    - _Requirements: 5.4_

  - [x] 9.2 Write ≥ 10 test cases using Node.js `assert` module
    - Cover: delete intent (`"delete my Paracetamol reminder"` → `true`),
      remove intent (`"remove the Metformin alarm"` → `true`),
      show reminders (`"show my reminders"` → `true`),
      list reminders (`"list all reminders"` → `true`),
      add reminder (`"add a reminder for Coartem at 8am"` → `true`),
      what are reminders (`"what are my current reminders?"` → `true`),
      how-to guard (`"how do I add a reminder?"` → `false`),
      explain guard (`"can you explain what Metformin does?"` → `false`),
      log dose (`"log my Paracetamol dose"` → `true`),
      unrelated (`"I have a headache"` → `false`)
    - Print a pass/fail summary; exit with code 1 on any failure
    - _Requirements: 5.4_

- [x] 10. Final checkpoint — all fixes integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Task 5 (aiAssistantService.ts) depends on Task 3.6 (streaming prompt with `###METADATA###`)
- Task 9 (test file) depends on Task 3.4 (`isComplexTask` fix) and Task 9.1 (export)
- Tasks 1, 2, 6, and 7 are independent of each other and of the server AI service changes
- Property tests validate universal correctness properties; unit tests validate specific examples
- The `###METADATA###` delimiter must never appear in the UI — enforced by Task 5.1
- The non-streaming path (`/ai/chat`) is unaffected by the streaming changes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3.1", "3.2", "6.3", "6.4", "7"] },
    { "id": 1, "tasks": ["3.3", "3.4", "6.1"] },
    { "id": 2, "tasks": ["3.5", "3.6", "6.2"] },
    { "id": 3, "tasks": ["5.1", "9.1"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["5.3", "9.2"] }
  ]
}
```
