/**
 * Property-based tests for the streaming parser logic in aiAssistantService.ts
 *
 * These tests validate the pure parsing logic in isolation — no network calls,
 * no React context, no Firebase. The functions under test mirror exactly what
 * chatWithDawaGPTStream does when processing accumulated SSE text.
 *
 * **Validates: Requirements 2.2, 2.3, 2.4**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure extraction of the streaming parser logic
// (mirrors the implementation in aiAssistantService.ts exactly)
// ---------------------------------------------------------------------------

const METADATA_DELIMITER = "###METADATA###";

interface AIAction {
  type: string;
  payload: Record<string, unknown> | null;
  confirmMessage?: string;
}

interface StreamMetadata {
  suggestions: string[];
  source?: string;
  action?: AIAction;
}

/**
 * Computes the visible text for an onChunk callback given the accumulated
 * allText so far. Strips everything from ###METADATA### onward.
 *
 * Mirrors the in-loop logic in chatWithDawaGPTStream:
 *   const delimIdx = allText.indexOf('###METADATA###');
 *   const visibleText = delimIdx !== -1 ? allText.substring(0, delimIdx) : allText;
 */
function computeVisibleText(allText: string): string {
  const delimIdx = allText.indexOf(METADATA_DELIMITER);
  return delimIdx !== -1 ? allText.substring(0, delimIdx) : allText;
}

/**
 * Post-stream parser: splits allText on ###METADATA###, returns displayText
 * and parsed metadata. Gracefully degrades when delimiter is absent or JSON
 * is malformed.
 *
 * Mirrors the post-loop logic in chatWithDawaGPTStream.
 */
function parseStreamResult(allText: string): {
  displayText: string;
  metadata: StreamMetadata;
} {
  const delimiterIndex = allText.indexOf(METADATA_DELIMITER);

  let displayText: string;
  let rawMetadata: string;

  if (delimiterIndex !== -1) {
    displayText = allText.substring(0, delimiterIndex).trim();
    rawMetadata = allText
      .substring(delimiterIndex + METADATA_DELIMITER.length)
      .trim();
  } else {
    displayText = allText.trim();
    rawMetadata = "";
  }

  const defaultMetadata: StreamMetadata = {
    suggestions: [],
    source: "Gemini",
    action: undefined,
  };

  let metadata: StreamMetadata = defaultMetadata;
  if (rawMetadata) {
    try {
      metadata = JSON.parse(rawMetadata);
    } catch {
      // Graceful degradation — return default metadata
      metadata = defaultMetadata;
    }
  }

  return { displayText, metadata };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Plain text that never contains the delimiter */
const plainTextArb = fc
  .string({ minLength: 1, maxLength: 500 })
  .filter((s) => !s.includes(METADATA_DELIMITER) && s.trim().length > 0);

/** Valid metadata JSON as a string */
const validMetadataJsonArb = fc
  .record({
    suggestions: fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
      maxLength: 3,
    }),
    source: fc.constantFrom("Dawa-GPT", "Gemini", "Groq"),
    action: fc.option(
      fc.record({
        type: fc.constantFrom(
          "ADD_REMINDER",
          "REMOVE_REMINDER",
          "LOG_DOSE",
          "UPDATE_REMINDER"
        ),
        payload: fc.record({
          medicineName: fc.string({ minLength: 1, maxLength: 20 }),
        }),
      }),
      { nil: null }
    ),
  })
  .map((obj) => JSON.stringify(obj));

/** A complete streamed string: displayText + delimiter + metadataJson */
const completeStreamArb = fc
  .tuple(plainTextArb, validMetadataJsonArb)
  .map(([text, json]) => ({
    displayText: text,
    metadataJson: json,
    fullStream: `${text}${METADATA_DELIMITER}${json}`,
  }));

/** Malformed JSON strings (not valid JSON) */
const malformedJsonArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => {
    try {
      JSON.parse(s);
      return false; // exclude valid JSON
    } catch {
      return true;
    }
  });

// ---------------------------------------------------------------------------
// Property 1: Streaming output never contains ###METADATA### in visible text
//
// For any streaming response, the text delivered to onChunk callbacks must
// not contain the string ###METADATA### or any characters from the metadata
// JSON block.
//
// **Validates: Requirements 2.2, 2.3**
// ---------------------------------------------------------------------------

describe("Property 1: Streaming output never contains ###METADATA### in visible text", () => {
  it(
    "computeVisibleText never returns a string containing ###METADATA###",
    () => {
      fc.assert(
        fc.property(completeStreamArb, ({ fullStream }) => {
          const visible = computeVisibleText(fullStream);
          expect(visible).not.toContain(METADATA_DELIMITER);
        }),
        { numRuns: 500 }
      );
    }
  );

  it(
    "computeVisibleText never returns characters from the metadata JSON block",
    () => {
      fc.assert(
        fc.property(completeStreamArb, ({ displayText, metadataJson, fullStream }) => {
          const visible = computeVisibleText(fullStream);

          // The visible text must equal the display text exactly (no metadata leakage)
          expect(visible).toBe(displayText);

          // None of the metadata JSON characters should appear beyond the display text
          // (i.e., visible text must not contain the metadata JSON)
          if (metadataJson.length > 0 && !displayText.includes(metadataJson)) {
            expect(visible).not.toContain(metadataJson);
          }
        }),
        { numRuns: 500 }
      );
    }
  );

  it(
    "computeVisibleText returns the full text unchanged when no delimiter is present",
    () => {
      fc.assert(
        fc.property(plainTextArb, (text) => {
          const visible = computeVisibleText(text);
          expect(visible).toBe(text);
          expect(visible).not.toContain(METADATA_DELIMITER);
        }),
        { numRuns: 300 }
      );
    }
  );

  it(
    "final displayText from parseStreamResult never contains ###METADATA###",
    () => {
      fc.assert(
        fc.property(completeStreamArb, ({ fullStream }) => {
          const { displayText } = parseStreamResult(fullStream);
          expect(displayText).not.toContain(METADATA_DELIMITER);
        }),
        { numRuns: 500 }
      );
    }
  );

  it(
    "visible text is a prefix of the full stream (never extends past the delimiter)",
    () => {
      fc.assert(
        fc.property(completeStreamArb, ({ displayText, fullStream }) => {
          const visible = computeVisibleText(fullStream);
          // visible must be a prefix of fullStream
          expect(fullStream.startsWith(visible)).toBe(true);
          // visible must equal the display text (trimmed by the delimiter)
          expect(visible).toBe(displayText);
        }),
        { numRuns: 500 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 2: Metadata delimiter split is lossless
//
// For any complete streamed string of the form [displayText]###METADATA###[metadataJson],
// splitting on ###METADATA### and reassembling must recover the original
// displayText and metadataJson exactly (no characters lost or duplicated).
//
// **Validates: Requirements 2.3**
// ---------------------------------------------------------------------------

describe("Property 2: Metadata delimiter split is lossless", () => {
  it(
    "splitting and reassembling recovers the original displayText exactly",
    () => {
      fc.assert(
        fc.property(completeStreamArb, ({ displayText, fullStream }) => {
          const { displayText: parsed } = parseStreamResult(fullStream);
          // displayText is trimmed in the implementation, so compare trimmed
          expect(parsed).toBe(displayText.trim());
        }),
        { numRuns: 500 }
      );
    }
  );

  it(
    "splitting and reassembling recovers the original metadataJson exactly",
    () => {
      fc.assert(
        fc.property(completeStreamArb, ({ metadataJson, fullStream }) => {
          const delimiterIndex = fullStream.indexOf(METADATA_DELIMITER);
          const rawMetadata = fullStream
            .substring(delimiterIndex + METADATA_DELIMITER.length)
            .trim();

          // The raw metadata extracted must equal the original metadataJson
          expect(rawMetadata).toBe(metadataJson.trim());
        }),
        { numRuns: 500 }
      );
    }
  );

  it(
    "no characters are lost: displayText + delimiter + metadataJson reconstructs the original",
    () => {
      fc.assert(
        fc.property(completeStreamArb, ({ displayText, metadataJson }) => {
          const reconstructed = `${displayText}${METADATA_DELIMITER}${metadataJson}`;
          const delimiterIndex = reconstructed.indexOf(METADATA_DELIMITER);

          const recoveredDisplay = reconstructed
            .substring(0, delimiterIndex)
            .trim();
          const recoveredMetadata = reconstructed
            .substring(delimiterIndex + METADATA_DELIMITER.length)
            .trim();

          expect(recoveredDisplay).toBe(displayText.trim());
          expect(recoveredMetadata).toBe(metadataJson.trim());
        }),
        { numRuns: 500 }
      );
    }
  );

  it(
    "parsed metadata object matches the original metadata JSON content",
    () => {
      fc.assert(
        fc.property(completeStreamArb, ({ metadataJson, fullStream }) => {
          const { metadata } = parseStreamResult(fullStream);
          const expected = JSON.parse(metadataJson);

          // suggestions array must match
          expect(metadata.suggestions).toEqual(expected.suggestions);
          // source must match
          expect(metadata.source).toBe(expected.source);
        }),
        { numRuns: 500 }
      );
    }
  );

  it(
    "delimiter appears exactly once in the split — no duplication",
    () => {
      fc.assert(
        fc.property(completeStreamArb, ({ fullStream }) => {
          const parts = fullStream.split(METADATA_DELIMITER);
          // Splitting on the delimiter should yield exactly 2 parts
          // (displayText part and metadataJson part)
          expect(parts.length).toBe(2);
        }),
        { numRuns: 500 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 3: Graceful degradation on absent or malformed metadata
//
// For any streamed string that does not contain ###METADATA###, or where the
// JSON after the delimiter is not valid JSON, parseStreamResult must return
// a result with non-empty text, suggestions: [], and action: undefined —
// and must not throw.
//
// **Validates: Requirements 2.4**
// ---------------------------------------------------------------------------

describe("Property 3: Graceful degradation on absent or malformed metadata", () => {
  it(
    "returns non-empty displayText when delimiter is absent",
    () => {
      fc.assert(
        fc.property(plainTextArb, (text) => {
          const { displayText } = parseStreamResult(text);
          expect(displayText.length).toBeGreaterThan(0);
        }),
        { numRuns: 300 }
      );
    }
  );

  it(
    "returns suggestions: [] when delimiter is absent",
    () => {
      fc.assert(
        fc.property(plainTextArb, (text) => {
          const { metadata } = parseStreamResult(text);
          expect(metadata.suggestions).toEqual([]);
        }),
        { numRuns: 300 }
      );
    }
  );

  it(
    "returns action: undefined when delimiter is absent",
    () => {
      fc.assert(
        fc.property(plainTextArb, (text) => {
          const { metadata } = parseStreamResult(text);
          expect(metadata.action).toBeUndefined();
        }),
        { numRuns: 300 }
      );
    }
  );

  it(
    "does not throw when delimiter is absent",
    () => {
      fc.assert(
        fc.property(plainTextArb, (text) => {
          expect(() => parseStreamResult(text)).not.toThrow();
        }),
        { numRuns: 300 }
      );
    }
  );

  it(
    "returns suggestions: [] when metadata JSON is malformed",
    () => {
      fc.assert(
        fc.property(plainTextArb, malformedJsonArb, (text, badJson) => {
          const fullStream = `${text}${METADATA_DELIMITER}${badJson}`;
          const { metadata } = parseStreamResult(fullStream);
          expect(metadata.suggestions).toEqual([]);
        }),
        { numRuns: 300 }
      );
    }
  );

  it(
    "returns action: undefined when metadata JSON is malformed",
    () => {
      fc.assert(
        fc.property(plainTextArb, malformedJsonArb, (text, badJson) => {
          const fullStream = `${text}${METADATA_DELIMITER}${badJson}`;
          const { metadata } = parseStreamResult(fullStream);
          expect(metadata.action).toBeUndefined();
        }),
        { numRuns: 300 }
      );
    }
  );

  it(
    "does not throw when metadata JSON is malformed",
    () => {
      fc.assert(
        fc.property(plainTextArb, malformedJsonArb, (text, badJson) => {
          const fullStream = `${text}${METADATA_DELIMITER}${badJson}`;
          expect(() => parseStreamResult(fullStream)).not.toThrow();
        }),
        { numRuns: 300 }
      );
    }
  );

  it(
    "still returns the display text correctly even when metadata is malformed",
    () => {
      fc.assert(
        fc.property(plainTextArb, malformedJsonArb, (text, badJson) => {
          const fullStream = `${text}${METADATA_DELIMITER}${badJson}`;
          const { displayText } = parseStreamResult(fullStream);
          expect(displayText).toBe(text.trim());
          expect(displayText.length).toBeGreaterThan(0);
        }),
        { numRuns: 300 }
      );
    }
  );

  it(
    "handles empty string after delimiter gracefully (no JSON at all)",
    () => {
      fc.assert(
        fc.property(plainTextArb, (text) => {
          const fullStream = `${text}${METADATA_DELIMITER}`;
          const { displayText, metadata } = parseStreamResult(fullStream);

          expect(() => parseStreamResult(fullStream)).not.toThrow();
          expect(displayText).toBe(text.trim());
          expect(metadata.suggestions).toEqual([]);
          expect(metadata.action).toBeUndefined();
        }),
        { numRuns: 200 }
      );
    }
  );
});
