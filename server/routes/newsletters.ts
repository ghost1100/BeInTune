import express from "express";
import sgMail from "@sendgrid/mail";
import { query } from "../db";

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

const router = express.Router();

// POST /api/admin/newsletters
// Body: { subject, html, plain }
router.post("/newsletters", async (req, res) => {
  const { subject, html, plain } = req.body as {
    subject?: string;
    html?: string;
    plain?: string;
  };
  if (!subject || !html)
    return res.status(400).json({ error: "Missing subject or html" });

  // Insert record for audit/logging
  const createdBy = null; // could be filled from auth
  const insertRes = await query(
    "INSERT INTO newsletters(subject, html, plain, created_by) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
    [subject, html, plain || null, createdBy],
  );

  const newsletterId = insertRes.rows[0].id;

  // Collect recipients
  const recipientsRes = await query(
    `SELECT u.email FROM users u JOIN newsletter_subscriptions n ON n.user_id = u.id WHERE n.subscribed = true AND u.email IS NOT NULL`,
  );

  const to = recipientsRes.rows.map((r: any) => r.email).filter(Boolean);

  // Send in batches to avoid very large single requests
  const BATCH = 100;
  for (let i = 0; i < to.length; i += BATCH) {
    const batch = to.slice(i, i + BATCH);
    const msg = {
      personalizations: batch.map((email: string) => ({ to: [{ email }] })),
      from: process.env.FROM_EMAIL || "no-reply@example.com",
      subject,
      content: [
        { type: "text/plain", value: plain || "" },
        { type: "text/html", value: html },
      ],
    } as any;

    try {
      await sgMail.send(msg as any);
    } catch (err) {
      console.error("SendGrid send error:", err);
    }
  }

  // Mark sent_at
  await query("UPDATE newsletters SET sent_at = now() WHERE id = $1", [
    newsletterId,
  ]);

  res.json({ ok: true, id: newsletterId });
});

export default router;
