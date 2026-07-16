import { Reminder } from "../contexts/AppContext";
import { auth } from "../lib/firebase";

const DAYS_MAP = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

// ─── Utility ──────────────────────────────────────────────────────────────────

function getLocalISOString(date: Date): string {
  const tzOffset = -date.getTimezoneOffset();
  const diff = tzOffset >= 0 ? "+" : "-";
  const pad = (num: number) => String(num).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes()) +
    ":" +
    pad(date.getSeconds()) +
    diff +
    pad(Math.floor(Math.abs(tzOffset) / 60)) +
    ":" +
    pad(Math.abs(tzOffset) % 60)
  );
}

export function getRecurrenceRule(reminder: Reminder): string[] | undefined {
  if (reminder.repeatSchedule === "once") {
    return undefined;
  }

  let rule = "FREQ=DAILY";

  if (reminder.repeatSchedule === "weekly") {
    if (reminder.repeatDays && reminder.repeatDays.length > 0) {
      const days = reminder.repeatDays.map((d) => DAYS_MAP[d]).join(",");
      rule = `FREQ=WEEKLY;BYDAY=${days}`;
    } else {
      const dayIndex = new Date(reminder.createdAt).getDay();
      rule = `FREQ=WEEKLY;BYDAY=${DAYS_MAP[dayIndex]}`;
    }
  } else if (
    reminder.repeatSchedule === "custom" &&
    reminder.repeatDays &&
    reminder.repeatDays.length > 0
  ) {
    const days = reminder.repeatDays.map((d) => DAYS_MAP[d]).join(",");
    rule = `FREQ=WEEKLY;BYDAY=${days}`;
  }

  return [`RRULE:${rule}`];
}

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  // 32 random bytes → 43-char base64url verifier
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64UrlEncode(randomBytes.buffer);

  // SHA-256 of the verifier → challenge
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
  const codeChallenge = base64UrlEncode(digest);

  return { codeVerifier, codeChallenge };
}

// ─── GIS script loader ────────────────────────────────────────────────────────

let gisLoadPromise: Promise<void> | null = null;

function loadGISScript(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (typeof window.google?.accounts?.oauth2 !== "undefined") {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services script."));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

// ─── Main: Authorization Code + PKCE via GIS ─────────────────────────────────

/**
 * Opens the GIS consent popup, exchanges the authorization code server-side
 * (keeping client_secret off the browser), and returns a fresh access token.
 *
 * Replaces the old `requestGoogleAccess` implicit-flow function.
 */
export async function requestGoogleAccessGIS(
  clientId: string,
  loginHint?: string
): Promise<{ accessToken: string; expiresIn: number }> {
  await loadGISScript();

  const { codeVerifier, codeChallenge } = await generatePKCE();

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.events",
      ux_mode: "popup",
      hint: loginHint,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
      callback: async (response: { code?: string; error?: string }) => {
        if (response.error || !response.code) {
          reject(new Error(response.error || "No authorization code returned."));
          return;
        }

        try {
          // Exchange code server-side — client_secret stays on the backend
          const firebaseToken = await auth.currentUser?.getIdToken();
          if (!firebaseToken) {
            reject(new Error("You must be signed in to connect Google Calendar."));
            return;
          }

          const apiBase =
            import.meta.env.VITE_API_URL?.replace(/\/v1$/, "") ||
            (window.location.hostname === "localhost"
              ? "http://localhost:5000/api"
              : "https://dawa-lens.onrender.com/api");

          const exchangeRes = await fetch(`${apiBase}/v1/google/exchange`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${firebaseToken}`,
            },
            body: JSON.stringify({
              code: response.code,
              codeVerifier,
              // GIS popup mode doesn't redirect — use a postMessage origin sentinel
              redirectUri: `${window.location.origin}/google-callback.html`,
            }),
          });

          if (!exchangeRes.ok) {
            const err = await exchangeRes.json().catch(() => ({}));
            reject(new Error(err.message || "Token exchange failed on server."));
            return;
          }

          const data = await exchangeRes.json();
          resolve({ accessToken: data.accessToken, expiresIn: data.expiresIn });
        } catch (err: any) {
          reject(err);
        }
      },
    });

    client.requestCode();
  });
}

/**
 * Silently refreshes the Google Calendar access token via the backend.
 * Returns null if no refresh token is stored (user needs to reconnect).
 */
export async function refreshGoogleAccessToken(): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  const firebaseToken = await auth.currentUser?.getIdToken();
  if (!firebaseToken) return null;

  const apiBase =
    import.meta.env.VITE_API_URL?.replace(/\/v1$/, "") ||
    (window.location.hostname === "localhost"
      ? "http://localhost:5000/api"
      : "https://dawa-lens.onrender.com/api");

  const res = await fetch(`${apiBase}/v1/google/refresh`, {
    method: "POST",
    headers: { Authorization: `Bearer ${firebaseToken}` },
  });

  if (!res.ok) {
    if (res.status === 404 || res.status === 401) return null;
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Token refresh failed.");
  }

  return res.json();
}

/**
 * Revokes the stored Google token and removes Firestore data.
 */
export async function disconnectGoogleCalendar(): Promise<void> {
  const firebaseToken = await auth.currentUser?.getIdToken();
  if (!firebaseToken) return;

  const apiBase =
    import.meta.env.VITE_API_URL?.replace(/\/v1$/, "") ||
    (window.location.hostname === "localhost"
      ? "http://localhost:5000/api"
      : "https://dawa-lens.onrender.com/api");

  await fetch(`${apiBase}/v1/google/disconnect`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${firebaseToken}` },
  });
}

// ─── Google Calendar API calls (unchanged) ────────────────────────────────────

async function fetchCalendar(
  url: string,
  method: string,
  token: string,
  body?: any
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function syncReminderToGoogleCalendar(
  reminder: Reminder,
  token: string
): Promise<Record<string, string>> {
  if (!reminder.enabled) {
    await deleteReminderFromGoogleCalendar(reminder, token);
    return {};
  }

  const existingEventIds = reminder.googleEventIds || {};
  const newEventIds: Record<string, string> = {};
  const times = reminder.time
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  for (const timeStr of times) {
    const existingId = existingEventIds[timeStr];

    const start = new Date();
    const [hours, minutes] = timeStr.split(":").map(Number);
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start.getTime() + 15 * 60 * 1000);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const eventBody: any = {
      summary: `💊 Dawa Lens: Take ${reminder.medicineName}`,
      description: `Dose: ${reminder.dose}\nNotes: ${reminder.notes || "None"}\nPatient: ${reminder.patientName || "Self"}\n\nSynced automatically from Dawa Lens.`,
      start: { dateTime: getLocalISOString(start), timeZone: timezone },
      end: { dateTime: getLocalISOString(end), timeZone: timezone },
      recurrence: getRecurrenceRule(reminder),
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 0 }],
      },
    };

    if (existingId) {
      try {
        await fetchCalendar(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingId}`,
          "PUT",
          token,
          eventBody
        );
        newEventIds[timeStr] = existingId;
      } catch (err) {
        console.warn(
          `[googleCalendarService] Failed to update event ${existingId}, creating new one:`,
          err
        );
        const created = await fetchCalendar(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          "POST",
          token,
          eventBody
        );
        newEventIds[timeStr] = created.id;
      }
    } else {
      const created = await fetchCalendar(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        "POST",
        token,
        eventBody
      );
      newEventIds[timeStr] = created.id;
    }
  }

  // Remove events for times that no longer exist in the reminder
  for (const [timeStr, eventId] of Object.entries(existingEventIds)) {
    if (!times.includes(timeStr)) {
      try {
        await fetchCalendar(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
          "DELETE",
          token
        );
      } catch (err) {
        console.warn(`[googleCalendarService] Failed to delete event ${eventId}:`, err);
      }
    }
  }

  return newEventIds;
}

export async function deleteReminderFromGoogleCalendar(
  reminder: Reminder,
  token: string
): Promise<void> {
  const existingEventIds = reminder.googleEventIds || {};
  for (const eventId of Object.values(existingEventIds)) {
    try {
      await fetchCalendar(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        "DELETE",
        token
      );
    } catch (err) {
      console.warn(`[googleCalendarService] Failed to delete event ${eventId}:`, err);
    }
  }
}

export async function deleteEventFromGoogleCalendar(
  eventId: string,
  token: string
): Promise<void> {
  await fetchCalendar(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    "DELETE",
    token
  );
}
