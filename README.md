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

If you want, I will:

- perform the full automated sweep replacing remaining hard-coded colors (I will run a confirmable diff), then
- convert all theme interactions to useTheme(), and
- add unit tests for preview flow.

Say `sweep` to run the full color-sweep now, or `hook` to convert remaining code to use the new hook (or both).
