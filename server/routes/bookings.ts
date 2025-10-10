import express from "express";
import express from "express";
import { query } from "../db";
import { sendMail } from "../lib/mailer";

const router = express.Router();

function isWithinBusinessHours(time: string) {
  if (!time) return false;
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
  const total = hours * 60 + minutes;
  const start = 8 * 60;
  const end = 17 * 60;
  return total >= start && total <= end && minutes % 30 === 0;
}

// GET /api/admin/slots?date=YYYY-MM-DD
router.get("/slots", async (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const q = await query(
    "SELECT * FROM slots WHERE slot_date = $1 ORDER BY slot_time",
    [date],
  );
  res.json(q.rows);
});

// POST /api/admin/slots - create slot
router.post("/slots", async (req, res) => {
  const { teacher_id, slot_date, slot_time, duration_minutes } =
    req.body as any;
  if (!slot_date || !slot_time)
    return res.status(400).json({ error: "Missing slot_date or slot_time" });
  if (!isWithinBusinessHours(slot_time)) {
    return res.status(400).json({
      error: "Slots must be between 08:00 and 17:00 in 30-minute increments",
    });
  }
  const ins = await query(
    "INSERT INTO slots(teacher_id, slot_date, slot_time, duration_minutes, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id",
    [teacher_id || null, slot_date, slot_time, duration_minutes || 30],
  );
  res.json({ ok: true, id: ins.rows[0].id });
});

// DELETE /api/admin/slots/:id
router.delete("/slots/:id", async (req, res) => {
  const { id } = req.params;
  await query("DELETE FROM slots WHERE id = $1", [id]);
  res.json({ ok: true });
});

// GET /api/admin/bookings?date=YYYY-MM-DD
router.get("/bookings", async (req, res) => {
  const date = req.query.date ? String(req.query.date) : null;
  try {
    let q;
    if (date) {
      q = await query(
        `SELECT
           b.id,
           b.lesson_type,
           b.created_at,
           s.user_id as student_user_id,
           u.email as student_email,
           u.name as student_name,
           b.guest_name as guest_name,
           b.guest_email as guest_email,
           b.guest_phone as guest_phone,
           COALESCE(u.name, b.guest_name) as name,
           COALESCE(u.email, b.guest_email) as email,
           COALESCE(u.phone, b.guest_phone) as phone,
           sl.id as slot_id,
           sl.slot_time as time,
           sl.slot_date as date
         FROM bookings b
         LEFT JOIN slots sl ON b.slot_id = sl.id
         LEFT JOIN students s ON b.student_id = s.id
         LEFT JOIN users u ON s.user_id = u.id
         WHERE sl.slot_date = $1
         ORDER BY sl.slot_time ASC`,
        [date],
      );
    } else {
      q = await query(
        `SELECT
           b.id,
           b.lesson_type,
           b.created_at,
           s.user_id as student_user_id,
           u.email as student_email,
           u.name as student_name,
           b.guest_name as guest_name,
           b.guest_email as guest_email,
           b.guest_phone as guest_phone,
           COALESCE(u.name, b.guest_name) as name,
           COALESCE(u.email, b.guest_email) as email,
           COALESCE(u.phone, b.guest_phone) as phone,
           sl.id as slot_id,
           sl.slot_time as time,
           sl.slot_date as date
         FROM bookings b
         LEFT JOIN slots sl ON b.slot_id = sl.id
         LEFT JOIN students s ON b.student_id = s.id
         LEFT JOIN users u ON s.user_id = u.id
         ORDER BY sl.slot_date DESC, sl.slot_time ASC`,
      );
    }
    // attempt to decrypt guest fields if encrypted
    try {
      const { decryptText } = await import("../lib/crypto");
      const rows = q.rows.map((r: any) => {
        const out = { ...r };
        try {
          if (out.guest_name) {
            const parsed =
              typeof out.guest_name === "string"
                ? JSON.parse(out.guest_name)
                : out.guest_name;
            const dec = decryptText(parsed);
            out.guest_name = dec || out.guest_name;
          }
        } catch (e) {
          // ignore
        }
        try {
          if (out.guest_email) {
            const parsed =
              typeof out.guest_email === "string"
                ? JSON.parse(out.guest_email)
                : out.guest_email;
            const dec = decryptText(parsed);
            out.guest_email = dec || out.guest_email;
          }
        } catch (e) {
          // ignore
        }
        try {
          if (out.guest_phone) {
            const parsed =
              typeof out.guest_phone === "string"
                ? JSON.parse(out.guest_phone)
                : out.guest_phone;
            const dec = decryptText(parsed);
            out.guest_phone = dec || out.guest_phone;
          }
        } catch (e) {
          // ignore
        }
        // Ensure public-facing name/email/phone use decrypted guest values when user values are absent
        out.name = out.student_name || out.guest_name || out.name;
        out.email = out.student_email || out.guest_email || out.email;
        out.phone = out.guest_phone || out.phone;
        return out;
      });
      res.json(rows);
    } catch (e) {
      res.json(q.rows);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load bookings" });
  }
});

// POST /api/admin/bookings - create booking
router.post("/bookings", async (req, res) => {
  const { student_id, slot_id, lesson_type, name, email, phone } =
    req.body as any;
  if (!slot_id) return res.status(400).json({ error: "Missing slot_id" });
  const slotRes = await query("SELECT * FROM slots WHERE id = $1", [slot_id]);
  if (!slotRes.rows[0])
    return res.status(404).json({ error: "Slot not found" });

  try {
    // encrypt guest fields if encryption key present
    const { encryptText } = await import("../lib/crypto");
    const nameEnc = name ? encryptText(String(name)) : null;
    const emailEnc = email ? encryptText(String(email)) : null;
    const phoneEnc = phone ? encryptText(String(phone)) : null;
    const nameToStore =
      nameEnc && nameEnc.encrypted ? JSON.stringify(nameEnc) : name || null;
    const emailToStore =
      emailEnc && emailEnc.encrypted ? JSON.stringify(emailEnc) : email || null;
    const phoneToStore =
      phoneEnc && phoneEnc.encrypted ? JSON.stringify(phoneEnc) : phone || null;

    const ins = await query(
      "INSERT INTO bookings(student_id, slot_id, lesson_type, guest_name, guest_email, guest_phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at",
      [
        student_id || null,
        slot_id,
        lesson_type || null,
        nameToStore,
        emailToStore,
        phoneToStore,
      ],
    );
    // mark slot unavailable
    await query("UPDATE slots SET is_available = false WHERE id = $1", [
      slot_id,
    ]);
    res.json({
      ok: true,
      bookingId: ins.rows[0].id,
      created_at: ins.rows[0].created_at,
    });
  } catch (e) {
    console.error("Failed to create booking:", e);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// DELETE /api/admin/bookings/:id
router.delete("/bookings/:id", async (req, res) => {
  const { id } = req.params;
  const { reason = null, notify = true } = req.body || {};

  try {
    // load booking details for notification
    const infoQ = await query(
      `SELECT b.id, b.lesson_type, b.guest_name, b.guest_email, b.guest_phone, s.user_id as student_user_id, u.email as user_email, u.name as user_name, sl.id as slot_id, sl.slot_time as time, sl.slot_date as date
       FROM bookings b
       LEFT JOIN slots sl ON b.slot_id = sl.id
       LEFT JOIN students s ON b.student_id = s.id
       LEFT JOIN users u ON s.user_id = u.id
       WHERE b.id = $1 LIMIT 1`,
      [id],
    );
    const info = infoQ.rows[0];

    // send notification if requested
    if (notify && info) {
      const toEmail = info.user_email || info.guest_email || null;
      const toName = info.user_name || info.guest_name || "";
      if (toEmail && process.env.SENDGRID_API_KEY) {
        try {
          const subject = `Lesson cancelled: ${info.date} ${info.time}`;
          const plain = `Hello ${toName},\n\nYour lesson scheduled for ${info.date} at ${info.time} has been cancelled.${reason ? `\n\nReason: ${reason}` : ""}\n\nWe apologise for the inconvenience.`;
          const html = `<p>Hello ${toName},</p><p>Your lesson scheduled for <strong>${info.date} at ${info.time}</strong> has been cancelled.</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}<p>We apologise for the inconvenience.</p>`;
          try {
            await sendMail({ to: toEmail, from: process.env.FROM_EMAIL || "no-reply@example.com", subject, text: plain, html });
          } catch (e) {
            console.error("Failed to send cancellation email", e);
          }
        } catch (e) {
          console.error("Failed to send cancellation email", e);
        }
      }
    }

    // free the slot if exists
    if (info && info.slot_id) {
      await query("UPDATE slots SET is_available = true WHERE id = $1", [
        info.slot_id,
      ]);
    } else {
      const bRes = await query("SELECT slot_id FROM bookings WHERE id = $1", [
        id,
      ]);
      if (bRes.rows[0]) {
        const slotId = bRes.rows[0].slot_id;
        if (slotId)
          await query("UPDATE slots SET is_available = true WHERE id = $1", [
            slotId,
          ]);
      }
    }

    await query("DELETE FROM bookings WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to cancel booking:", err);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

export default router;
