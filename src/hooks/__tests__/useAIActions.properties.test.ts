/**
 * Property-based tests for REMOVE_REMINDER fuzzy match logic in useAIActions.ts
 *
 * These tests validate the core matching algorithm in isolation, without
 * requiring React context or Firebase. The logic under test mirrors exactly
 * what the REMOVE_REMINDER case does in dispatchAIAction.
 *
 * Validates: Requirements 4.1, 4.2
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure extraction of the REMOVE_REMINDER resolution logic
// (mirrors the implementation in useAIActions.ts exactly)
// ---------------------------------------------------------------------------

interface Reminder {
  id: string;
  medicineName: string;
}

interface RemoveReminderPayload {
  id?: string;
  medicineName?: string;
}

/**
 * Resolves the target reminder ID for a REMOVE_REMINDER action.
 * Returns the resolved ID, or throws a descriptive error when no match is found.
 *
 * This is the pure logic extracted from the REMOVE_REMINDER case in
 * dispatchAIAction — tested here without React/Firebase dependencies.
 */
function resolveRemoveReminderTarget(
  payload: RemoveReminderPayload,
  reminders: Reminder[]
): string {
  let targetId = payload.id;

  // Fuzzy fallback: if id is absent, search by medicineName (case-insensitive)
  if (!targetId && payload.medicineName) {
    const match = reminders.find(
      (r) => r.medicineName.toLowerCase() === payload.medicineName!.toLowerCase()
    );
    if (match) targetId = match.id;
  }

  if (!targetId) {
    throw new Error(
      `Could not find a reminder for ${
        payload.medicineName || "the specified medicine"
      }`
    );
  }

  return targetId;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a non-empty alphanumeric string (safe medicine names) */
const medicineNameArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,29}$/)
  .filter((s) => s.trim().length > 0);

/** Generates a Firestore-like document ID */
const docIdArb = fc.stringMatching(/^[A-Za-z0-9]{10,20}$/);

/** Generates a single Reminder object */
const reminderArb = fc.record({
  id: docIdArb,
  medicineName: medicineNameArb,
});

/** Generates an array of reminders with unique medicine names */
const uniqueRemindersArb = fc
  .array(reminderArb, { minLength: 1, maxLength: 20 })
  .map((reminders) => {
    // Deduplicate by medicineName (case-insensitive) to ensure unique matches
    const seen = new Set<string>();
    return reminders.filter((r) => {
      const key = r.medicineName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })
  .filter((reminders) => reminders.length > 0);

// ---------------------------------------------------------------------------
// Property 4: REMOVE_REMINDER fuzzy match correctness
//
// For any reminders array and any medicineName that matches exactly one
// reminder (case-insensitively), the handler must resolve to that reminder's
// id — regardless of whether payload.id is present.
//
// Validates: Requirements 4.1
// ---------------------------------------------------------------------------

describe("Property 4: REMOVE_REMINDER fuzzy match correctness", () => {
  it(
    "resolves to the correct id when medicineName matches exactly one reminder (no payload.id)",
    () => {
      fc.assert(
        fc.property(uniqueRemindersArb, (reminders) => {
          // Pick a random reminder from the array as the target
          const target = reminders[Math.floor(Math.random() * reminders.length)];

          const resolvedId = resolveRemoveReminderTarget(
            { medicineName: target.medicineName },
            reminders
          );

          expect(resolvedId).toBe(target.id);
        }),
        { numRuns: 200 }
      );
    }
  );

  it(
    "resolves correctly when medicineName is provided in a different case (case-insensitive match)",
    () => {
      fc.assert(
        fc.property(uniqueRemindersArb, (reminders) => {
          const target = reminders[0];

          // Test with UPPERCASE version of the medicine name
          const upperName = target.medicineName.toUpperCase();
          const resolvedUpper = resolveRemoveReminderTarget(
            { medicineName: upperName },
            reminders
          );
          expect(resolvedUpper).toBe(target.id);

          // Test with lowercase version
          const lowerName = target.medicineName.toLowerCase();
          const resolvedLower = resolveRemoveReminderTarget(
            { medicineName: lowerName },
            reminders
          );
          expect(resolvedLower).toBe(target.id);
        }),
        { numRuns: 200 }
      );
    }
  );

  it(
    "uses payload.id directly when it is present, ignoring medicineName",
    () => {
      fc.assert(
        fc.property(uniqueRemindersArb, docIdArb, (reminders, explicitId) => {
          const target = reminders[0];

          // When payload.id is provided, it should be returned as-is
          const resolvedId = resolveRemoveReminderTarget(
            { id: explicitId, medicineName: target.medicineName },
            reminders
          );

          expect(resolvedId).toBe(explicitId);
        }),
        { numRuns: 200 }
      );
    }
  );

  it(
    "resolves to the matching reminder's id across all positions in the array",
    () => {
      fc.assert(
        fc.property(
          uniqueRemindersArb,
          fc.integer({ min: 0, max: 19 }),
          (reminders, indexHint) => {
            const index = indexHint % reminders.length;
            const target = reminders[index];

            const resolvedId = resolveRemoveReminderTarget(
              { medicineName: target.medicineName },
              reminders
            );

            expect(resolvedId).toBe(target.id);
          }
        ),
        { numRuns: 200 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 5: REMOVE_REMINDER fails descriptively when no match exists
//
// For any reminders array and any medicineName that does NOT match any
// reminder (case-insensitively), and when payload.id is also absent,
// the handler must throw an Error whose message contains the medicineName.
//
// Validates: Requirements 4.2
// ---------------------------------------------------------------------------

describe("Property 5: REMOVE_REMINDER fails descriptively when no match exists", () => {
  it(
    "throws an Error containing the medicineName when no reminder matches",
    () => {
      fc.assert(
        fc.property(
          uniqueRemindersArb,
          medicineNameArb,
          (reminders, candidateName) => {
            // Ensure candidateName does NOT match any existing reminder
            const existingNames = new Set(
              reminders.map((r) => r.medicineName.toLowerCase())
            );
            // Skip this run if the candidate accidentally matches an existing name
            fc.pre(!existingNames.has(candidateName.toLowerCase()));

            expect(() =>
              resolveRemoveReminderTarget(
                { medicineName: candidateName },
                reminders
              )
            ).toThrow(candidateName);
          }
        ),
        { numRuns: 200 }
      );
    }
  );

  it(
    "throws an Error (not a non-Error value) when no match is found",
    () => {
      fc.assert(
        fc.property(
          uniqueRemindersArb,
          medicineNameArb,
          (reminders, candidateName) => {
            const existingNames = new Set(
              reminders.map((r) => r.medicineName.toLowerCase())
            );
            fc.pre(!existingNames.has(candidateName.toLowerCase()));

            let thrown: unknown;
            try {
              resolveRemoveReminderTarget(
                { medicineName: candidateName },
                reminders
              );
            } catch (e) {
              thrown = e;
            }

            expect(thrown).toBeInstanceOf(Error);
          }
        ),
        { numRuns: 200 }
      );
    }
  );

  it(
    "throws when both payload.id and medicineName are absent",
    () => {
      fc.assert(
        fc.property(uniqueRemindersArb, (reminders) => {
          expect(() =>
            resolveRemoveReminderTarget({}, reminders)
          ).toThrow();
        }),
        { numRuns: 100 }
      );
    }
  );

  it(
    "throws when reminders array is empty and medicineName is provided",
    () => {
      fc.assert(
        fc.property(medicineNameArb, (medicineName) => {
          expect(() =>
            resolveRemoveReminderTarget({ medicineName }, [])
          ).toThrow(medicineName);
        }),
        { numRuns: 100 }
      );
    }
  );

  it(
    "error message contains the medicineName for any non-matching name",
    () => {
      fc.assert(
        fc.property(
          uniqueRemindersArb,
          medicineNameArb,
          (reminders, candidateName) => {
            const existingNames = new Set(
              reminders.map((r) => r.medicineName.toLowerCase())
            );
            fc.pre(!existingNames.has(candidateName.toLowerCase()));

            let errorMessage = "";
            try {
              resolveRemoveReminderTarget(
                { medicineName: candidateName },
                reminders
              );
            } catch (e) {
              errorMessage = (e as Error).message;
            }

            expect(errorMessage).toContain(candidateName);
          }
        ),
        { numRuns: 200 }
      );
    }
  );
});
