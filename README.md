In Tune Music Tuition — Project README

Overview

This repository implements In Tune Music Tuition — a full-stack web app for music lesson bookings, community discussion, messaging, and admin tools. It includes a Vite + React frontend and an Express backend with Postgres (Neon) database.

Key features

- Public site pages: Home, Lessons, Teachers, Pricing, Contact, About.
- Booking system: book free trial lessons via a BookingForm and admin-managed booking slots.
- Authentication: server-side session authentication with token fallback; admin and student roles supported.
- Admin dashboard: manage teachers, students, site content, newsletters, security settings, and view reports.
- Student dashboard: view upcoming lessons, discussion, chats, and bookings.
- Real-time chats: WebSocket-powered chat system with one-to-one messages between users, admin pinned chat, message reactions, editing, and deletion.
- Notifications: in-app notification bell + inbox; server saves notifications to DB and pushes via WebSocket.
- Discussion feed: public posts with moderation support.
- Email and calendar integration: server-side mailer with SMTP (Gmail) support and Google Calendar (service account) integration for booking events.

Development commands

- pnpm dev # Start dev server (client + server)
- pnpm build # Production build (client + server)
- pnpm start # Start production server
- pnpm test # Run Vitest tests
- pnpm typecheck # TypeScript validation

New integrations and configuration

Email (SMTP / Gmail)

This project now supports sending mail through SMTP (nodemailer) with an optional SendGrid fallback. A helper lives at server/lib/mailer.ts which will use SMTP when SMTP\_\* environment variables are provided.

Required environment variables for Gmail SMTP:

- SMTP_HOST (e.g. smtp.gmail.com)
- SMTP_PORT (e.g. 587)
- SMTP_USER (Gmail address)
- SMTP_PASS (Gmail app password)
- FROM_EMAIL (address used in From header)

Important security notes:

- Use a Gmail "App password" (from Google account security) rather than your account password.
- Rotate any keys if they are exposed and never commit secrets to source control.

Google Calendar (service account)

Bookings can create events in a shared Google Calendar using a Google service account. The helper is server/lib/calendar.ts and expects the service account JSON and the calendar ID.

Required environment variables (service account flow):

- GOOGLE_SERVICE_ACCOUNT_JSON (the JSON content of the service account key) OR
- GOOGLE_CREDS_BASE64 (preferred — single-line base64 of the JSON to avoid dashboard truncation)
- GOOGLE_CALENDAR_ID (the calendar ID to write events into; can be the service account email or a calendar you have shared with the service account)
- GOOGLE_CALENDAR_TIMEZONE (optional, defaults to Europe/London)

Important: share the target calendar with the service account email (Viewer/Editor as appropriate). For a regular consumer Google Calendar, open calendar settings -> Share with specific people and add the service account email (e.g. intune@calendar-access-474717.iam.gserviceaccount.com) with Editor permissions.

Files added / updated

- server/lib/mailer.ts — new mailer helper (nodemailer + SendGrid fallback)
- server/lib/calendar.ts — Google Calendar helper (service account JWT). It now prefers GOOGLE_CREDS_BASE64 and includes safer parsing and diagnostic logs.
- server/routes/bookings.ts — creates calendar events after bookings and returns student phone/instruments in bookings API
- server/routes/newsletters.ts, server/routes/auth.ts — updated to use mailer helper
- client/pages/Admin.tsx — booking details modal now shows student phone and instruments when available
- package.json — nodemailer and googleapis dependencies added

How to test email + calendar locally (example)

1. Ensure environment variables are set (see list above) and run:

   pnpm install
   pnpm dev

2. Create a test slot (replace HOST with your dev server URL or use the running preview) using the API:

   curl -s -X POST "$HOST/api/admin/slots" -H "Content-Type: application/json" -d '{"slot_date":"2025-10-10","slot_time":"10:00","duration_minutes":30}'

3. Create a booking to trigger email + calendar event (replace SLOT_ID with the id returned in step 2):

   curl -s -X POST "$HOST/api/admin/bookings" -H "Content-Type: application/json" -d '{"slot_id":SLOT_ID,"lesson_type":"Guitar","name":"Test User","email":"you@example.com","phone":"+447359224618"}'

4. Verify results:

- Email: check the inbox for FROM_EMAIL and the recipient address.
- Calendar: open the calendar specified by GOOGLE_CALENDAR_ID and confirm an event at the booked time.

Troubleshooting: Calendar integration issues & recommendations

Summary of findings

- Root causes observed while debugging calendar writes:
  - The service account JSON supplied via environment variables was repeatedly truncated or corrupted by the deployment/dashboard input (common in web UIs that truncate long values).
  - In some cases the private_key became URL-encoded or the JSON contained escaped sequences, causing JWT authorization to fail with 401/decoding errors.
  - Service accounts must have the target calendar shared with them (Editor) for writes; otherwise the API returns 403 (insufficientPermissions) or 404 (notFound for calendarId).

What I changed in the codebase

- server/lib/calendar.ts now:
  - Prefers GOOGLE_CREDS_BASE64 (single-line base64 of the JSON) and falls back to GOOGLE_SERVICE_ACCOUNT_JSON.
  - Attempts parsing strategies (base64 decode, direct JSON.parse, unescape sequences) and reports which attempts ran.
  - Logs a concise, safe preview after authorization: client email, calendarId used, and environment variable lengths for diagnostics.

Quick actionable fixes (apply in order)

1. Use base64 env var (recommended for Netlify/Vercel)
   - Locally: base64 -w 0 service-account.json > service-account.b64
   - In deployment UI: set GOOGLE_CREDS_BASE64 to the contents of service-account.b64 (single line)
   - In server code (already implemented): credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDS_BASE64, 'base64').toString('utf8'))

2. Alternatively, set raw JSON as an environment variable only if your provider preserves multiline values (many DO NOT). If the field truncates, switch to base64 or use a secret manager/file.

3. File path option (safer): Upload the JSON to the server filesystem outside source control and set GOOGLE_APPLICATION_CREDENTIALS to that file path, or use your provider's secret manager to mount the file.

4. Share calendar & permissions:
   - Open Google Calendar (sanddtuition@gmail.com) -> Settings and sharing -> Share with specific people -> add the service account email (intune@calendar-access-474717.iam.gserviceaccount.com) and give Editor.

5. Remove attendees in test requests (service accounts cannot invite attendees without domain-wide delegation). The server code will include attendees only if provided; for debugging, try creating events without attendees.

How to reproduce and capture errors (what to paste here)

- Run the local auth test (we added tmp/auth-test.mjs):

  node tmp/auth-test.mjs
  - On success you will see: ✅ Created: https://calendar.google.com/calendar/event?eid=...
  - On failure paste the full ❌ Error: output here.

- Run the list test (tmp/list-events.mjs) to verify events visible via API.

- Server log lines to capture (in this exact order):
  - "Google service account authorized: <client_email>"
  - "Using Google SA" (contains clientEmail, calendarId and raw environment length)
  - "Creating calendar event" (shows calendarId and eventSummary)
  - "Calendar event inserted" or "createCalendarEvent error:" (copy these lines)

Common error signatures and meaning

- 401 / invalid credentials:
  - Private key format is invalid or missing newlines; the JSON was parsed incorrectly. Fix by providing the correct JSON (base64-encoded or raw) and ensure private_key contains \n sequences.

- 403 / insufficientPermissions:
  - The service account authenticated but doesn't have Editor access to the calendar. Share the calendar with the service account.

- 404 / notFound:
  - The calendarId is wrong or the service account cannot see the calendar (not shared or typo in id).

- Event created but not visible in UI:
  - Ensure you're viewing the correct calendar (check "Other calendars" where the service account-created events may appear). Use the event HTML link returned by the API to confirm.

Developer utilities added for debugging

- test-json.js — checks parsing of GOOGLE_CREDS_BASE64 / GOOGLE_SERVICE_ACCOUNT_JSON
- tmp/auth-test.mjs — small auth + insert test for quick validation
- tmp/list-events.mjs — list events in the target calendar (useful to confirm writes)

Operational recommendations

- Prefer GOOGLE_CREDS_BASE64 in the host environment settings (single-line base64). Most provider dashboards accept this reliably.
- Keep secrets in your provider secret manager; avoid pasting raw multiline secrets into web forms that may truncate or escape characters.
- Add a lightweight admin UI that shows recent events created via the API (id, summary, status) — this helps troubleshooting without having to query Google manually.

Next steps I can implement for you

- Add an Admin UI page that lists events created by the app for a given date range.
- Add a deployment / CI script that injects the service account JSON into the runtime securely (using provider secret managers).
- Implement per-teacher calendar support and a calendar-connection flow in Admin.

If you want me to update any of the above (add the Admin event list, wire CI secrets, or implement per-teacher calendars), tell me which and I’ll add it to the todo list and implement.
