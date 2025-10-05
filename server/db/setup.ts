import { query } from "./index";
import bcrypt from "bcrypt";
import fs from "fs/promises";
import path from "path";

export async function ensureDbSetup() {
  try {
    // If users table is missing, run the initial migration SQL
    const check = await query("SELECT to_regclass('public.users') as reg");
    const exists = check.rows[0] && check.rows[0].reg;
    if (!exists) {
      try {
        const migrationsPath = path.join(__dirname, "migrations", "001_init.sql");
        const sql = await fs.readFile(migrationsPath, "utf-8");
        await query(sql);
        console.log("Applied initial DB migrations");
      } catch (e) {
        console.error("Failed to apply migrations:", e);
        throw e;
      }
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
