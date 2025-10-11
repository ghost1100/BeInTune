Fusion Starter / In Tune Music Tuition

Overview

This repository implements In Tune Music Tuition — a full-stack web app for music lesson bookings, admin management, community discussion and messaging. It includes a Vite + React frontend and an Express backend with Postgres.

Key features

- Admin dashboard: manage teachers, students, schedule, newsletters and booking slots
- Booking system: create slots, book students/guests and send email/calendar notifications
- Google Calendar integration (service account) for booking events, including support for recurring events
- Email sending via SMTP (nodemailer) with SendGrid fallback

Development commands

- pnpm install
- pnpm dev        # Start dev server (client + server)
- pnpm build      # Production build (client + server)
- pnpm start      # Start production server
- pnpm test       # Run Vitest tests
- pnpm typecheck  # TypeScript validation

Environment variables

Required for core functionality:

- DATABASE_URL — Postgres connection string
- FROM_EMAIL — default From address for outgoing mail

SMTP (optional)

- SMTP_HOST (e.g. smtp.gmail.com)
- SMTP_PORT (e.g. 587)
- SMTP_USER
- SMTP_PASS

Google Calendar (service account)

The app can create calendar events using a Google service account.
Recommended: set GOOGLE_CREDS_BASE64 to a single-line base64 encoding of the service account JSON (this avoids dashboard truncation). Alternatively set GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON) only if your env store preserves newlines.

- GOOGLE_CREDS_BASE64 (preferred) OR GOOGLE_SERVICE_ACCOUNT_JSON
- GOOGLE_CALENDAR_ID — calendar id (service account email or a calendar shared with the service account)
- GOOGLE_CALENDAR_TIMEZONE (optional)

Important: share the target calendar with the service account email and give Editor access.

Server helpers

- server/lib/calendar.ts — robust service account parsing + helpers to create, update, and delete calendar events. New functions added for recurring series handling: updateRecurringEventUntil and deleteRecurringInstance.
- server/routes/bookings.ts — booking creation triggers calendar events. DELETE endpoint now accepts a deleteScope parameter: 'single' | 'future' | 'all'.

Recurring bookings and cancellation scopes

- When creating a booking you may pass an RRULE recurrence string (e.g. "RRULE:FREQ=WEEKLY;COUNT=10"). The server will create a single recurring Google Calendar event and store its id in bookings.calendar_event_id and bookings.recurrence_id.
- Deleting a booking supports three scopes (send in request body for DELETE /api/admin/bookings/:id):
  - single — delete only this instance (tries to remove single calendar instance and removes single DB booking)
  - future — truncate recurring event UNTIL just before this instance and remove DB bookings from this date onward
  - all — delete entire recurring series (existing behavior)

Integration test for recurring cancellation

We include a helper script to validate Google Calendar auth and perform a full "future" cancellation flow:

Prerequisites

- Set GOOGLE_CREDS_BASE64 to a single-line base64 of your Google service account JSON (recommended), or place the raw JSON at tmp/service-account-full.json.
- Set GOOGLE_CALENDAR_ID and ensure the service account has Editor access to that calendar.
- Ensure DATABASE_URL points to your Postgres instance and the DB has the project's tables (run migrations / let server apply setup).

Run the integration test (creates a recurring event, inserts test slots+bookings, truncates the recurrence, deletes future bookings, and cleans up):

  node tmp/integration-test.mjs

What the script prints

- Google API responses for creation and patch operations (status and recurrence strings).
- IDs/counts of DB bookings before and after truncation.
- Deleted DB row IDs for the future scope.

If the script fails with a parsing or auth error, check these points:

- Use GOOGLE_CREDS_BASE64 (single-line base64). Locally: base64 -w 0 service-account.json > service-account.b64
- Ensure the calendar is shared with the service account email (Editor access).
- If using raw JSON env var, ensure your host preserves newlines and doesn't escape backslashes.

Developer utilities

- tmp/auth-test.mjs — small auth + insert test to quickly verify service account is usable
- tmp/list-events.mjs — list events for the target calendar
- tmp/integration-test.mjs — full recurring-flow integration test (create event, create DB rows, truncate recurrence, delete future DB rows, cleanup)

Troubleshooting

Collect and paste these log lines if reporting issues:

- "Google service account authorized: <client_email>"
- "Using Google SA" (clientEmail, calendarId and env lengths)
- "Creating calendar event" / "Calendar event inserted" or "createCalendarEvent error:"

Common errors:

- 401 / invalid credentials — service account JSON/keys invalid or parsed incorrectly
- 403 / insufficientPermissions — calendar not shared or account lacks Editor role
- 404 / notFound — wrong calendar id

If you want me to run the integration test from here, supply a valid GOOGLE_CREDS_BASE64 value (single-line base64 of the service account JSON) and I will re-run the script and share the outputs (Google API responses, DB rows removed, and RRULE updates).

Contact / next steps

Tell me if you want:

- an Admin page that lists events created by the app, or
- a CI script to inject the service account JSON into deployment secrets, or
- a UI to manage per-teacher calendars.

