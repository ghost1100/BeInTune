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

  // Search by email (via index) or username (case-insensitive)
  const { digest, decryptText } = await import("../lib/crypto");
  const idx = identifier && identifier.includes("@") ? digest(identifier) : null;
  let userRes;
  if (idx) {
    userRes = await query(
      "SELECT id, email, email_encrypted, username, password_hash, role, is_active FROM users WHERE email_index = $1 OR lower(username) = lower($2) LIMIT 1",
      [idx, identifier],
    );
  }
  if (!userRes || !userRes.rows || userRes.rows.length === 0) {
    userRes = await query(
      "SELECT id, email, email_encrypted, username, password_hash, role, is_active FROM users WHERE lower(email) = lower($1) OR lower(username) = lower($1) LIMIT 1",
      [identifier],
    );
  }
  const user = userRes.rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  // if email_encrypted present, decrypt before returning
  if (!user.email && user.email_encrypted) {
    try {
      const parsed = typeof user.email_encrypted === 'string' ? JSON.parse(user.email_encrypted) : user.email_encrypted;
      const dec = decryptText(parsed);
      if (dec) user.email = dec;
    } catch (e) {
      // ignore
    }
  }
  if (!user.is_active)
    return res.status(403).json({ error: "Account inactive" });

  const match = user.password_hash
    ? await bcrypt.compare(password, user.password_hash)
    : false;
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  // issue JWT
  const jwt = (await import("jsonwebtoken")).default;
  const SECRET = process.env.JWT_SECRET || "changeme123";
  const token = jwt.sign({ sub: user.id, role: user.role }, SECRET, {
    expiresIn: "7d",
  });

  // set httpOnly cookie
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    token,
  });
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const jwt = (await import("jsonwebtoken")).default;
    const SECRET = process.env.JWT_SECRET || "changeme123";
    const decoded: any = jwt.verify(token, SECRET);
    const { decryptText } = await import('../lib/crypto');
    const userRes = await query(
      "SELECT id, email, email_encrypted, username, role FROM users WHERE id = $1",
      [decoded.sub],
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.email && user.email_encrypted) {
      try {
        const parsed = typeof user.email_encrypted === 'string' ? JSON.parse(user.email_encrypted) : user.email_encrypted;
        const dec = decryptText(parsed);
        if (dec) user.email = dec;
      } catch (e) {}
    }
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  try {
    // clear cookie by setting empty token with immediate expiry
    res.cookie("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(0),
    });
  } catch (err) {
    console.error("Error clearing cookie:", err);
  }
  return res.json({ ok: true });
});

// POST /api/auth/send-reset
router.post("/send-reset", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: "Missing email" });

  const { digest, decryptText } = await import('../lib/crypto');
  const idx = digest(email);
  let userRes = await query("SELECT id, email, email_encrypted FROM users WHERE email_index = $1", [idx]);
  if (!userRes.rows.length) {
    userRes = await query("SELECT id, email, email_encrypted FROM users WHERE email = $1", [email]);
  }
  const user = userRes.rows[0];
  // Always return success to avoid leaking existence
  if (!user) return res.json({ ok: true });

  // determine email to send to
  let sendTo = user.email;
  if (!sendTo && user.email_encrypted) {
    try {
      const parsed = typeof user.email_encrypted === 'string' ? JSON.parse(user.email_encrypted) : user.email_encrypted;
      const dec = decryptText(parsed);
      if (dec) sendTo = dec;
    } catch (e) {}
  }

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
