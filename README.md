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

Next steps & checklist (recommended for production-ready background processing)

- [ ] Install dependencies: run `pnpm install` (or your preferred package manager). The project now requires `bullmq` and `ioredis` for Redis-backed background jobs.
- [ ] Provision Redis for queues. Set `REDIS_URL` (or `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`) in environment variables. For local development you can run Redis with `docker run --rm -p 6379:6379 redis:7`.
- [ ] Ensure DATABASE_URL, FROM_EMAIL, and Google calendar env vars are configured (see above).
- [ ] Start the app in development: `pnpm dev` (this runs client and server via Vite). In production build: `pnpm build && pnpm start`.
- [ ] Start a dedicated worker process (optional): the server startup (node dist/server/node-build.mjs) will attempt to start the booking worker automatically; for stronger isolation run the worker in a separate process by invoking the compiled worker entrypoint or by starting `node dist/server/workers/bookingWorker.mjs` (after building).
- [ ] Monitor queue and workers: use Redis CLI or a Bull/BullMQ UI (e.g., Arena or Bull Board) to inspect jobs, retries and failures.
- [ ] Configure process manager for production (systemd, PM2, Docker containers, or Kubernetes) to run web and worker processes separately and ensure automatic restarts and log collection.

Testing the schedule feature (manual and automated checks)

1) Quick manual test using API endpoints (replace host/port and include auth if required):

- Create a slot:
  curl -X POST "http://localhost:3000/api/admin/slots" -H "Content-Type: application/json" -d '{"slot_date":"2025-10-15","slot_time":"10:00","duration_minutes":30}'

- Create a booking for that slot:
  curl -X POST "http://localhost:3000/api/admin/bookings" -H "Content-Type: application/json" -d '{"slot_id":"<SLOT_ID>","name":"Test User","email":"test@example.com"}'

- Verify bookings for date:
  curl "http://localhost:3000/api/admin/bookings?date=2025-10-15"

2) Verify background processing (email/calendar/job enqueue)

- Ensure Redis is running and REDIS_URL is set.
- After creating a booking, check Redis / BullMQ UI for a job in the `bookingQueue` and confirm the worker processes it: look for logs "Booking worker started" and "Booking job completed" in server/worker logs.
- Confirm calendar event created (use tmp/list-events.mjs or check Google Calendar directly) and that attendee received email (check SMTP logs or SendGrid dashboard).

3) Integration script (repeatable)

- The repo contains `tmp/integration-test.mjs` which runs a full recurring booking flow using Google Calendar; prerequisites: GOOGLE_CREDS_BASE64, GOOGLE_CALENDAR_ID, DATABASE_URL set. Run:
  node tmp/integration-test.mjs

Notes and known blockers

- I attempted to install new dependencies automatically but `pnpm install` failed in the environment I have access to. Please run `pnpm install` locally or in CI to fetch `bullmq` and `ioredis`.
- To let me run automated tests here I need:
  - Access to a running Redis instance (set REDIS_URL)
  - npm/pnpm install to succeed so new packages are present
  - If you want me to run integration tests that touch Google Calendar, provide a valid `GOOGLE_CREDS_BASE64` secret or confirm you want me to use the existing service account env variable already set in this environment.

If you want, I can now:
- Run the schedule feature test here (I will attempt to install deps and run server + worker + a small API-based smoke test). Click to confirm and I will proceed, otherwise run `pnpm install` and tell me when it's done and I will run the tests for you.

