# Project changes (Theme + Dark Mode + Preview)

## Status update: DB migration applied & server deps added

- The DB migration server/db/migrations/001_init.sql has been applied to Neon (confirmed).
- Server dependencies have been added to package.json: pg, bcrypt, @sendgrid/mail, sharp.

The server now includes scaffolded routes for authentication, admin user management, media uploads, and newsletter sending. See server/routes/\* for implementations.

### Newsletter input checklist

When composing a newsletter (POST /api/admin/newsletters), provide the following fields in the JSON payload:

- subject (string, required): email subject line
- html (string, required): full HTML content of the email
- plain (string, optional): plain-text fallback content
- unsplash_image (string, optional): URL to an image to include in the newsletter header
- attachments (array, optional): list of attachments where each item is an object with { filename: string, mime: string, data: base64 string }
- scheduled_at (ISO timestamp, optional): when to schedule the send; if omitted the newsletter will be sent immediately

Notes:

- The server accepts attachments as base64 and stores media in public/uploads via the upload endpoint. Attachments will be recorded in the newsletters.attachments JSON column as media ids when uploaded through the media upload API.
- Keep HTML and plain content size reasonable; for large media include links rather than embedding large files inline.

### Admin UI changes

- Students tab was temporarily removed then restored and wired to the database. Student password controls now operate on real DB records.
- The top-right "Admin" navigation button has been relabeled to "Login" (links to /admin/login).
- Admin pages now use API-backed data for Teachers, Students, Bookings, and Slots instead of localStorage where implemented.

### Booking & Schedule

Implemented:

- Migrated slots and bookings to the database with server routes:
  - GET /api/admin/slots?date=YYYY-MM-DD
  - POST /api/admin/slots
  - DELETE /api/admin/slots/:id
  - GET /api/admin/bookings?date=YYYY-MM-DD
  - POST /api/admin/bookings
  - DELETE /api/admin/bookings/:id
- Client updated to use the new APIs. The Schedule manager and Booking form now fetch availability and bookings from the server.
- "Find slots" on the booking form now lists available admin/teacher slots between 08:00 and 17:00 that are not already booked by students.
- "Call" buttons (Booking form, Theme preview and other places) now use tel: links to open the user's dialer immediately.

Not yet implemented / follow-ups:

- Move booking availability caching / slot bulk updates to a server-side batch API (currently toggle creates/deletes individual slots).
- Add server-side validation to prevent race conditions when multiple users try to book the same slot at the same time (use transactions/locking).

### Login background images & Unsplash cache

Implemented:

- Login background now requests images using queries for nature and musical instruments (guitar, piano, etc.).
- A local cache/backups mechanism is added so previously-fetched images (and a curated backup set) are used if the Unsplash API fails or rate limits are reached. The cache is stored in localStorage under key `unsplash_cache_v1`.

Notes:

- Add environment variable VITE_UNSPLASH_ACCESS_KEY to increase quota; the code falls back to backup images if the API limit is reached.

### Security & Auth

Implemented:

- JWT issuance on successful login, with token set as an HTTP-only cookie. Auth middleware decodes the token and attaches the user to requests.

Not yet implemented / recommended:

- Implement token refresh/rotation and proper logout endpoint to revoke cookies.
- Harden JWT secret management in production (set JWT_SECRET env var and store in secret manager).

### Misc / Next steps

- Convert remaining client-side localStorage usages (schedule bookings cache, other lists) to API-backed calls. Some components still fall back to localStorage for compatibility.
- Add unit/integration tests, especially for booking concurrency and auth flows.
- Add admin UI pages for slot bulk import/export and a calendar view for bookings.

If you want, I can now:

- Implement server-side booking transaction checks to prevent double-booking.
- Add session refresh endpoints and a logout route.
- Seed demo students/teachers for easier testing.
  This README summarizes all theme-related fixes, the new preview UX, the central theme API, and recommended next steps.

---

## What I changed (summary)

1. Theme preview UX

- Small compact preview modal added to Admin → Theme. The modal is a small box (~380px wide) with a centered light/dark icon above it and two action buttons below:
  - Cancel (left, red) — reverts the preview and closes the modal
  - Apply (right, green) — saves theme tokens + mode to localStorage and applies them globally
- Overlay click and Escape key close the preview.

Files:

- client/pages/Admin.tsx (preview modal: compact box, Apply/Cancel, overlay click, esc handling)
- client/components/admin/ThemeHomePreview.tsx (compact preview view)

2. Central theme management + first-paint boot

- Added a `useTheme()` hook to manage theme tokens and mode centrally (preview, save, restore functions).
- Added an inline boot script in `index.html` to apply previously saved theme/mode before React mounts to avoid FOUC.

Files:

- client/hooks/useTheme.tsx (new)
- index.html (inline boot script added)

3. Dark-mode compatibility sweep

- Replaced many hard-coded light backgrounds and text with theme-aware tokens (bg-card, bg-muted, bg-input, text-foreground) so components adapt to dark mode.
- Inputs, textareas and selects now use theme tokens; placeholder text color is adjusted in CSS.
- Added dark-mode tokens for `--input`, `--border`, and muted backgrounds to `client/global.css`.

Files modified:

- client/global.css
- client/pages/Index.tsx
- client/pages/Admin.tsx
- client/pages/AdminLogin.tsx
- client/components/admin/ThemeHomePreview.tsx
- client/components/site/Header.tsx
- client/components/site/ThemeToggle.tsx (new)
- many UI adjustments across components (cards, tabs, modals)

4. Misc fixes

- Fixed overflow/wrapping issues in Admin forms (Random button, flex-wrap on controls).
- Added a small `ReportPanel` to satisfy a missing reference used in Admin.

Files added:

- client/components/admin/ThemeHomePreview.tsx
- client/components/site/ThemeToggle.tsx
- client/hooks/useTheme.tsx

---

## How to test locally

1. Start dev server

pnpm dev

2. Open Admin Theme page

- Go to `/admin`, sign in and open the Theme tab.
- Click Preview to open the small modal. Toggle the light/dark icon at the top of the modal (affects the preview).
- Use Cancel (left, red) to revert and close, or Apply (right, green) to persist and apply the theme + mode.

3. Confirm persistence

- Reload the page — the inline boot script will apply the saved theme/mode before React mounts.

4. Run typechecks/tests

pnpm typecheck
pnpm test

---

## Files changed (detailed)

- Added
  - client/components/admin/ThemeHomePreview.tsx
  - client/components/site/ThemeToggle.tsx
  - client/hooks/useTheme.tsx
- Modified
  - index.html (inline theme boot script)
  - client/global.css
  - client/pages/Admin.tsx
  - client/pages/Index.tsx
  - client/pages/AdminLogin.tsx
  - client/components/site/Header.tsx
  - client/components/admin/ThemeHomePreview.tsx (initial add + subsequent updates)
  - other minor UI component files (button, modal usage, etc.)

---

## Recommendations / Next steps (priority)

1. Full sweep: replace remaining hard-coded colors

- I updated core places but a final automated sweep (search replace of `bg-white`, `bg-gray-100`, `text-black`) is recommended to avoid edge cases. I can perform that next.

2. Centralize theme logic

- Convert all theme code to use the `useTheme()` hook across Admin Theme manager and ThemeToggle component. This will make future changes safer.

3. Accessibility & contrast audit

- Run Lighthouse/axe to validate contrast ratios and adjust HSL values for tokens accordingly.

4. Add unit/integration tests

- Tests to cover preview/confirm/cancel flows and localStorage persistence.

5. Optional: inline critical CSS for theme tokens

- To avoid any flash of incorrect colors, move critical CSS or token-values into a small SSR/inline snippet for production builds.

---

## How to revert changes

- Use git to checkout previous commit or use the repository UI to revert the changes if needed.

---

Completed actions: the sweep and hook integration (stage 1) are done for core areas:

- ThemeManager uses the central `useTheme()` hook (preview/save/restore).
- ThemeToggle and Admin theme UI are wired to `useTheme()` so toggling mode persists and applies globally.
- Inline boot script applies saved theme + mode before React mounts to avoid FOUC.
- Automated replacements applied to many hard-coded color utilities across pages and components (Index, Admin, AdminLogin, BookingForm, ThemeHomePreview, and several UI components). Buttons and stateful color patterns (success/warning/destructive/secondary) were mapped to theme tokens (primary, destructive, secondary) where safe.

What I changed in this sweep:

- Replaced explicit button color classes (bg-green-600, bg-red-600, bg-blue-600) with theme tokens (bg-primary, bg-destructive, bg-secondary) and their corresponding foreground token classes.
- Replaced several hero/text background usages of `text-white`/`bg-gray-900` with theme-aware tokens (text-foreground / bg-foreground/10) to preserve contrast under both modes.
- Converted BookingForm selection states to use `bg-primary` / `bg-muted` instead of light-only utilities.

Notes & caveats:

- I focused on safely replaceable patterns and preserved contextual edge-cases (overlays, subtle tints) to avoid visual regressions. A small manual review of critical screens (hero, admin modals, booking flows) is recommended to polish token choices.
- Some color usages remain intentionally as CSS-backed overlays (e.g., modal backdrop) — they can be tokenized if you want a fully tokenized system.

Next recommended steps (priority):

1. Full repo sweep & review (optional)

- I can run a final automated repository-wide sweep that finds `bg-white`, `bg-gray-*`, `text-black`, and other hard-coded utilities and propose replacements. This is safe to run but may require a short visual review afterwards.

2. Convert remaining components to `useTheme()` (hook)

- I wired core admin/theme areas and the main ThemeToggle, but we should convert any remaining components that directly read or write theme tokens to use the hook for consistency.

3. Tests & accessibility

- Add unit/integration tests for theme preview/confirm/cancel flows and localStorage persistence.
- Run an accessibility contrast audit (axe/Lighthouse) and adjust token HSL values.

4. Student features & booking improvements (requires backend/auth)

- The discussion forum, Instagram-like posts, chats (ephemeral messages), and improved booking flow you described require authenticated users, a database, file uploads, and real-time features. I recommend connecting a backend integration (Supabase preferred) to implement:
  - Email/password sign up for students (hashed passwords, reset flows)
  - Role-based access control (admin, content-manager, student) and ability for admin to revoke forum access or mark content as 16+
  - Posts, comments, likes, media uploads (storage bucket)
  - Chat with ephemeral messages and selective save/restore (use DB with TTL or background job to expire messages after 3 weeks)
  - Booking slots sync (availability in DB) and notifications for teachers/admin

Integrations I recommend (available MCP servers):

- Supabase: database, auth, real-time (recommended for forum/chat and auth). Click [Connect to Supabase](#open-mcp-popover).
- Neon: alternative Postgres option (already available in the project list).
- Netlify: deployment/hosting (already connected).
- Builder.io: CMS/content management for non-code editors. Click [Connect to Builder.io](#open-mcp-popover).
- Prisma Postgres: ORM/schema management for Postgres-backed workflows. Click [Connect to Prisma](#open-mcp-popover).
- Zapier: automation and external integrations (optional). Click [Connect to Zapier](#open-mcp-popover).
- Figma: design-to-code plugin (useful for converting mockups). Get plugin at https://www.figma.com/community/plugin/747985167520967365/builder-io-ai-powered-figma-to-code-react-vue-tailwind-more
- Linear: project management/ticket sync. Click [Connect to Linear](#open-mcp-popover).
- Notion: documentation and knowledge-base sync. Click [Connect to Notion](#open-mcp-popover).
- Sentry: error monitoring and release tracking. Click [Connect to Sentry](#open-mcp-popover).
- Context7: documentation lookup helper. Click [Open MCP popover](#open-mcp-popover) to connect.
- Semgrep: security/static analysis. Click [Open MCP popover](#open-mcp-popover) to connect.

Note: Neon and Netlify are already connected for this project.

---

## New: Gmail & Google Calendar integration (next steps)

## Real-time discussions & chats

- Implemented a lightweight WebSocket server for realtime updates at /ws. The server broadcasts new posts and messages to connected clients.
- Client pages (Discussion, Chats) open a WebSocket connection to receive live updates and refresh the UI when new posts or messages arrive.
- For persistence and production readiness, connect Neon (Postgres) as the primary DB and consider adding a pub/sub layer or Redis for horizontal scaling. Click [Connect to Neon](#open-mcp-popover) to link Neon.

### Security & access

- The Discussion, My Learning, and Chats pages are intended for authenticated users only. The app now requires users to be signed in to access these sections; they will be hidden from the header and protected on the client and server-side. Use the `/api/auth/me` endpoint to verify the current user and role.

### DB migration / audit_logs fix

- If you saw errors about missing relations (e.g., `relation "audit_logs" does not exist`), the server will now automatically apply the initial migration (server/db/migrations/001_init.sql) if core tables are missing and also creates missing helper tables such as `audit_logs`, `comments`, `post_reactions`, and `learning_resources` during startup. Check server logs for `Applied initial DB migrations` on startup.

This project will add two important features:

1. Sending transactional and scheduled emails using a dedicated Gmail account with an App Password (for admin notifications, booking confirmations and lesson reminders).

2. Linking the admin's Google Calendar to the app so the admin can manage schedule slots and so the system can create recurring weekly lessons and calendar events automatically.

Overview of approach

- Add server-side support for Gmail SMTP (Nodemailer or existing mail library) that can use either SendGrid (existing) or Gmail SMTP based on environment configuration.
- Add a secure UI and server endpoints to connect a Google account (OAuth) or to register calendar credentials, and store tokens securely (encrypted or in hosting secret store).
- Implement recurring lesson logic in the backend: store recurring rules in DB, create and sync Google Calendar events (store event IDs), and generate scheduled reminder emails.

Gmail App Password (how to set up)

- Create a dedicated Gmail account for the app (recommended: bookings@your-domain or intunemusictuition@gmail.com).
- Enable 2-Step Verification for that Google account.
- Create an App Password (Select: Mail → Other (Custom name) → generate) and copy the 16-character password.
- Store credentials in your hosting/environment secrets (do NOT commit to git):
  - GMAIL_SMTP_HOST (usually smtp.gmail.com)
  - GMAIL_SMTP_PORT (587)
  - GMAIL_USER (the full Gmail address)
  - GMAIL_APP_PASSWORD (the 16-character app password)

Notes:

- App Passwords work for sending via SMTP but are not OAuth tokens for Calendar APIs. For Calendar integration you'll need OAuth client credentials or a service account (see below).
- The repo currently includes SendGrid env vars; we will add conditional support so either provider can be used.

Google Calendar API (how to set up)

Two common options for server integration:

A) OAuth 2.0 (recommended for single admin account)

- Create a Google Cloud Project at https://console.cloud.google.com/
- Enable the Google Calendar API.
- Configure OAuth consent screen (internal or external depending on account).
- Create OAuth 2.0 Client ID (type: Web application) and add redirect URI(s) for your app (e.g., https://your-deploy/\_oauth/google/callback).
- Use the client ID/secret to perform the OAuth flow and obtain access_token + refresh_token for the admin account. Persist the refresh_token in the server (encrypted) so the server can refresh access tokens without user interaction.

B) Service account (possible if using a G Suite / Google Workspace domain and domain-wide delegation)

- Create a service account and enable domain-wide delegation. Share the admin calendar with the service account or impersonate the admin user.
- Use a service account when the integration is between servers and there is no interactive admin consent flow.

Which to pick

- If you own the admin Google account and prefer a one-off interactive setup, use OAuth 2.0 and persist the refresh token.
- If you manage a Google Workspace domain and want server-to-server access, consider a service account.

Required environment variables (suggested)

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_OAUTH_REDIRECT_URI
- GOOGLE_CALENDAR_ADMIN_EMAIL (admin calendar email to write events to)
- GOOGLE_SERVICE_ACCOUNT_KEY (if using a service account, store JSON key securely and reference it in hosting secret store)

Implementation plan (high level)

1. Backend: Mail provider abstraction

- Add an abstraction layer to send mail (provider: sendgrid or smtp). Use existing SendGrid implementation; add SMTP transport using Nodemailer for Gmail app password usage.
- Make provider configurable via environment variable MAIL_PROVIDER (values: sendgrid|smtp).

2. Backend: Google Calendar connector

- Add server endpoints to start OAuth flow (/api/admin/google/connect) and to receive the callback (/api/admin/google/callback).
- Persist refresh_token and admin calendar id/email in DB (encrypted or in secret store) and mark calendar connection status in admin settings.
- Add helper to create, update, delete calendar events and attach event IDs to DB booking/lesson records.

3. Recurring weekly lessons

- Add DB table/columns for recurring rules (e.g., lessons: id, teacher_id, day_of_week, start_time, duration_minutes, recurrence_end_date, student_ids[], google_event_id[])
- On creation of a recurring lesson, create recurring events on Google Calendar (either as a recurring event or create individual events for a known horizon, e.g., next 6 months) and store event IDs.
- Add a scheduled background job (cron or serverless scheduled function) that:
  - Ensures future events exist for each recurring lesson (reconciliation)
  - Sends reminder emails to participants (e.g., 24 hours before lesson)

4. Notifications & emails

- Send booking confirmations, lesson reminders and admin notifications via configured mail provider.
- Provide templates for email (HTML and plain-text) and allow scheduling.

5. Admin UI

- Add an Admin → Integrations page with buttons to:
  - "Connect Google Calendar" (starts OAuth)
  - "Disconnect" (revoke tokens)
  - Show connection status and calendar used
- Add lesson creation UI that supports recurring rules (weekly on Mon/Wed/etc., time, duration, start/end date).

Security & storage

- Store OAuth refresh tokens and service-account keys in hosting secret store (Netlify env vars or provider secret manager). If persisted in DB, encrypt at rest and restrict DB creds in prod.
- Use least privilege for calendar writes (only write to a specific admin calendar email).
- When revoking/disconnecting, delete stored tokens and optionally remove created events (ask admin before deleting historical events).

Suggested environment variables to add to Netlify/hosting

- MAIL_PROVIDER=sendgrid|smtp
- GMAIL_SMTP_HOST=smtp.gmail.com
- GMAIL_SMTP_PORT=587
- GMAIL_USER=bookings@your-domain.com
- GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
- GOOGLE_CLIENT_ID=...
- GOOGLE_CLIENT_SECRET=...
- GOOGLE_OAUTH_REDIRECT_URI=https://your-deploy/\_oauth/google/callback
- GOOGLE_CALENDAR_ADMIN_EMAIL=admin@your-domain.com
- GOOGLE_SERVICE_ACCOUNT_KEY (when using service account)

MCPs and integrations that help this work

- Supabase: database, auth, realtime (recommended for auth, DB and storing tokens securely). Click [Connect to Supabase](#open-mcp-popover).
- Neon: Postgres (already available and currently used in the project).
- Netlify: deployment and environment secret storage (already connected).
- Builder.io: CMS/content management for non-technical edits and email content (optional). Click [Connect to Builder.io](#open-mcp-popover).
- Prisma Postgres: ORM/schema management if you prefer Prisma on top of Postgres. Click [Connect to Prisma](#open-mcp-popover).
- Zapier: automation and external triggers (optional). Click [Connect to Zapier](#open-mcp-popover).
- Figma: design-to-code plugin (useful for UI work). Get plugin at https://www.figma.com/community/plugin/747985167520967365/builder-io-ai-powered-figma-to-code-react-vue-tailwind-more
- Linear: project management. Click [Connect to Linear](#open-mcp-popover).
- Notion: documentation and runbooks. Click [Connect to Notion](#open-mcp-popover).
- Sentry: error monitoring and release tracking. Click [Connect to Sentry](#open-mcp-popover).
- Context7: docs lookup helper. Click [Open MCP popover](#open-mcp-popover) to connect.
- Semgrep: security/static analysis. Click [Open MCP popover](#open-mcp-popover) to connect.

Note: Neon and Netlify are already connected for this project.

Concrete next actions I will take if you want me to proceed

- Add SMTP provider support on the server and make MAIL_PROVIDER configurable.
- Add server routes for Google OAuth connect/callback and store the refresh token encrypted in DB.
- Add DB schema for recurring lessons and implement server-side logic to create/sync calendar events and send reminder emails.
- Add Admin UI for connecting calendar and creating recurring lessons.

If you want me to start implementing these, reply with `implement-mail-and-calendar` and I will:

1. Add SMTP support and provider abstraction.
2. Scaffold OAuth endpoints and DB changes for recurring lessons.
3. Wire a simple Admin Integrations UI to start the OAuth flow.

---

## How to revert changes

- Use git to checkout previous commit or use the repository UI to revert the changes if needed.

---

(End of README)
