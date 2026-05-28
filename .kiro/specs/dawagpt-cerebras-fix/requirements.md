# Requirements: DawaGPT Reliability & Agentic Task Fixes

## Introduction

DawaGPT is the conversational AI assistant in Dawa-Lens. Users can ask it to add reminders,
check existing reminders, delete reminders, log doses, and perform other agentic tasks.
Currently the assistant is slow, sometimes fails silently, and agentic actions (add/delete/update
reminders) are unreliable. This spec covers the fixes needed to make DawaGPT fast and
dependably agentic.

The root causes identified are:
- `CEREBRAS_API_KEY` is set in Render but the server emits a misleading 401 error when it is
  absent in other environments, masking the real fallback behaviour.
- The streaming path passes `response_format: { type: 'json_object' }` alongside `stream: true`,
  which Cerebras and Groq do not support together — causing stalls and garbled output.
- Both the server-side autonomous loop and the client-side `dispatchAIAction` execute the same
  action, creating duplicate Firestore writes.
- `REMOVE_REMINDER` in `useAIActions` has no fuzzy name-matching fallback, so delete commands
  fail silently when the AI omits the Firestore document ID.
- `isComplexTask` misclassifies several common agentic phrases, routing them to the 8B model
  which does not reliably produce the `action` field.

---

## Requirements

### Requirement 1

**User Story:** As a developer deploying to Render, I want the server to correctly pick up
`CEREBRAS_API_KEY` from the environment so that the fast 120B model is actually used for
complex tasks, and so that missing-key failures are clearly distinguishable from auth failures.

#### Acceptance Criteria

1. On server startup, if `CEREBRAS_API_KEY` is present in the environment, the server logs
   a confirmation that Cerebras is active (e.g. `✅ Cerebras: active`).
2. On server startup, if `CEREBRAS_API_KEY` is absent, the server logs a warning
   (e.g. `⚠️  Cerebras: not configured — falling back to Groq`) and continues without crashing.
3. The `callCerebrasChat` function throws a clear `AppError` with status 503 (not 401) when
   the key is absent, so the fallback chain triggers correctly instead of surfacing an auth
   error to the user.
4. The `.env.example` file documents `CEREBRAS_API_KEY` so future developers know to set it.

---

### Requirement 2

**User Story:** As a user, I want DawaGPT to stream its reply in real time without stalling or
producing garbled output.

#### Acceptance Criteria

1. The `streamChatWithDawaGPT` function does NOT pass `response_format: { type: 'json_object' }`
   to either Cerebras or Groq when `stream: true` is set.
2. Instead, the system prompt instructs the model to append a single-line JSON metadata block
   at the very end of its streamed text, clearly delimited with `###METADATA###`.
3. The frontend `chatWithDawaGPTStream` parser splits on the `###METADATA###` delimiter to
   separate display text from metadata, rather than trying to detect a JSON object mid-stream.
4. If the metadata block is absent or malformed, the frontend gracefully returns the full
   streamed text with empty suggestions and no action — it does not crash or show an error.
5. The non-streaming `chatWithDawaGPT` path is unaffected and continues to use
   `response_format: { type: 'json_object' }`.

---

### Requirement 3

**User Story:** As a user, when I ask DawaGPT to add a reminder, I want exactly one reminder
created — not two duplicates caused by both the server and the client writing to Firestore.

#### Acceptance Criteria

1. The server-side autonomous execution loop (`executeAiAction`) only runs on the
   non-streaming `/ai/chat` path.
2. The streaming path (`/ai/chat/stream`) does NOT execute actions server-side. It streams
   the text and metadata (including the `action` field) to the client and lets the client
   dispatch the action via `useAIActions`.
3. The client (`DawaGPT.tsx`) only calls `dispatchAIAction` when it receives an `action`
   from the streaming response — this existing behaviour is preserved.
4. There is no code path where both the server and the client write the same action to
   Firestore for the same user request.

---

### Requirement 4

**User Story:** As a user, when I say "delete my Paracetamol reminder", I want DawaGPT to
find and delete it even if the AI returns a medicine name instead of a Firestore document ID.

#### Acceptance Criteria

1. The `REMOVE_REMINDER` case in `useAIActions.ts` applies the same fuzzy name-matching
   fallback that already exists for `UPDATE_REMINDER`: if `payload.id` is absent, search
   `reminders` for a case-insensitive match on `medicineName`.
2. If no matching reminder is found by name, the action throws a descriptive error:
   `"Could not find a reminder for [medicineName]"`.
3. The system prompt for DawaGPT instructs the model to always include the reminder `id`
   in `REMOVE_REMINDER` payloads when the reminder list is available in context.

---

### Requirement 5

**User Story:** As a user, I want commands like "show my reminders", "delete my Paracetamol
reminder", and "add a reminder for Metformin at 8am" to always be routed to the capable model
so the `action` field is reliably produced.

#### Acceptance Criteria

1. The `isComplexTask` function classifies any message containing a delete/remove intent
   (`delete`, `remove`, `cancel`, `stop`) combined with a domain noun (`reminder`, `medicine`,
   `med`, `alarm`) as complex (`true`).
2. The function classifies any message containing a read/list intent (`show`, `list`,
   `what are`, `check`, `view`) combined with `reminder` or `reminders` as complex (`true`).
3. The existing "how do I…" / "can you explain…" guard that returns `false` for
   informational queries is preserved.
4. A unit test file documents at least 8 representative inputs and their expected
   `isComplexTask` output to prevent regressions.

---

### Requirement 6

**User Story:** As a user, I want DawaGPT to wait long enough for Cerebras to respond before
falling back, so I actually benefit from the faster 120B model.

#### Acceptance Criteria

1. The `callCerebrasChat` timeout is increased from 8 000 ms to 15 000 ms for the
   non-streaming path, matching the Groq timeout.
2. The streaming path for Cerebras uses a 20 000 ms timeout (streaming responses take
   longer to begin than non-streaming ones).
3. If Cerebras times out, the fallback to Groq is logged at `warn` level with the elapsed
   time so it is visible in Render logs.

---

### Requirement 7

**User Story:** As a user, when DawaGPT fails to perform an action, I want a clear message
that tells me what went wrong and what I can do next — not a generic fallback string.

#### Acceptance Criteria

1. When `dispatchAIAction` catches an error, the toast description includes the specific
   failure reason (e.g. "Could not find a reminder for Paracetamol") rather than the generic
   "I couldn't complete that action. Please try manually."
2. When the streaming connection fails entirely (network error, server 5xx), DawaGPT
   displays: "Connection lost. Please check your internet and try again."
3. When the AI returns an action with an unknown `type`, `useAIActions` logs a `console.warn`
   and shows a toast: "DawaGPT tried an unsupported action. Please try rephrasing your request."
