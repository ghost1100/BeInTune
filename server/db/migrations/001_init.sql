-- Initial schema for InTune community platform
-- Normalized tables: users, students, posts, reels, messages, newsletters, bookings, slots, media, audit_logs

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table: used for admins, content-managers, students, teachers
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text,
  role text NOT NULL DEFAULT 'student', -- admin, content_manager, teacher, student
  is_active boolean NOT NULL DEFAULT true,
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reset_token text,
  reset_expires timestamptz
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Student profile (optional additional metadata)
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text,
  age int,
  parent_name text,
  parent_email text,
  phone text,
  address text,
  marketing_consent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id);

-- Media assets (images/videos stored in bucket; metadata in DB)
CREATE TABLE IF NOT EXISTS media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL, -- path or storage key
  url text NOT NULL,
  mime text,
  size bigint,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Posts / discussion threads
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text,
  body text,
  is_public boolean DEFAULT true,
  is_age_restricted boolean DEFAULT false, -- if true, only 16+
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_public ON posts(is_public);

-- Post media attachments (many-to-many)
CREATE TABLE IF NOT EXISTS post_media (
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  media_id uuid REFERENCES media(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, media_id)
);

-- Reels / short uploads
CREATE TABLE IF NOT EXISTS reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption text,
  media_id uuid REFERENCES media(id) ON DELETE SET NULL,
  is_public boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chat messages (ephemeral support via expire_at)
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES users(id) ON DELETE CASCADE, -- null for room messages
  room_id uuid, -- optional room
  content text,
  attachments jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  expire_at timestamptz, -- messages older than this can be removed by a background job
  saved_by jsonb DEFAULT '[]', -- array of user ids who saved this message
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_expire ON messages(expire_at);

-- Newsletters composer & send log
CREATE TABLE IF NOT EXISTS newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text,
  html text,
  plain text,
  attachments jsonb DEFAULT '[]', -- media ids
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletters_scheduled ON newsletters(scheduled_at);

-- Newsletter subscriptions (snapshot of user preference)
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  subscribed boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

-- Booking slots and bookings
CREATE TABLE IF NOT EXISTS slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  slot_date date NOT NULL,
  slot_time time NOT NULL,
  duration_minutes int DEFAULT 30,
  is_available boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slots_date ON slots(slot_date);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE SET NULL,
  slot_id uuid REFERENCES slots(id) ON DELETE SET NULL,
  lesson_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit logs for moderation and admin actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  meta jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to tables that have updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_posts') THEN
    CREATE TRIGGER set_updated_at_posts BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_students') THEN
    CREATE TRIGGER set_updated_at_students BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END;
$$;

-- End of migration
