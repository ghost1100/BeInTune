In Tune Music Tuition — Project README

Overview

This repository implements In Tune Music Tuition — a small full-stack web app for music lesson bookings, community discussion, messaging, and admin tools. It includes a Vite + React frontend and an Express backend with Postgres (Neon) database.

Key features

- Public site pages: Home, Lessons, Teachers, Pricing, Contact, About.
- Booking system: book free trial lessons via a BookingForm and admin-managed booking slots.
- Authentication: server-side session authentication with token fallback; admin and student roles supported.
- Admin dashboard: manage teachers, students, site content, newsletters, security settings, and view reports.
- Student dashboard: view upcoming lessons, discussion, chats, and bookings.
- Real-time chats: WebSocket-powered chat system with one-to-one messages between users, admin pinned chat, message reactions, editing, and deletion.
- Notifications: in-app notification bell + inbox; server saves notifications to DB and pushes via WebSocket.
- Discussion feed: public posts with moderation support.
- Ephemeral messaging: messages expire after 21 days by default; users (or admin) can save messages to prevent expiration.
- Audit logs: actions are logged for moderation and audit purposes.

Security & Data Handling (current implementation)

- Passwords: hashed with bcrypt on user creation and password updates.
- Session/auth: server endpoints verify req.user for protected routes; tokens may be persisted in localStorage for convenience.
- DB access: server uses parameterized SQL queries to avoid SQL injection.
- Audit logs: key admin actions recorded in audit_logs table.
- Message expiry: messages include expire_at and saved_by columns to support ephemeral behavior.

Automated Tests

Project scripts (package.json):

- dev: vite
- build: build both client and server
- test: vitest --run
- typecheck: tsc

If you already have tests, run:

npm test

If no tests exist, running the test script will run Vitest and report 0 tests.

I ran the repository test script (vitest) to validate routing and basic sanity. If you want a test suite covering routing, API endpoints, or integration tests with DB, I can add Vitest + Playwright or Cypress tests for end-to-end verification.

Security recommendations (recommended improvements)

The app has several good foundations (bcrypt, server-side checks, audit logs) but I recommend the following to reduce risk:

- Enforce HTTPS everywhere and use HSTS.
- Add security headers via helmet (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
- Input validation and sanitization on all user inputs (use Zod or similar and sanitize HTML/markdown for posts/discussion).
- Rate limiting and brute-force protection on auth endpoints (express-rate-limit, account lockouts, CAPTCHA when needed).
- CSRF protection for any cookie-based auth flows (csurf) or migrate to same-site strict tokens.
- Use signed, HttpOnly cookies for session tokens instead of localStorage where possible — localStorage is vulnerable to XSS extraction.
- Strong JWT practices if used: short expiry, refresh tokens, rotation, revoke list, and store refresh tokens securely.
- Limit DB user privileges: the DB user used by the app should only have necessary permissions.
- Encrypt backups and rotate encryption keys; secure database credentials with a secrets manager (Vault / environment variables via provider).
- Monitor and alert: add Sentry or similar for error reporting and breach detection; add logs for access, auth failures, and admin actions.
- Add automated security scanning (Semgrep) in CI and dependency vulnerability checks.
- Enforce strong password policies and email verification for accounts. Offer 2FA for admin accounts.

GDPR & ICO (UK / Scotland) summary and compliance notes

Scope

- Scotland follows UK GDPR (post-Brexit) and the Data Protection Act 2018; the Information Commissioner's Office (ICO) is the regulator for data protection in the UK.
- If your service processes personal data of UK residents (including users/students), you must comply with UK GDPR principles: lawfulness, fairness, transparency, purpose limitation, data minimisation, accuracy, storage limitation, integrity and confidentiality.

Practical steps relevant to this app

- Lawful basis: determine lawful basis for processing (typically legitimate interests or contract for bookings; explicit consent for marketing).
- Data minimisation: only collect fields necessary for service (name, email, phone, parental contact for minors).
- Retention: keep ephemeral messages only as long as necessary. Default policy in app is 21 days unless saved by user; ensure that is documented in the privacy policy and configurable.
- Subject rights: implement processes to answer data subject requests (access, rectification, deletion), including export of user's data.
- Data processing agreements: if you use third parties (Neon/Supabase, SendGrid), ensure you have DPAs in place.
- Data protection impact assessment (DPIA): conduct DPIA for processing special categories or large-scale monitoring.
- Security measures: follow the recommended security practices above (encryption, access control, monitoring).
- Breach notification: have an incident response plan; report certain personal data breaches to ICO within 72 hours where feasible.

About the ICO

- The Information Commissioner's Office is the UK regulator responsible for upholding information rights and enforcing data protection law.
- The ICO issues guidance, handles complaints, and can impose fines for breaches of data protection law.
- Registering with the ICO may be required depending on the scale and type of processing; check ICO guidance.

Content & Product recommendations

- Homepage: stronger hero with clear CTA (Book a free trial), social proof (testimonials), and trust signals (qualifications, safeguarding info).
- Teacher profiles: add bios, specialities, sample lesson video/audio, verified badge for admin-approved profiles.
- Onboarding: first-time student flow to collect preferences and link to teacher suggestions.
- Messaging UX: add read receipts, message threading for lessons, and pinned messages per user or admin.
- Analytics: add basic analytics for popular lessons/teachers to help product decisions.
- Accessibility: ensure ARIA on dynamic controls, keyboard navigation for chats, and colour contrast checks.
- Moderation tools: ability for admin to moderate posts and remove harmful content; reporting tools for users.

How I validated routing & functionality

- I checked App.tsx routes and ensured there are routes for: /, /lessons, /teachers, /pricing, /contact, /about, /admin/login, /admin, /dashboard, /chats, /discussion and the catch-all NotFound.
- I ran the test script (vitest) to discover test coverage. If you want, I can add a test suite for routes and key API endpoints.

Next steps I can take (pick any):

- Add a comprehensive test suite (Vitest + Playwright/Cypress) validating routing, API endpoints, auth flows, and message expiry.
- Implement automated deletion job (server-side cron) that permanently clears expired messages from the DB.
- Add Sentry integration and example CI Semgrep rules.
- Draft a Privacy Policy and Data Processing Agreement tailored to the app.

Contact & contribution

If you'd like me to add tests or the privacy policy, or to implement specific security measures, tell me which items to prioritise and I will implement them.

Recent additions in this codebase

- Group chats: server-side support for rooms and room_members was added. The server includes an endpoint to sync group chats based on students' `band` field (/api/admin/group-chats/sync) and a listing endpoint (/api/admin/rooms). Admins are automatically added to group rooms and group chats are shown in the Chats UI.
- Message encryption: message content can be encrypted at rest using AES-256-GCM. Provide an environment variable MESSAGE_ENCRYPTION_KEY (at least 32 characters) to enable encryption; otherwise plaintext is stored (not recommended). See server/lib/crypto.ts.
- Scheduled cleanup job: a background job runs (default every hour) to permanently delete expired messages that are not saved by any user. Configure CLEANUP_INTERVAL_MS to change the interval.
- Cookie banner & privacy page: a CookieBanner component and /privacy page were added; the banner persists acceptance in localStorage.
- E2E tests scaffolding: Playwright config and a basic test were added under e2e/ (requires Playwright to be installed to run).
- DB migration: server/db/migrations/002_group_chats.sql adds `students.band`, `rooms`, and `room_members`.

Recent admin UI updates:

- Newsletter & more: Admin dashboard now includes a "Newsletter & more" panel with:
  - Compose newsletter modal (rich HTML, Unsplash header image, attachments) which sends via the existing server endpoint POST /api/admin/newsletters.
  - Quick send: inline subject + HTML message to rapidly broadcast announcements to subscribed users.
  - Manage subscribers shortcut that navigates to the Students tab for managing subscriptions.

- Teachers modal: The Add / Edit teacher form is now a responsive modal. "Add teacher" opens the modal; editing a teacher opens the modal prefilled. The modal supports image upload (drag/drop), random Unsplash image fetch, and responsive layout.

- Booking CTA & call improvements: The header "Book a free trial" now anchors to the booking card on the homepage. The Call button on the booking form asks for confirmation on desktop and opens the phone app directly on mobile devices.

Please review these changes and confirm whether you want me to:

- Run the group-chat sync automatically on startup
- Enforce encryption strictly (fail if MESSAGE_ENCRYPTION_KEY not set)
- Add the cleanup job to run more frequently or to soft-delete first instead of permanent delete
- Add Playwright to devDependencies and run E2E in CI

I'll proceed once you confirm preferences.
