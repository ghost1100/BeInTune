# Changes made

This commit includes a set of fixes and improvements to make the app dark-mode compatible and to improve the Theme preview UX.

1. Theme preview UX
- Admin Theme modal updated: Preview modal shows a compact, home-like preview and now has Apply and Cancel buttons.
- Overlay click and Escape key close the preview.
- Clicking Apply saves the theme tokens and theme mode in localStorage (`inTuneTheme`, `inTuneThemeMode`).

Files changed:
- client/pages/Admin.tsx — wired preview overlay handlers (apply/cancel), added previewMode state, Escape handling, overlay click-to-close, adjusted schedule card classes and tab styles.
- client/components/admin/ThemeHomePreview.tsx — smaller home preview with light/dark toggle above the preview.
- client/components/site/ThemeToggle.tsx — theme toggle in header that persists mode to localStorage.

2. Global dark-mode improvements
- Inputs, textareas and selects now adapt to theme tokens.
- Added dark-specific CSS tokens for inputs, border and muted backgrounds so controls are readable in dark mode.

Files changed:
- client/global.css — added token overrides (e.g., --input, --border) in the `.dark` block and made form controls use theme tokens.

3. Admin & Index visual fixes
- Replaced several hard-coded `bg-white` / `bg-gray-50` usages with theme-aware classes: `bg-card`, `bg-muted`, and `bg-card/95` to ensure contrast in dark mode.
- Tabs now use `text-foreground` and theme-aware background; many modal/card backgrounds use `bg-card`.
- Schedule availability items adjusted for better contrast in dark mode.

Files changed:
- client/pages/Index.tsx
- client/components/admin/ThemeHomePreview.tsx
- client/pages/AdminLogin.tsx
- client/pages/Admin.tsx

4. Misc
- Minor adjustments to button/layouts to avoid overflow (flex-wrap applied in admin areas).
- Added a small ReportPanel component to fix missing references.

Files added:
- client/components/admin/ThemeHomePreview.tsx
- client/components/site/ThemeToggle.tsx

# How it works now
- Theme toggle in the header stores the preference in `localStorage.inTuneThemeMode` and toggles the `dark` class on `<html>`.
- ThemeManager (Admin → Theme) stores HSL tokens in `localStorage.inTuneTheme` and applies them to `:root` CSS variables.
- Preview overlay can be dismissed with the Cancel button, Close button, pressing Escape, or clicking outside the preview window.

# Recommended next steps
1. Audit global color tokens
- Add `--input-foreground`, `--muted-foreground`, etc., to tighten accessibility contrast calculations.

2. Replace remaining hard-coded colors
- Search for `bg-white`, `bg-gray-100`, `text-black` and replace them with theme-aware tokens. I updated many core places but some components may still use explicit classes.

3. Accessibility and contrast testing
- Run tools (axe, Lighthouse) to validate WCAG contrast ratios in both light and dark modes and adjust token values accordingly.

4. Extract theme logic to a small hook
- Create a `useTheme()` hook to centralize the management of `inTuneTheme` and `inTuneThemeMode` (apply, preview, restore).

5. Add unit/UI tests for theme behavior
- Integration tests that ensure preview/confirm/cancel flows behave as expected and that localStorage is updated.

6. Persist theme for server rendering/initial page load
- If you want the theme applied immediately on first paint, set an inline script to read `localStorage.inTuneThemeMode` and add `dark` class before React mounts.

# Commands
- Start dev server: `pnpm dev`
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test`

# Notes
- I avoided changing visual tokens dramatically; instead I made components react to existing tokens. If you want more aggressive dark-mode color choices I can update the HSL values in `client/global.css`.

If you'd like, I can now:
- sweep the entire client/ folder to find and update all hard-coded light classes,
- implement a `useTheme()` hook and centralize theme persistence,
- add screenshots for both modes.

Tell me which of the above you want next and I'll proceed.
