import { Reminder } from "../contexts/AppContext";

const DAYS_MAP = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function getLocalISOString(date: Date): string {
  const tzOffset = -date.getTimezoneOffset();
  const diff = tzOffset >= 0 ? '+' : '-';
  const pad = (num: number) => String(num).padStart(2, '0');
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds()) +
    diff + pad(Math.floor(Math.abs(tzOffset) / 60)) +
    ':' + pad(Math.abs(tzOffset) % 60);
}

export function getRecurrenceRule(reminder: Reminder): string[] | undefined {
  if (reminder.repeatSchedule === "once") {
    return undefined;
  }

  let rule = "FREQ=DAILY";

  if (reminder.repeatSchedule === "weekly") {
    if (reminder.repeatDays && reminder.repeatDays.length > 0) {
      const days = reminder.repeatDays.map(d => DAYS_MAP[d]).join(",");
      rule = `FREQ=WEEKLY;BYDAY=${days}`;
    } else {
      const dayIndex = new Date(reminder.createdAt).getDay();
      rule = `FREQ=WEEKLY;BYDAY=${DAYS_MAP[dayIndex]}`;
    }
  } else if (reminder.repeatSchedule === "custom" && reminder.repeatDays && reminder.repeatDays.length > 0) {
    const days = reminder.repeatDays.map(d => DAYS_MAP[d]).join(",");
    rule = `FREQ=WEEKLY;BYDAY=${days}`;
  }

  return [`RRULE:${rule}`];
}

export function requestGoogleAccess(clientId: string): Promise<{ accessToken: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    const redirectUri = encodeURIComponent(`${window.location.origin}/google-callback.html`);
    const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.events");
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&prompt=consent`;

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      "google-calendar-auth",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );

    if (!popup) {
      reject(new Error("Popup blocked by browser. Please allow popups for this site."));
      return;
    }

    const messageListener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
        window.removeEventListener("message", messageListener);
        resolve({
          accessToken: event.data.accessToken,
          expiresIn: event.data.expiresIn
        });
      } else if (event.data?.type === "GOOGLE_AUTH_FAILURE") {
        window.removeEventListener("message", messageListener);
        reject(new Error(event.data.error || "Authentication failed"));
      }
    };

    window.addEventListener("message", messageListener);

    const checkClosedInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosedInterval);
        window.removeEventListener("message", messageListener);
        reject(new Error("Sign-in popup closed by user"));
      }
    }, 1000);
  });
}

async function fetchCalendar(
  url: string,
  method: string,
  token: string,
  body?: any
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
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
  const times = reminder.time.split(",").map((t) => t.trim()).filter(Boolean);

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
      start: {
        dateTime: getLocalISOString(start),
        timeZone: timezone
      },
      end: {
        dateTime: getLocalISOString(end),
        timeZone: timezone
      },
      recurrence: getRecurrenceRule(reminder),
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 0 }
        ]
      }
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
        console.warn(`[googleCalendarService] Failed to update event ${existingId}, creating new one:`, err);
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
