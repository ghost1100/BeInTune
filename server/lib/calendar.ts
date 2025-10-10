import { google } from "googleapis";

let authClient: any = null;
let serviceAccount: any = null;

async function initAuth() {
  if (authClient) return authClient;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON env var");
  try {
    serviceAccount = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    // Try to be tolerant of env values that contain actual newlines which break JSON.parse
    try {
      const fixed = String(raw).replace(/\r?\n/g, "\\n");
      serviceAccount = JSON.parse(fixed);
      console.warn("Parsed GOOGLE_SERVICE_ACCOUNT_JSON via newline-escape fallback");
    } catch (err2) {
      console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON (raw length", String(raw).length, ")", err);
      throw err;
    }
  }

  authClient = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  try {
    // Ensure the JWT obtains an access token before use
    await (authClient as any).authorize();
    console.log(
      "Google service account authorized:",
      serviceAccount.client_email,
    );
  } catch (err) {
    console.error("Failed to authorize Google service account:", err);
    throw err;
  }
  return authClient;
}

export async function createCalendarEvent(opts: {
  summary: string;
  description?: string;
  startDateTime: string; // ISO
  endDateTime: string; // ISO
  timezone?: string;
  attendees?: string[];
}) {
  try {
    const auth = await initAuth();
    const calendar = google.calendar({ version: "v3", auth });
    const calendarId =
      process.env.GOOGLE_CALENDAR_ID || serviceAccount.client_email;
    const timezone = process.env.GOOGLE_CALENDAR_TIMEZONE || "Europe/London";

    const event: any = {
      summary: opts.summary,
      description: opts.description || "",
      start: { dateTime: opts.startDateTime, timeZone: timezone },
      end: { dateTime: opts.endDateTime, timeZone: timezone },
    };
    if (opts.attendees && opts.attendees.length) {
      event.attendees = opts.attendees.map((email) => ({ email }));
    }

    console.log("Creating calendar event", {
      calendarId,
      timezone,
      eventSummary: event.summary,
      attendees: event.attendees,
    });
    const res = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    console.log(
      "Calendar event inserted, status:",
      (res && (res as any).status) || "unknown",
      "id:",
      res && (res as any).data && (res as any).data.id,
    );
    return res.data;
  } catch (err) {
    console.error("createCalendarEvent error:", err);
    throw err;
  }
}
