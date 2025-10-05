# Project changes (Theme + Dark Mode + Preview)

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

1) Full repo sweep & review (optional)
- I can run a final automated repository-wide sweep that finds `bg-white`, `bg-gray-*`, `text-black`, and other hard-coded utilities and propose replacements. This is safe to run but may require a short visual review afterwards.

2) Convert remaining components to `useTheme()` (hook)
- I wired core admin/theme areas and the main ThemeToggle, but we should convert any remaining components that directly read or write theme tokens to use the hook for consistency.

3) Tests & accessibility
- Add unit/integration tests for theme preview/confirm/cancel flows and localStorage persistence.
- Run an accessibility contrast audit (axe/Lighthouse) and adjust token HSL values.

4) Student features & booking improvements (requires backend/auth)
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

If you'd like me to proceed, reply with one of the following commands:
- `sweep` — run the final automated repo-wide sweep and apply safe replacements.
- `hook` — convert remaining files/components to use `useTheme()` where applicable.
- `auth+db` — start implementing student auth, roles, forum, posts & ephemeral chat (I will request a Supabase connection).
- `tests` — add tests for theme flows and persistence.

If you want me to start implementing the student/forum/chat/booking features now, I'll begin by creating a todo plan and asking you to connect Supabase via the MCP popover.
