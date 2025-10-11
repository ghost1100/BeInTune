import bcrypt from "bcrypt";
import fs from "fs/promises";
import path from "path";
import { query } from ".";

export async function ensureDbSetup() {
  try {
    // Apply all SQL files in the migrations folder in alphabetical order.
    // Each migration script should be idempotent (use IF NOT EXISTS etc.).
    try {
      const migrationsDir = path.join(__dirname, "migrations");
      const entries = await fs.readdir(migrationsDir);
      const sqlFiles = entries.filter((f) => f.endsWith(".sql")).sort();
      for (const file of sqlFiles) {
        try {
          const migrationsPath = path.join(migrationsDir, file);
          const sql = await fs.readFile(migrationsPath, "utf-8");
          if (sql && sql.trim()) {
            await query(sql);
            console.log(`Applied migration: ${file}`);
          }
        } catch (e) {
          console.error(`Failed to apply migration ${file}:`, e);
        }
      }
    } catch (e) {
      console.error("Failed to read/apply migrations directory:", e);
    }

    // Add username column if missing (safe after migrations)
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;");
    // Create unique index on username
    await query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);",
    );

    // Add profile columns to users for teacher metadata
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS years text;");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS about text;");
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS image text;");

    // Ensure students table has extended fields used by the admin UI
    await query(
      "ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone text;",
    );
    await query(
      "ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contacts text;",
    );
    await query(
      "ALTER TABLE students ADD COLUMN IF NOT EXISTS allergies text;",
    );
    await query(
      "ALTER TABLE students ADD COLUMN IF NOT EXISTS medications text;",
    );
    await query(
      "ALTER TABLE students ADD COLUMN IF NOT EXISTS instruments jsonb;",
    );
    await query("ALTER TABLE students ADD COLUMN IF NOT EXISTS band text;");

    // Ensure comment, reaction, learning and audit tables exist
    await query(`CREATE TABLE IF NOT EXISTS comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
      author_id uuid REFERENCES users(id) ON DELETE SET NULL,
      body text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS post_reactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      type text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    // Ensure unique reaction per user per post
    await query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_post_reactions_unique ON post_reactions(post_id, user_id);",
    );

    // Message reactions (per-message reactions)
    await query(`CREATE TABLE IF NOT EXISTS message_reactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      type text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reactions_unique ON message_reactions(message_id, user_id);",
    );

    await query(`CREATE TABLE IF NOT EXISTS learning_resources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id uuid REFERENCES students(id) ON DELETE CASCADE,
      uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
      title text,
      description text,
      media jsonb DEFAULT '[]',
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

    // Notifications table for user alerts
    await query(`CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
      type text NOT NULL,
      meta jsonb DEFAULT '{}',
      is_read boolean DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      action text NOT NULL,
      meta jsonb DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

    // Ensure slots and bookings exist (in case migration wasn't applied)
    await query(`CREATE TABLE IF NOT EXISTS slots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
      slot_date date NOT NULL,
      slot_time time NOT NULL,
      duration_minutes int DEFAULT 30,
      is_available boolean DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id uuid REFERENCES students(id) ON DELETE SET NULL,
      slot_id uuid REFERENCES slots(id) ON DELETE SET NULL,
      lesson_type text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

    // Guest booking details (for visitors without a student account)
    await query(
      "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_name text;",
    );
    await query(
      "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_email text;",
    );
    await query(
      "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_phone text;",
    );
    // Store calendar event ID for cleanup
    await query(
      "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS calendar_event_id text;",
    );
    await query(
      "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_id text;",
    );

    // Prevent multiple bookings for the same slot: ensure one booking per slot_id
    try {
      // Clean up any existing duplicate bookings for the same slot_id by keeping the earliest created record
      try {
        await query(`
          DELETE FROM bookings
          WHERE id IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (PARTITION BY slot_id ORDER BY created_at ASC, id ASC) AS rn
              FROM bookings
              WHERE slot_id IS NOT NULL
            ) t WHERE t.rn > 1
          )
        `);
        console.log('Removed duplicate bookings for same slot_id');
      } catch (cleanupErr) {
        console.warn('Failed to cleanup duplicate bookings before creating unique index:', cleanupErr);
      }

      await query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_slot_id_unique ON bookings(slot_id) WHERE slot_id IS NOT NULL;",
      );
    } catch (e) {
      // ignore if index creation fails, but log for visibility
      console.warn("Failed to create unique index for bookings.slot_id:", e);
    }

    // Ensure admin user exists with username Darryle
    const adminIdentifier = process.env.ADMIN_EMAIL || "admin@intune.local";
    const adminUsername = process.env.ADMIN_USERNAME || "Darryle";
    const adminPassword = process.env.ADMIN_PASSWORD || "123654intune";

    const res = await query(
      "SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1",
      [adminUsername, adminIdentifier],
    );

    if (res.rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 10);
      const insert = await query(
        "INSERT INTO users(email, username, password_hash, role, email_verified, name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        [adminIdentifier, adminUsername, hash, "admin", true, adminUsername],
      );
      console.log("Seeded admin user", insert.rows[0].id);
    }
  } catch (err) {
    console.error("DB setup error:", err);
  }
}
