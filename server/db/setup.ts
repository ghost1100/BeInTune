import { query } from "./index";
import bcrypt from "bcrypt";

export async function ensureDbSetup() {
  try {
    // Add username column if missing
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;");
    // Create unique index on username
    await query("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);");

    // Ensure admin user exists with username Darryle
    const adminIdentifier = process.env.ADMIN_EMAIL || "admin@intune.local";
    const adminUsername = process.env.ADMIN_USERNAME || "Darryle";
    const adminPassword = process.env.ADMIN_PASSWORD || "123654intune";

    const res = await query(
      "SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1",
      [adminUsername, adminIdentifier]
    );

    if (res.rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 10);
      const insert = await query(
        "INSERT INTO users(email, username, password_hash, role, email_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [adminIdentifier, adminUsername, hash, "admin", true]
      );
      console.log("Seeded admin user", insert.rows[0].id);
    }
  } catch (err) {
    console.error("DB setup error:", err);
  }
}
