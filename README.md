

Integration test for recurring cancellation

We include a small integration script to validate Google Calendar auth and test the "future" cancellation flow (truncate recurring event UNTIL and remove future bookings from the DB).

Prerequisites

- Set GOOGLE_CREDS_BASE64 to a single-line base64 of your Google service account JSON (recommended). Or place the full JSON at tmp/service-account-full.json.
- Ensure GOOGLE_CALENDAR_ID is set and the service account has Editor access to that calendar.
- Ensure DATABASE_URL points to your running Postgres database and migrations have been applied (see server/db/setup.ts).

Run the integration test (creates a recurring event, inserts test slots+bookings, truncates the recurrence, deletes future bookings, and cleans up):

  node tmp/integration-test.mjs

What the script prints

- Google API responses for creation and patch operations (status and event recurrence).
- Bookings count and IDs before and after truncation.
- Deleted DB rows for the future scope.

If the script fails with a parse/auth error, follow the Quick actionable fixes above (use GOOGLE_CREDS_BASE64). If you want me to run the test here, provide a valid GOOGLE_CREDS_BASE64 env value (single-line base64) and I will re-run the script and paste the output.


