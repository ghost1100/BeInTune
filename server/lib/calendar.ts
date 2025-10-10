import { google } from "googleapis";

let authClient: any = null;
let serviceAccount: any = null;

function initAuth() {
  if (authClient) return authClient;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON env var");
  serviceAccount = typeof raw === "string" ? JSON.parse(raw) : raw;
  authClient = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
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
    const auth = initAuth();
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
    const res = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    return res.data;
  } catch (err) {
    console.error("createCalendarEvent error:", err);
    throw err;
  }
}
