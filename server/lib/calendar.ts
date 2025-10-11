import { google } from "googleapis";
import fs from "fs";

let authClient: any = null;
let serviceAccount: any = null;

async function initAuth() {
  if (authClient) return authClient;
  // Prefer single-line base64 (GOOGLE_CREDS_BASE64) to avoid dashboard truncation; fallback to GOOGLE_SERVICE_ACCOUNT_JSON
  let raw =
    process.env.GOOGLE_CREDS_BASE64 ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    "";
  // For local debugging: if the env var is missing or appears truncated, allow reading from tmp/service-account-full.json
  try {
    if (!raw || raw.length < 2000) {
      const p = "tmp/service-account-full.json";
      if (fs.existsSync(p)) {
        raw = fs.readFileSync(p, "utf8");
        console.log("Loaded service account JSON from", p);
      }
    }
  } catch (e) {
    // ignore
  }
  if (!raw)
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_CREDS_BASE64 env var",
    );
  const tryParse = (input: any) => {
    if (!input) throw new Error("Empty GOOGLE_SERVICE_ACCOUNT_JSON");
    if (typeof input === "object") return input;
    const s = String(input);
    const attempts: string[] = [];

    // 1) try base64 decode first (common when env var is single-line base64)
    try {
      attempts.push("base64 decode");
      const decoded = Buffer.from(s, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch (e) {
      // continue
    }

    // 2) direct JSON.parse
    try {
      attempts.push("direct JSON.parse");
      return JSON.parse(s);
    } catch (e) {
      // continue
    }

    // 3) raw may contain literal \n sequences that need to be unescaped
    try {
      attempts.push("unescape \\n");
      const unescaped = s.replace(/\\n/g, "\n");
      return JSON.parse(unescaped);
    } catch (e) {
      // continue
    }

    // 4) raw may contain actual newlines which should be escaped
    try {
      attempts.push("escape newlines");
      const escaped = s.replace(/\r?\n/g, "\\n");
      return JSON.parse(escaped);
    } catch (e) {
      // continue
    }

    // 5) raw might be wrapped in quotes (stringified twice)
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

    const err = new Error(
      `Unable to parse Google service account JSON. Attempts: ${attempts.join(", ")}`,
    );
    (err as any).details = { attempts, length: s.length };
    throw err;
  };

  try {
    serviceAccount = tryParse(raw);
  } catch (err) {
    console.error(
      "Failed to parse service account JSON (raw length",
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

    // Log which service account and calendar the server will use (safe preview)
    try {
      console.log("Using Google SA", {
        clientEmail: serviceAccount.client_email,
        calendarId:
          process.env.GOOGLE_CALENDAR_ID || serviceAccount.client_email,
        keyPreview: serviceAccount.private_key
          ? serviceAccount.private_key.slice(0, 40).replace(/\r?\n/g, "\\n") +
            "..."
          : undefined,
        rawEnvLength: {
          GOOGLE_SERVICE_ACCOUNT_JSON: (
            process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ""
          ).length,
          GOOGLE_CREDS_BASE64: (process.env.GOOGLE_CREDS_BASE64 || "").length,
        },
      });
    } catch (e) {
      // swallow logging errors to avoid impacting auth flow
      console.warn("Failed to log Google SA preview", e);
    }
  } catch (err) {
    console.error("Failed to authorize Google service account:", err);
    throw err;
  }
  return authClient;
}

export async function createCalendarEvent(opts: {
  summary: string;
  description?: string;
  startDateTime: string; // ISO or local 'YYYY-MM-DDTHH:mm:ss'
  endDateTime: string; // ISO or local
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
    // support recurrence (array of RRULE strings) for recurring events
    if ((opts as any).recurrence) {
      event.recurrence = (opts as any).recurrence;
    }
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

export async function updateRecurringEventUntil(eventId: string, untilIso: string, calendarId?: string) {
  try {
    const auth = await initAuth();
    const calendar = google.calendar({ version: "v3", auth });
    const cid =
      calendarId ||
      process.env.GOOGLE_CALENDAR_ID ||
      serviceAccount.client_email;
    console.log("Updating recurring event UNTIL", { eventId, untilIso, calendarId: cid });
    // fetch existing event
    const getRes = await calendar.events.get({ calendarId: cid, eventId });
    const existing: any = getRes && (getRes as any).data;
    const recurrences: string[] = existing && existing.recurrence ? existing.recurrence : [];
    if (!recurrences.length) {
      throw new Error("Event has no recurrence rules to update");
    }
    const newRecurrences = recurrences.map((r: string) => {
      // Strip leading RRULE: if present
      const prefix = r.startsWith("RRULE:") ? "RRULE:" : "";
      const body = prefix ? r.slice(6) : r;
      const parts = body.split(";").filter(Boolean);
      // remove existing UNTIL
      const filtered = parts.filter((p) => !p.startsWith("UNTIL="));
      filtered.push(`UNTIL=${untilIso.replace(/[-:.]/g, "")}`);
      return `${prefix}${filtered.join(";")}`;
    });
    const patchRes = await calendar.events.patch({
      calendarId: cid,
      eventId,
      requestBody: { recurrence: newRecurrences },
    });
    console.log("Recurring event patched", { status: (patchRes as any).status });
    return true;
  } catch (err) {
    console.error("updateRecurringEventUntil error:", err);
    throw err;
  }
}

export async function deleteRecurringInstance(eventId: string, instanceStartIso: string, calendarId?: string) {
  try {
    const auth = await initAuth();
    const calendar = google.calendar({ version: "v3", auth });
    const cid =
      calendarId ||
      process.env.GOOGLE_CALENDAR_ID ||
      serviceAccount.client_email;
    console.log("Deleting recurring instance", { eventId, instanceStartIso, calendarId: cid });
    // list instances around the provided start
    const timeMin = instanceStartIso;
    // small window to ensure match
    const endDate = new Date(instanceStartIso);
    endDate.setSeconds(endDate.getSeconds() + 1);
    const timeMax = endDate.toISOString();
    const res = await calendar.events.instances({ calendarId: cid, eventId, timeMin, timeMax });
    const items: any[] = (res && (res as any).data && (res as any).data.items) || [];
    let found: any = null;
    for (const it of items) {
      const s = it.start && (it.start.dateTime || it.start.date);
      if (!s) continue;
      // compare ISO start (allow small differences)
      if (s.startsWith(instanceStartIso.slice(0, 19))) {
        found = it;
        break;
      }
      // as fallback, compare by timeMin/timeMax filter
      try {
        const si = new Date(s).toISOString();
        if (si === instanceStartIso) {
          found = it;
          break;
        }
      } catch (e) {}
    }
    if (!found) {
      // try to find closest by matching date portion
      const targetDate = instanceStartIso.slice(0, 10);
      found = items.find((it) => (it.start && (it.start.dateTime || it.start.date) || "").startsWith(targetDate));
    }
    if (!found) {
      console.warn("No instance found to delete for", eventId, instanceStartIso);
      return false;
    }
    await calendar.events.delete({ calendarId: cid, eventId: found.id });
    console.log("Deleted instance", found.id);
    return true;
  } catch (err) {
    console.error("deleteRecurringInstance error:", err);
    throw err;
  }
}

export async function deleteCalendarEvent(
  eventId: string,
  calendarId?: string,
) {
  try {
    const auth = await initAuth();
    const calendar = google.calendar({ version: "v3", auth });
    const cid =
      calendarId ||
      process.env.GOOGLE_CALENDAR_ID ||
      serviceAccount.client_email;
    console.log("Deleting calendar event", { eventId, calendarId: cid });
    await calendar.events.delete({ calendarId: cid, eventId });
    return true;
  } catch (err) {
    console.error("deleteCalendarEvent error:", err);
    throw err;
  }
}
