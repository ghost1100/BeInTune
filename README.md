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
  - Role-based access control (admin/content-manager/student) and ability for admin to revoke forum access or mark content as 16+
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

Security features required (overview)

- Authentication & identity
  - Use a secure auth provider (Supabase Auth or custom via Neon + OAuth/JWT). Enforce email verification, rate-limit signups, and require strong passwords (min length, complexity). Enable MFA for admin accounts.
  - Hash passwords using bcrypt/argon2 on the server; never store plaintext. Use secure password reset tokens with single-use and expiry.
- Authorization & roles
  - Role-based access control (admin, content-manager, student). Implement server-side checks for every privileged API.
  - Ability for admin to revoke forum/post access and to mark content as 16+ (age gating). Ensure frontend hides 16+ content unless check passes.
- Session & token security
  - Use short-lived access tokens and refresh tokens with secure, HTTP-only cookies (SameSite=strict) or robust JWT handling. Rotate refresh tokens on use.
  - Protect against CSRF for stateful requests (use SameSite cookies or CSRF tokens).
- Data protection
  - Use TLS everywhere (HTTPS) and enforce HSTS. Encrypt sensitive data at rest where supported by the DB/storage provider.
  - Principle of least privilege for DB users and storage buckets. Use separate DB roles for read/write/admin operations.
- Media & uploads
  - Scan uploaded files for malware, restrict allowed file types, apply size limits, and store in a private bucket with signed URLs for public access.
  - Use storage rules to limit who can upload and who can read media (e.g., only owners and admins for private posts).
- Ephemeral messages & retention
  - Implement TTL-based deletion for ephemeral messages (e.g., store createdAt and expireAt, run a scheduled job to delete older messages after 3 weeks). Allow manual save of messages to bypass TTL when user opts in.
  - Provide audit logs for moderation and deletions.
- Moderation & content safety
  - Implement content moderation flows: user reporting, admin review, and automatic filtering (profanity/NSFW detection). Age-gate content flagged as 16+.
  - Maintain a content visibility flag (public/private/16+) and enforce it on the server.
- Network & infra
  - Rate limiting and IP throttling on public APIs. Use Web Application Firewall (Cloudflare or Netlify/proxy rules) for edge protection.
  - Monitor and log suspicious activity; integrate Sentry for error monitoring and alerts.
- CI/CD & secrets
  - Ensure secrets (API keys, DB credentials) are injected via environment variables and stored in the hosting provider’s secret store (Netlify env vars). Do not commit secrets to git.
  - Run dependency vulnerability scans (npm audit, Snyk) and static analysis (Semgrep). Add automated tests in CI.
- Compliance & privacy
  - Provide data export/deletion paths for GDPR. Collect parental consent for under-16 accounts where required. Document retention policies.

Concrete steps to complete (high level)

1. Connect required MCPs

- Connect Supabase (recommended for auth, DB, realtime), Neon (Postgres) and Netlify (hosting) via the MCP popover: Click [Open MCP popover](#open-mcp-popover) and connect the providers (Supabase, Neon, Netlify). If you specifically want Neon for Postgres, we can use Neon for DB and Supabase just for Auth/Realtime, or choose Supabase for both to simplify integration.
- Also consider connecting: Builder.io (CMS), Sentry (monitoring), Semgrep (security scanning), Notion (docs), Linear (tickets) and Zapier (automation) via the same popover.

2. Provision DB & auth

- Create DB schema (users, roles, posts, comments, media, chats, messages, bookings, slots, audit_logs).
- Set up authentication (email/password, email verification). Use Supabase Auth or build an auth microservice that stores hashed passwords in Neon/Postgres.
- Implement RBAC: store roles in the users table and check server-side on every API call.

3. Storage & media

- Create a storage bucket for media (user posts). Enforce server-side checks for file types and sizes. Use signed URLs for uploads/downloads and set read rules per post visibility.

4. Ephemeral chat implementation

- Design message table with fields: id, senderId, recipientId/roomId, content (encrypted if needed), createdAt, expireAt, savedBy (array), editedAt, deletedAt.
- Use realtime (Supabase Realtime or websockets) for live delivery. Create a background job (serverless cron or worker) that deletes expired messages.

5. Booking & scheduling sync

- Move bookings/availability into DB. Implement server-side booking creation with optimistic locking to prevent double-booking.
- Notify teachers/admins via email or webhook when a slot is booked.

6. Deploy & secure

- Configure Netlify deploy and set environment variables (DB URL, API keys) in Netlify's dashboard.
- Enable HTTPS and HSTS. Configure Cloudflare or Netlify Edge rules for WAF if needed.
- Add CI checks: lint, typecheck, tests, security scans.

7. Monitoring & audits

- Integrate Sentry and Semgrep. Enable audit logging for admin actions and content moderation.

MCP integrations (reminder)

- Supabase (recommended for auth, DB, realtime)
- Neon
- Netlify
- Builder.io
- Prisma Postgres
- Zapier
- Figma (plugin)
- Linear
- Notion
- Sentry
- Context7
- Semgrep

Next actions I can take for you

- Update the hero subtitle color to be white in light mode (done).
- If you want, I can:
  - Run a final `sweep` across the repo to replace remaining hard-coded color utilities.
  - Start wiring auth & DB: to begin I will need you to click [Open MCP popover](#open-mcp-popover) and connect Supabase or Neon (prefer Supabase for auth/realtime). After connection I will create the initial schema and API endpoints.
  - Create a security checklist and PR template for future releases (CI integration with Semgrep/Snyk/Sentry).

Reply with which task to start next: `sweep`, `hook`, `auth+db`, or `security-pr`.

Admin UI scaffolding (work started):

- I added frontend admin components to manage student passwords and compose newsletters. Files added:
  - client/components/admin/StudentPasswordControls.tsx
  - client/components/admin/NewsletterComposer.tsx
- The Admin page now includes a "Compose newsletter" button (opens a modal composer) and the Students tab includes password controls (randomize, set, send reset).

Next steps to complete the admin UX and backend wiring:

1. Apply DB migration on Neon (server/db/migrations/001_init.sql).
2. Implement server APIs for:
   - POST /api/admin/users/:id/set-password
   - POST /api/auth/send-reset
   - POST /api/admin/newsletters (handle attachments and queue/send via SendGrid)
   - File upload endpoint for media storage
3. Add server-side password hashing (bcrypt/argon2), email verification, and newsletter send job (using the configured SendGrid API key).

If you want me to continue and scaffold the server APIs and admin routes, reply `migrate` (I will assume DB migration was applied) or `admin-ui` to focus on frontend polish only.
