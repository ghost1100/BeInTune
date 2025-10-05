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

export default router;
