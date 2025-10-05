-- Add band to students and rooms table for group chats

ALTER TABLE students ADD COLUMN IF NOT EXISTS band text;

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- join table for room membership
CREATE TABLE IF NOT EXISTS room_members (
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, user_id)
);

-- index for quick lookup
CREATE INDEX IF NOT EXISTS idx_students_band ON students(band);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
