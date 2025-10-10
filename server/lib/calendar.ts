import { google } from "googleapis";

let authClient: any = null;
let serviceAccount: any = null;

async function initAuth() {
  if (authClient) return authClient;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON env var");
  const tryParse = (input: any) => {
    if (!input) throw new Error("Empty GOOGLE_SERVICE_ACCOUNT_JSON");
    if (typeof input === "object") return input;
    const s = String(input);
    const attempts: string[] = [];

    // 1) direct JSON.parse
    try {
      attempts.push("direct JSON.parse");
      return JSON.parse(s);
    } catch (e) {
      // continue
    }

    // 2) raw may contain literal \n sequences that need to be unescaped
    try {
      attempts.push("unescape \\n");
      const unescaped = s.replace(/\\n/g, "\n");
      return JSON.parse(unescaped);
    } catch (e) {
      // continue
    }

    // 3) raw may contain actual newlines which should be escaped
    try {
      attempts.push("escape newlines");
      const escaped = s.replace(/\r?\n/g, "\\n");
      return JSON.parse(escaped);
    } catch (e) {
      // continue
    }

    // 4) raw might be wrapped in quotes (stringified twice)
    try {
      attempts.push("strip wrapping quotes");
      if (s.startsWith('"') && s.endsWith('"')) {
        const stripped = s
          .slice(1, -1)
          .replace(/\\"/g, '"')
          .replace(/\\n/g, "\\n");
        return JSON.parse(stripped);
      }
    } catch (e) {
      // continue
    }

    // 5) try base64 decode
    try {
      attempts.push("base64 decode");
      const decoded = Buffer.from(s, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch (e) {
      // continue
    }

    const err = new Error(
      `Unable to parse GOOGLE_SERVICE_ACCOUNT_JSON. Attempts: ${attempts.join(", ")}`,
    );
    (err as any).details = { attempts, length: s.length };
    throw err;
  };

  try {
    serviceAccount = tryParse(raw);
  } catch (err) {
    console.error(
      "Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON (raw length",
      String(raw).length,
      ")",
      err,
    );
    throw err;
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
