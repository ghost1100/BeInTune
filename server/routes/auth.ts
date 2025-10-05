import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import { query } from "../db";

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body as {
    identifier?: string;
    password?: string;
  };
  if (!identifier || !password)
    return res.status(400).json({ error: "Missing identifier or password" });

  // Search by email or username (case-insensitive)
  const userRes = await query(
    "SELECT id, email, username, password_hash, role, is_active FROM users WHERE lower(email) = lower($1) OR lower(username) = lower($1) LIMIT 1",
    [identifier],
  );
  const user = userRes.rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  if (!user.is_active)
    return res.status(403).json({ error: "Account inactive" });

  const match = user.password_hash
    ? await bcrypt.compare(password, user.password_hash)
    : false;
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  // Do not issue tokens here; caller can implement sessions/JWT. Return basic user info.
  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });
});

// POST /api/auth/send-reset
router.post("/send-reset", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: "Missing email" });

  const userRes = await query("SELECT id, email FROM users WHERE email = $1", [
    email,
  ]);
  const user = userRes.rows[0];

  // Always return success to avoid leaking existence
  if (!user) return res.json({ ok: true });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await query(
    "UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3",
    [token, expiresAt.toISOString(), user.id],
  );

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetLink = `${frontendUrl}/admin/reset?token=${token}`;

  const msg = {
    to: user.email,
    from: process.env.FROM_EMAIL || "no-reply@example.com",
    subject: "Password reset",
    text: `You requested a password reset. Use this link to reset your password: ${resetLink}`,
    html: `<p>You requested a password reset. Click <a href=\"${resetLink}\">here</a> to reset your password. This link expires in 1 hour.</p>`,
  };

  try {
    await sgMail.send(msg);
  } catch (err) {
    console.error("SendGrid error:", err);
  }

  return res.json({ ok: true });
});

export default router;
