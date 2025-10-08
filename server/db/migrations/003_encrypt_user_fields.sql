-- Add encrypted columns and indexes for user contact fields

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_encrypted text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_index text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_encrypted text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_index text;

CREATE INDEX IF NOT EXISTS idx_users_email_index ON users(email_index);

ALTER TABLE students ADD COLUMN IF NOT EXISTS address_encrypted text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS medication_encrypted text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_encrypted text;

CREATE INDEX IF NOT EXISTS idx_students_band ON students(band);
