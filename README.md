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

- pnpm dev        # Start dev server (client + server)
- pnpm build      # Production build (client + server)
- pnpm start      # Start production server
- pnpm test       # Run Vitest tests
- pnpm typecheck  # TypeScript validation

New integrations and configuration

Email (SMTP / Gmail)

This project now supports sending mail through SMTP (nodemailer) with an optional SendGrid fallback. A helper lives at server/lib/mailer.ts which will use SMTP when SMTP_* environment variables are provided.

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

- GOOGLE_SERVICE_ACCOUNT_JSON (the JSON content of the service account key)
- GOOGLE_CALENDAR_ID (the calendar ID to write events into; can be the service account email or a calendar you have shared with the service account)
- GOOGLE_CALENDAR_TIMEZONE (optional, defaults to Europe/London)

Important: share the target calendar with the service account email (Viewer/Editor as appropriate). For a regular consumer Google Calendar, open calendar settings -> Share with specific people and add the service account email (e.g. intune@calendar-access-474717.iam.gserviceaccount.com) with Editor permissions.

Files added / updated

- server/lib/mailer.ts — new mailer helper (nodemailer + SendGrid fallback)
- server/lib/calendar.ts — Google Calendar helper (service account JWT)
- server/routes/bookings.ts — creates calendar events after bookings and returns student phone/instruments in bookings API
- server/routes/newsletters.ts, server/routes/auth.ts — updated to use mailer helper
- client/pages/Admin.tsx — booking details modal now shows student phone and instruments when available
- package.json — nodemailer and googleapis dependencies added

How to test email + calendar locally (example)

1) Ensure environment variables are set (see list above) and run:

   pnpm install
   pnpm dev

2) Create a test slot (replace HOST with your dev server URL or use the running preview) using the API:

   curl -s -X POST "$HOST/api/admin/slots" -H "Content-Type: application/json" -d '{"slot_date":"2025-10-10","slot_time":"10:00","duration_minutes":30}'

3) Create a booking to trigger email + calendar event (replace SLOT_ID with the id returned in step 2):

   curl -s -X POST "$HOST/api/admin/bookings" -H "Content-Type: application/json" -d '{"slot_id":SLOT_ID,"lesson_type":"Guitar","name":"Test User","email":"you@example.com","phone":"+447359224618"}'

4) Verify results:
- Email: check the inbox for FROM_EMAIL and the recipient address.
- Calendar: open the calendar specified by GOOGLE_CALENDAR_ID and confirm an event at the booked time.

Notes and operational guidance

- If you prefer per-teacher calendars instead of a single shared calendar, we can extend the data model to store teacher calendar IDs and use those when creating events.
- When running in production, keep secrets in your deployment provider environment settings (Netlify/Vercel/Heroku) rather than environment files in source control.
- If you expose the service account JSON via environment variables, ensure the deployment platform encrypts or secures those values.

Security reminders

- Rotate credentials if they are ever shared in chat or committed accidentally.
- Ensure the service account only has necessary permissions and the calendar is shared only with that service account if used for a dedicated calendar.

If you'd like, I can:
- Add an Admin UI control to connect additional calendars or to list created events for a booking.
- Implement per-teacher calendar support.
- Add Playwright E2E tests that create a slot + booking and assert an event exists in the Calendar API (requires service account credentials in CI).

Please tell me which of the follow-ups you want next: per-teacher calendars, Admin UI to inspect events, or E2E tests for calendar/email flows.
