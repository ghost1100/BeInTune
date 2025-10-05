DB setup and next steps for InTune

Env variables set via DevServerControl:
- SMTP_HOST = smtp.sendgrid.net
- SMTP_PORT = 587
- SMTP_USER = apikey
- SMTP_PASS = (SendGrid API key)
- SENDGRID_API_KEY = (SendGrid API key)
- FROM_EMAIL = bookings@intunemusictuition.co.uk

Migration file created: server/db/migrations/001_init.sql

How to apply the migration (use psql or neon CLI):

1) Using psql:
   psql "$NEON_DATABASE_URL" -f server/db/migrations/001_init.sql

2) Using Neon or your preferred DB migration tool:
   - Create a migration job that executes the SQL in server/db/migrations/001_init.sql

Next steps I can take after migration is applied:
- Scaffold server API routes for auth (register/login/password reset), students CRUD, posts/reels CRUD, messages, newsletters send endpoint and bookings endpoints.
- Implement server-side password hashing (bcrypt/argon2), email verification & reset flows (using SendGrid), and background job for message TTL cleanup.
- Add admin UI pages for student management, password randomizer, newsletter composer (with image attachments), and send preview.

Reply `migrate` when the DB migration has been applied and I will scaffold server APIs and admin UI.
