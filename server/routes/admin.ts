import express from "express";
import bcrypt from "bcrypt";
import { query } from "../db";

const router = express.Router();

// POST /api/admin/users/:id/set-password
router.post("/users/:id/set-password", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body as { password?: string };
  if (!password) return res.status(400).json({ error: "Missing password" });
  if (!id) return res.status(400).json({ error: "Missing user id" });

  const hash = await bcrypt.hash(password, 10);
  await query("UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2", [hash, id]);

  // Log audit
  await query("INSERT INTO audit_logs(user_id, action, meta) VALUES ($1, $2, $3)", [null, "admin:set-password", JSON.stringify({ userId: id })]);

  res.json({ ok: true });
});

// POST /api/admin/me/update
// body: { identifier, currentPassword, newUsername?, newPassword? }
router.post("/me/update", async (req, res) => {
  const { identifier, currentPassword, newUsername, newPassword } = req.body as {
    identifier?: string;
    currentPassword?: string;
    newUsername?: string;
    newPassword?: string;
  };
  if (!identifier || !currentPassword) return res.status(400).json({ error: "Missing identifier or currentPassword" });

  const userRes = await query("SELECT id, username, email, password_hash FROM users WHERE lower(email)=lower($1) OR lower(username)=lower($1) LIMIT 1", [identifier]);
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });

  const match = user.password_hash ? await bcrypt.compare(currentPassword, user.password_hash) : false;
  if (!match) return res.status(401).json({ error: "Invalid current password" });

  if (newUsername) {
    await query("UPDATE users SET username = $1 WHERE id = $2", [newUsername, user.id]);
  }
  if (newPassword) {
    const h = await bcrypt.hash(newPassword, 10);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [h, user.id]);
  }

  await query("INSERT INTO audit_logs(user_id, action, meta) VALUES ($1, $2, $3)", [user.id, "user:update-self", JSON.stringify({ newUsername: !!newUsername, newPassword: !!newPassword })]);

  res.json({ ok: true });
});

export default router;
