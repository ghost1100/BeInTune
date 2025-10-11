import express from "express";
import express from "express";
import { query } from "../db";
import { sendMail } from "../lib/mailer";
import { requireAdmin } from "../middleware/auth";

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
           COALESCE(u.phone, s.phone, b.guest_phone) as phone,
           s.instruments as student_instruments,
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
           COALESCE(u.phone, s.phone, b.guest_phone) as phone,
           s.instruments as student_instruments,
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
        // Include student instruments when available (students.instruments may be JSON)
        try {
          if (out.student_instruments) {
            if (Array.isArray(out.student_instruments)) {
              out.instruments = out.student_instruments;
            } else if (typeof out.student_instruments === "string") {
              out.instruments = JSON.parse(out.student_instruments);
            } else {
              out.instruments = out.student_instruments;
            }
          }
        } catch (e) {
          out.instruments = out.student_instruments || null;
        }
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

// POST /api/admin/bookings/cancel-all - cancel all bookings on a date (admin only)
router.post("/bookings/cancel-all", requireAdmin, async (req, res) => {
  const { date, reason } = req.body || {};
  if (!date) return res.status(400).json({ error: "Missing date" });
  try {
    const q = await query(
      `SELECT b.id, b.lesson_type, b.guest_name, b.guest_email, b.guest_phone, b.calendar_event_id, b.recurrence_id, s.user_id as student_user_id, u.email as student_email, u.name as student_name, sl.id as slot_id, sl.slot_time as time, sl.slot_date as date
         FROM bookings b
         LEFT JOIN slots sl ON b.slot_id = sl.id
         LEFT JOIN students s ON b.student_id = s.id
         LEFT JOIN users u ON s.user_id = u.id
         WHERE sl.slot_date = $1`,
      [date],
    );
    const rows = q.rows || [];
    if (!rows.length) return res.json({ ok: true, cancelled: 0 });

    const byEmail: Record<string, any[]> = {};
    const slotIdsToFree: string[] = [];
    const bookingIds: string[] = [];
    for (const r of rows) {
      const email = r.student_email || r.guest_email || null;
      if (email) {
        byEmail[email] = byEmail[email] || [];
        byEmail[email].push(r);
      }
      if (r.slot_id) slotIdsToFree.push(r.slot_id);
      if (r.id) bookingIds.push(r.id);
    }

    for (const email of Object.keys(byEmail)) {
      const list = byEmail[email];
      const linesText = list
        .map((it: any) => `- ${it.time} — ${it.lesson_type || "Lesson"}`)
        .join("\n");
      const linesHtml = `<ul>${list
        .map((it: any) => `<li>${it.time} — ${it.lesson_type || "Lesson"}</li>`)
        .join("")}</ul>`;
      const subject = `All sessions on ${date} cancelled`;
      const plain = `Hello,\n\nThe following session(s) scheduled for ${date} have been cancelled:\n\n${linesText}\n\nReason: ${reason || "Not specified"}\n\nWe apologise for the inconvenience.`;
      const html = `<p>Hello,</p><p>The following session(s) scheduled for <strong>${date}</strong> have been cancelled:</p>${linesHtml}<p><strong>Reason:</strong> ${reason || "Not specified"}</p><p>We apologise for the inconvenience.</p>`;
      try {
        await sendMail({
          to: email,
          from: process.env.FROM_EMAIL || "no-reply@example.com",
          subject,
          text: plain,
          html,
        });
      } catch (e) {
        console.error("Failed to send cancellation summary to", email, e);
      }
    }

    // Attempt to remove calendar events for the affected bookings (delete specific instances for recurring events)
    try {
      const { deleteCalendarEvent, deleteRecurringInstance } = await import(
        "../lib/calendar"
      );
      for (const r of rows) {
        try {
          if (r.recurrence_id) {
            try {
              const parts = String(r.date).split("-").map(Number);
              const tparts = String(r.time || "")
                .split(":")
                .map(Number);
              const y = parts[0],
                m = parts[1] - 1,
                d = parts[2];
              const hh = tparts[0] || 0,
                mm = tparts[1] || 0;
              const instStart = new Date(y, m, d, hh, mm, 0);
              await deleteRecurringInstance(
                r.recurrence_id,
                instStart.toISOString(),
              );
              console.log(
                "Cancelled recurring instance on calendar for booking",
                r.id,
                r.recurrence_id,
              );
            } catch (inner) {
              try {
                await deleteCalendarEvent(r.recurrence_id);
                console.log(
                  "Deleted recurring calendar event for booking (fallback)",
                  r.id,
                  r.recurrence_id,
                );
              } catch (inn2) {
                console.warn(
                  "Failed to delete recurring calendar event for booking",
                  r.id,
                  inn2,
                );
              }
            }
          } else if (r.calendar_event_id) {
            try {
              await deleteCalendarEvent(r.calendar_event_id);
              console.log(
                "Deleted calendar event for booking",
                r.id,
                r.calendar_event_id,
              );
            } catch (inner) {
              console.warn(
                "Failed to delete calendar event for booking",
                r.id,
                inner,
              );
            }
          }
        } catch (e) {
          console.warn(
            "Failed to handle calendar deletion for booking",
            r.id,
            e,
          );
        }
      }
    } catch (e) {
      console.warn("Failed to load calendar module for bulk cancellation", e);
    }

    if (slotIdsToFree.length) {
      const uniq = Array.from(new Set(slotIdsToFree));
      for (const sid of uniq) {
        try {
          await query("UPDATE slots SET is_available = true WHERE id = $1", [
            sid,
          ]);
        } catch (e) {
          console.error("Failed to free slot", sid, e);
        }
      }
    }

    if (bookingIds.length) {
      const uniqB = Array.from(new Set(bookingIds));
      const placeholders = uniqB.map((_, i) => `$${i + 1}`).join(",");
      try {
        await query(
          `DELETE FROM bookings WHERE id IN (${placeholders})`,
          uniqB,
        );
      } catch (e) {
        console.error("Failed to delete bookings in bulk", e);
      }
    }

    return res.json({ ok: true, cancelled: rows.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to cancel bookings" });
  }
});

// POST /api/admin/bookings - create booking
router.post("/bookings", async (req, res) => {
  const { student_id, slot_id, lesson_type, name, email, phone, recurrence } =
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

    // Fetch booking details joined to users/students for notification
    try {
      const infoQ = await query(
        `SELECT b.id, b.lesson_type, b.guest_name, b.guest_email, b.guest_phone, s.user_id as student_user_id, u.email as user_email, u.name as user_name, s.instruments as student_instruments, u.phone as user_phone, s.phone as student_phone, sl.id as slot_id, sl.slot_time as time, sl.slot_date as date
         FROM bookings b
         LEFT JOIN slots sl ON b.slot_id = sl.id
         LEFT JOIN students s ON b.student_id = s.id
         LEFT JOIN users u ON s.user_id = u.id
         WHERE b.id = $1 LIMIT 1`,
        [ins.rows[0].id],
      );
      const info = infoQ.rows[0];

      // send confirmation email to booking recipient
      try {
        const toEmail = info?.user_email || info?.guest_email || null;
        const toName = info?.user_name || info?.guest_name || "";
        if (toEmail) {
          const subject = `Lesson booked: ${info.date} ${info.time}`;
          const plain = `Hello ${toName},\n\nYour lesson has been booked for ${info.date} at ${info.time}.\n\nDetails:\n- Lesson: ${info.lesson_type || "Lesson"}\n\nSee you then.`;
          const html = `<p>Hello ${toName},</p><p>Your lesson has been booked for <strong>${info.date} at ${info.time}</strong>.</p><p><strong>Lesson:</strong> ${info.lesson_type || "Lesson"}</p><p>See you then.</p>`;
          try {
            const { sendMail } = await import("../lib/mailer");
            console.log("Sending booking confirmation to", toEmail);
            await sendMail({
              to: toEmail,
              from: process.env.FROM_EMAIL || "no-reply@example.com",
              subject,
              text: plain,
              html,
            });
            console.log("Booking confirmation sent to", toEmail);
          } catch (err) {
            console.error("Failed to send booking confirmation", err);
          }
        } else {
          console.warn(
            "No recipient email available for booking",
            ins.rows[0].id,
          );
        }
      } catch (err) {
        console.error("Booking notification error:", err);
      }

      // Create calendar event (if configured). Supports optional recurrence (RRULE string in req.body.recurrence)
      try {
        const { createCalendarEvent } = await import("../lib/calendar");
        const slot = slotRes.rows[0];
        const date = slot.slot_date; // YYYY-MM-DD
        const time = slot.slot_time; // HH:MM
        const duration = slot.duration_minutes || 30;
        // Construct start/end ISO timestamps more robustly to avoid Invalid Date errors
        const makeIso = (dStr: any, tStr: string, durMin: number) => {
          try {
            if (!dStr || !tStr) throw new Error("Missing date or time");
            let y: number, m: number, day: number;
            if (dStr instanceof Date) {
              const dt = dStr as Date;
              y = dt.getFullYear();
              m = dt.getMonth() + 1;
              day = dt.getDate();
            } else if (typeof dStr === "string") {
              if (dStr.includes("T")) {
                const dt = new Date(dStr);
                if (isNaN(dt.getTime())) throw new Error("Invalid date string");
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                day = dt.getDate();
              } else {
                const parts = dStr.split("-").map(Number);
                if (parts.length !== 3) throw new Error("Invalid date format");
                [y, m, day] = parts;
              }
            } else {
              throw new Error("Unsupported date type");
            }
            const tParts = String(tStr).split(":").map(Number);
            if (tParts.length < 2) throw new Error("Invalid time format");
            const hh = tParts[0] || 0;
            const mm = tParts[1] || 0;
            // Construct local date/time strings (no Z) so Google can apply the provided timezone correctly
            const pad = (n: number) => String(n).padStart(2, "0");
            const startLocal = `${y}-${pad(m)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00`;
            const endDate = new Date(y, (m || 1) - 1, day, hh, mm, 0, 0);
            endDate.setMinutes(endDate.getMinutes() + (durMin || 30));
            const endLocal = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;
            return { startIso: startLocal, endIso: endLocal };
          } catch (err) {
            console.error(
              "Failed to construct ISO timestamps for",
              dStr,
              tStr,
              err,
            );
            throw err;
          }
        };
        const { startIso, endIso } = makeIso(date, time, duration);
        const endDt = endIso;
        const attendees: string[] = [];
        if (info?.guest_email) attendees.push(info.guest_email);
        if (info?.user_email && !attendees.includes(info.user_email))
          attendees.push(info.user_email);
        // Build a richer description with name, instruments and phone where available
        let instrumentsText = "";
        try {
          if (info && info.student_instruments) {
            if (Array.isArray(info.student_instruments))
              instrumentsText = info.student_instruments.join(", ");
            else if (typeof info.student_instruments === "string")
              instrumentsText = JSON.parse(
                info.student_instruments || "[]",
              ).join(", ");
          }
        } catch (e) {
          instrumentsText = String(info.student_instruments || "");
        }
        const contactPhone =
          info?.guest_phone || info?.student_phone || info?.user_phone || "";
        const who = info?.guest_name || info?.user_name || email || "guest";
        const descParts = [
          `Booking for ${who}`,
          instrumentsText ? `Instruments: ${instrumentsText}` : null,
          contactPhone ? `Phone: ${contactPhone}` : null,
        ].filter(Boolean);

        console.log("Booking created, preparing calendar event", {
          bookingId: ins.rows[0].id,
          slotId: slot.id,
          date,
          time,
          startIso,
          endDt,
          attendees,
        });
        try {
          // Create event without attendees to avoid service account invitation restrictions
          // Idempotency: try to reuse an existing calendar event for this slot (avoid duplicates)
          let ev: any = null;
          try {
            const existsQ = await query(
              "SELECT calendar_event_id, recurrence_id FROM bookings WHERE slot_id = $1 AND (calendar_event_id IS NOT NULL OR recurrence_id IS NOT NULL) LIMIT 1",
              [slot.id],
            );
            if (existsQ && existsQ.rows && existsQ.rows[0] && (existsQ.rows[0].calendar_event_id || existsQ.rows[0].recurrence_id)) {
              ev = { id: existsQ.rows[0].calendar_event_id || existsQ.rows[0].recurrence_id };
              try {
                await query("UPDATE bookings SET calendar_event_id = $1, recurrence_id = $2 WHERE id = $3", [ev.id, existsQ.rows[0].recurrence_id || null, ins.rows[0].id]);
                console.log("Reused existing calendar event for slot", slot.id, ev.id);
              } catch (e) {
                console.warn("Failed to persist reused calendar id", e);
              }
            }
          } catch (e) {
            console.warn("Failed to check for existing calendar event", e);
          }

          if (!ev) {
            ev = await createCalendarEvent({
              summary: `Lesson: ${info?.lesson_type || lesson_type || "Lesson"}`,
              description: descParts.join("\n"),
              startDateTime: startIso,
              endDateTime: endDt,
              recurrence: recurrence ? [String(recurrence)] : undefined,
            });
          }

          console.log(
            "Calendar event created/reused for booking",
            ins.rows[0].id,
            { eventId: ev && ev.id },
          );
          try {
            if (ev && ev.id) {
              const recurrenceIdToStore = recurrence ? ev.id : null;
              await query(
                "UPDATE bookings SET calendar_event_id = $1, recurrence_id = $2 WHERE id = $3",
                [ev.id, recurrenceIdToStore, ins.rows[0].id],
              );

              // If a recurrence RRULE with COUNT is provided, create DB slots and bookings for each occurrence
              try {
                if (recurrence && typeof recurrence === 'string') {
                  const rStr = String(recurrence);
                  const m = rStr.match(/COUNT=(\d+)/i);
                  const count = m ? parseInt(m[1], 10) : null;
                  if (count && count > 1) {
                    // create remaining occurrences (we already have the first)
                    for (let i = 1; i < count; i++) {
                      try {
                        const dt = new Date(
                          date + "T" + (time || "00:00") + ":00",
                        );
                        dt.setDate(dt.getDate() + i * 7); // weekly increment
                        const pad = (n: number) => String(n).padStart(2, "0");
                        const slotDate = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
                        const slotTime = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`; // reuse computed time
                        // avoid duplicating slots/bookings if they already exist
                        let newSlotId: string | null = null;
                        try {
                          const existingSlot = await query(
                            "SELECT id FROM slots WHERE slot_date = $1 AND slot_time = $2 LIMIT 1",
                            [slotDate, slotTime],
                          );
                          if (existingSlot && existingSlot.rows && existingSlot.rows[0]) {
                            newSlotId = existingSlot.rows[0].id;
                          } else {
                            const insSlot = await query(
                              "INSERT INTO slots(teacher_id, slot_date, slot_time, duration_minutes, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id",
                              [
                                slot.teacher_id || null,
                                slotDate,
                                slotTime,
                                duration || 30,
                              ],
                            );
                            newSlotId = insSlot.rows[0].id;
                          }
                        } catch (innerSlotErr) {
                          console.warn('Failed to ensure slot for recurring occurrence', innerSlotErr);
                        }
                        if (newSlotId) {
                          // avoid duplicate booking for same recurrence/slot
                          try {
                            const existingBk = await query(
                              "SELECT id FROM bookings WHERE slot_id = $1 AND recurrence_id = $2 LIMIT 1",
                              [newSlotId, ev.id],
                            );
                            if (!(existingBk && existingBk.rows && existingBk.rows[0])) {
                              await query(
                                "INSERT INTO bookings(student_id, slot_id, lesson_type, guest_name, guest_email, guest_phone, calendar_event_id, recurrence_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                                [
                                  student_id || null,
                                  newSlotId,
                                  lesson_type || null,
                                  nameToStore,
                                  emailToStore,
                                  phoneToStore,
                                  ev.id,
                                  ev.id,
                                ],
                              );
                            }
                          } catch (innerBkErr) {
                            console.warn('Failed to insert booking for recurring occurrence', innerBkErr);
                          }
                        }
                      } catch (inner) {
                        console.warn(
                          "Failed to create booking for recurring occurrence",
                          i,
                          inner,
                        );
                      }
                    }
                  } else {
                    // try UNTIL=YYYYMMDDTHHMMSSZ or similar
                    const um = rStr.match(/UNTIL=([0-9TZ:+-]+)/i);
                    if (um) {
                      try {
                        const untilRaw = um[1];
                        // Normalize to ISO string: YYYYMMDDTHHMMSSZ -> YYYY-MM-DDTHH:MM:SSZ
                        let untilIso = untilRaw;
                        const dmatch = untilRaw.match(/^(\d{8})T?(\d{6})?Z?$/);
                        if (dmatch) {
                          const datePart = dmatch[1];
                          const timePart = dmatch[2] || "000000";
                          const yyyy = datePart.slice(0, 4);
                          const mm = datePart.slice(4, 6);
                          const dd = datePart.slice(6, 8);
                          const hh = timePart.slice(0, 2);
                          const mi = timePart.slice(2, 4);
                          const ss = timePart.slice(4, 6);
                          untilIso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
                        }
                        const untilDate = new Date(untilIso);
                        // iterate weekly from next occurrence until untilDate (inclusive)
                        let cur = new Date(
                          date + "T" + (time || "00:00") + ":00",
                        );
                        const oneWeek = 7 * 24 * 60 * 60 * 1000;
                        const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                        // advance to first instance after the original (we already created the first booking)
                        cur = new Date(cur.getTime() + oneWeek);
                        let occ = 1;
                        while (dateKey(cur) <= dateKey(untilDate)) {
                          try {
                            const pad = (n: number) =>
                              String(n).padStart(2, "0");
                            const slotDate = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
                            const slotTime = `${String(cur.getHours()).padStart(2, "0")}:${String(cur.getMinutes()).padStart(2, "0")}`;
                            // avoid duplicating slots/bookings if they already exist
                        let newSlotId: string | null = null;
                        try {
                          const existingSlot = await query(
                            "SELECT id FROM slots WHERE slot_date = $1 AND slot_time = $2 LIMIT 1",
                            [slotDate, slotTime],
                          );
                          if (existingSlot && existingSlot.rows && existingSlot.rows[0]) {
                            newSlotId = existingSlot.rows[0].id;
                          } else {
                            const insSlot = await query(
                              "INSERT INTO slots(teacher_id, slot_date, slot_time, duration_minutes, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id",
                              [
                                slot.teacher_id || null,
                                slotDate,
                                slotTime,
                                duration || 30,
                              ],
                            );
                            newSlotId = insSlot.rows[0].id;
                          }
                        } catch (innerSlotErr) {
                          console.warn('Failed to ensure slot for recurring occurrence', innerSlotErr);
                        }
                        if (newSlotId) {
                          // avoid duplicate booking for same recurrence/slot
                          try {
                            const existingBk = await query(
                              "SELECT id FROM bookings WHERE slot_id = $1 AND recurrence_id = $2 LIMIT 1",
                              [newSlotId, ev.id],
                            );
                            if (!(existingBk && existingBk.rows && existingBk.rows[0])) {
                              await query(
                                "INSERT INTO bookings(student_id, slot_id, lesson_type, guest_name, guest_email, guest_phone, calendar_event_id, recurrence_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                                [
                                  student_id || null,
                                  newSlotId,
                                  lesson_type || null,
                                  nameToStore,
                                  emailToStore,
                                  phoneToStore,
                                  ev.id,
                                  ev.id,
                                ],
                              );
                            }
                          } catch (innerBkErr) {
                            console.warn('Failed to insert booking for recurring occurrence', innerBkErr);
                          }
                        }
                          } catch (inner) {
                            console.warn(
                              "Failed to create booking for recurring occurrence until",
                              cur,
                              inner,
                            );
                          }
                          occ++;
                          cur = new Date(cur.getTime() + oneWeek);
                        }
                      } catch (inner) {
                        console.warn(
                          "Failed to expand UNTIL-based recurring bookings:",
                          inner,
                        );
                      }
                    }
                  }
                }
              } catch (inner) {
                console.warn(
                  "Failed to expand recurring bookings into DB rows:",
                  inner,
                );
              }
            }
          } catch (e) {
            console.error("Failed to persist calendar_event_id on booking", e);
          }
        } catch (err) {
          console.error("Failed to create calendar event:", err);
        }
      } catch (err) {
        console.error("Calendar module load/create skipped or failed:", err);
      }
    } catch (err) {
      console.error("Failed to load booking info for notification:", err);
    }

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

// POST /api/admin/bookings/:id/resend-notification - resend email/calendar for booking
router.post("/bookings/:id/resend-notification", async (req, res) => {
  const { id } = req.params;
  try {
    const infoQ = await query(
      `SELECT b.id, b.lesson_type, b.guest_name, b.guest_email, b.guest_phone, s.user_id as student_user_id, u.email as user_email, u.name as user_name, s.instruments as student_instruments, u.phone as user_phone, s.phone as student_phone, sl.id as slot_id, sl.slot_time as time, sl.slot_date as date
       FROM bookings b
       LEFT JOIN slots sl ON b.slot_id = sl.id
       LEFT JOIN students s ON b.student_id = s.id
       LEFT JOIN users u ON s.user_id = u.id
       WHERE b.id = $1 LIMIT 1`,
      [id],
    );
    if (!infoQ.rows[0])
      return res.status(404).json({ error: "Booking not found" });
    const info = infoQ.rows[0];
    const toEmail = info.user_email || info.guest_email || null;
    const toName = info.user_name || info.guest_name || "";
    if (!toEmail)
      return res
        .status(400)
        .json({ error: "No recipient email for this booking" });

    const subject = `Lesson booked: ${info.date} ${info.time}`;
    const plain = `Hello ${toName},\n\nYour lesson has been booked for ${info.date} at ${info.time}.\n\nDetails:\n- Lesson: ${info.lesson_type || "Lesson"}\n\nSee you then.`;
    const html = `<p>Hello ${toName},</p><p>Your lesson has been booked for <strong>${info.date} at ${info.time}</strong>.</p><p><strong>Lesson:</strong> ${info.lesson_type || "Lesson"}</p><p>See you then.</p>`;

    try {
      const { sendMail } = await import("../lib/mailer");
      console.log("Resend: Sending booking confirmation to", toEmail);
      await sendMail({
        to: toEmail,
        from: process.env.FROM_EMAIL || "no-reply@example.com",
        subject,
        text: plain,
        html,
      });
      console.log("Resend: Booking confirmation sent to", toEmail);
    } catch (err) {
      console.error("Resend: Failed to send booking confirmation", err);
    }

    try {
      const { createCalendarEvent } = await import("../lib/calendar");
      // Construct start/end ISO timestamps safely
      const makeIso = (dStr: any, tStr: string, durMin: number) => {
        try {
          if (!dStr || !tStr) throw new Error("Missing date or time");
          let y: number, m: number, day: number;
          if (dStr instanceof Date) {
            const dt = dStr as Date;
            y = dt.getFullYear();
            m = dt.getMonth() + 1;
            day = dt.getDate();
          } else if (typeof dStr === "string") {
            if (dStr.includes("T")) {
              const dt = new Date(dStr);
              if (isNaN(dt.getTime())) throw new Error("Invalid date string");
              y = dt.getFullYear();
              m = dt.getMonth() + 1;
              day = dt.getDate();
            } else {
              const parts = dStr.split("-").map(Number);
              if (parts.length !== 3) throw new Error("Invalid date format");
              [y, m, day] = parts;
            }
          } else {
            throw new Error("Unsupported date type");
          }
          const tParts = String(tStr).split(":").map(Number);
          if (tParts.length < 2) throw new Error("Invalid time format");
          const hh = tParts[0] || 0;
          const mm = tParts[1] || 0;
          // Construct local date/time strings (no Z) so Google can apply the provided timezone correctly
          const pad = (n: number) => String(n).padStart(2, "0");
          const startLocal = `${y}-${pad(m)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00`;
          const endDate = new Date(y, (m || 1) - 1, day, hh, mm, 0, 0);
          endDate.setMinutes(endDate.getMinutes() + (durMin || 30));
          const endLocal = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;
          return { startIso: startLocal, endIso: endLocal };
        } catch (err) {
          console.error(
            "Failed to construct ISO timestamps for",
            dStr,
            tStr,
            err,
          );
          throw err;
        }
      };
      const { startIso, endIso } = makeIso(info.date, info.time, 30);
      const attendees: string[] = [];
      if (info.guest_email) attendees.push(info.guest_email);
      if (info.user_email && !attendees.includes(info.user_email))
        attendees.push(info.user_email);
      console.log("Resend: creating calendar event", {
        bookingId: id,
        startIso,
        endIso,
        attendees,
      });
      // Resend: create event without attendees to avoid service account invitation restrictions
      // build description with name, instruments, and phone
      let instrumentsText = "";
      try {
        if (info && info.student_instruments) {
          if (Array.isArray(info.student_instruments))
            instrumentsText = info.student_instruments.join(", ");
          else if (typeof info.student_instruments === "string")
            instrumentsText = JSON.parse(info.student_instruments || "[]").join(
              ", ",
            );
        }
      } catch (e) {
        instrumentsText = String(info.student_instruments || "");
      }
      const contactPhone =
        info?.guest_phone || info?.student_phone || info?.user_phone || "";
      const who = info?.guest_name || info?.user_name || "guest";
      const descParts = [
        `Booking for ${who}`,
        instrumentsText ? `Instruments: ${instrumentsText}` : null,
        contactPhone ? `Phone: ${contactPhone}` : null,
      ].filter(Boolean);

      const ev = await createCalendarEvent({
        summary: `Lesson: ${info.lesson_type || "Lesson"}`,
        description: descParts.join("\n"),
        startDateTime: startIso,
        endDateTime: endIso,
      });
      console.log("Resend: Calendar event created for booking", id, {
        eventId: ev && ev.id,
      });
    } catch (err) {
      console.error("Resend: Failed to create calendar event for booking", err);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to resend notification" });
  }
});

// DELETE /api/admin/bookings/:id
router.delete("/bookings/:id", async (req, res) => {
  const { id } = req.params;
  const { reason = null, notify = true } = req.body || {};

  try {
    // load booking details for notification
    const infoQ = await query(
      `SELECT b.id, b.lesson_type, b.guest_name, b.guest_email, b.guest_phone, s.user_id as student_user_id, u.email as user_email, u.name as user_name, s.instruments as student_instruments, u.phone as user_phone, s.phone as student_phone, sl.id as slot_id, sl.slot_time as time, sl.slot_date as date
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
            await sendMail({
              to: toEmail,
              from: process.env.FROM_EMAIL || "no-reply@example.com",
              subject,
              text: plain,
              html,
            });
          } catch (e) {
            console.error("Failed to send cancellation email", e);
          }
        } catch (e) {
          console.error("Failed to send cancellation email", e);
        }
      }
    }

    // delete calendar event if exists. Support deleting recurring series with scopes: single | future | all
    try {
      const bodyAny = (req.body || {}) as any;
      let deleteScope: "single" | "future" | "all" = "single";
      if (bodyAny.deleteScope) deleteScope = bodyAny.deleteScope;
      else if (bodyAny.deleteSeries !== undefined)
        deleteScope = bodyAny.deleteSeries !== false ? "all" : "single";

      const {
        deleteCalendarEvent,
        updateRecurringEventUntil,
        deleteRecurringInstance,
      } = await import("../lib/calendar");

      if (info && info.recurrence_id) {
        if (deleteScope === "all") {
          try {
            await deleteCalendarEvent(info.recurrence_id);
            console.log(
              "Deleted recurring calendar event for booking series",
              id,
              info.recurrence_id,
            );
          } catch (e) {
            console.warn(
              "Failed to delete recurring calendar event for booking",
              id,
              e,
            );
          }
        } else if (deleteScope === "future") {
          try {
            // compute UNTIL as the moment before the instance start
            const parts = String(info.date).split("-").map(Number);
            const tparts = String(info.time || "")
              .split(":")
              .map(Number);
            const y = parts[0],
              m = parts[1] - 1,
              d = parts[2];
            const hh = tparts[0] || 0,
              mm = tparts[1] || 0;
            const instStart = new Date(y, m, d, hh, mm, 0);
            const untilDate = new Date(instStart.getTime() - 1000); // one second before
            await updateRecurringEventUntil(
              info.recurrence_id,
              untilDate.toISOString(),
            );
            console.log(
              "Truncated recurring event until before",
              info.date,
              info.time,
              info.recurrence_id,
            );
          } catch (e) {
            console.warn(
              "Failed to truncate recurring event for booking",
              id,
              e,
            );
          }
        } else if (deleteScope === "single") {
          try {
            // delete only the specific instance from calendar (if exists)
            const parts = String(info.date).split("-").map(Number);
            const tparts = String(info.time || "")
              .split(":")
              .map(Number);
            const y = parts[0],
              m = parts[1] - 1,
              d = parts[2];
            const hh = tparts[0] || 0,
              mm = tparts[1] || 0;
            const instStart = new Date(y, m, d, hh, mm, 0);
            await deleteRecurringInstance(
              info.recurrence_id,
              instStart.toISOString(),
            );
            console.log(
              "Deleted single occurrence from recurring event",
              id,
              info.recurrence_id,
            );
          } catch (e) {
            console.warn(
              "Failed to delete single recurring instance for booking",
              id,
              e,
            );
          }
        }
      } else if (info && info.calendar_event_id) {
        try {
          await deleteCalendarEvent(info.calendar_event_id);
          console.log(
            "Deleted calendar event for booking",
            id,
            info.calendar_event_id,
          );
        } catch (e) {
          console.warn("Failed to delete calendar event for booking", id, e);
        }
      }
    } catch (e) {
      console.warn("Error while attempting to delete calendar event", e);
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

    // remove DB bookings depending on scope
    try {
      const bodyAny = (req.body || {}) as any;
      const deleteScope: "single" | "future" | "all" =
        bodyAny.deleteScope ||
        (bodyAny.deleteSeries !== undefined
          ? bodyAny.deleteSeries !== false
            ? "all"
            : "single"
          : "single");
      if (info && info.recurrence_id) {
        if (deleteScope === "all") {
          await query("DELETE FROM bookings WHERE recurrence_id = $1", [
            info.recurrence_id,
          ]);
        } else if (deleteScope === "future") {
          // delete bookings in series from this date onward
          await query(
            "DELETE FROM bookings WHERE recurrence_id = $1 AND id IN (SELECT b.id FROM bookings b LEFT JOIN slots s ON b.slot_id = s.id WHERE b.recurrence_id = $1 AND s.slot_date >= $2)",
            [info.recurrence_id, info.date],
          );
          // delete the single booking as well if still present
          await query("DELETE FROM bookings WHERE id = $1", [id]);
        } else {
          await query("DELETE FROM bookings WHERE id = $1", [id]);
        }
      } else {
        await query("DELETE FROM bookings WHERE id = $1", [id]);
      }
    } catch (e) {
      console.error("Failed to remove booking rows:", e);
      throw e;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to cancel booking:", err);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

// Demo endpoint: create demo bookings on a date (admin only)
router.post("/bookings/demo-add", requireAdmin, async (req, res) => {
  try {
    const date =
      req.body && req.body.date ? String(req.body.date) : "2025-10-15";
    const times =
      req.body && Array.isArray(req.body.times) && req.body.times.length
        ? req.body.times
        : ["10:00", "10:30"];
    const created: any[] = [];
    for (const time of times) {
      // ensure slot exists (avoid duplicates)
      let slotId: string | null = null;
      try {
        const slotQ = await query(
          "SELECT id FROM slots WHERE slot_date = $1 AND slot_time = $2 LIMIT 1",
          [date, time],
        );
        if (slotQ && slotQ.rows && slotQ.rows[0]) {
          slotId = slotQ.rows[0].id;
        }
      } catch (e) {
        console.warn("Failed to query existing slot", e);
      }

      if (!slotId) {
        const insSlot = await query(
          "INSERT INTO slots(teacher_id, slot_date, slot_time, duration_minutes, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id",
          [null, date, time, 30],
        );
        slotId = insSlot.rows[0].id;
      }

      // if booking already exists for slot, skip creating duplicate booking/event
      try {
        const existingBooking = await query(
          "SELECT id, calendar_event_id FROM bookings WHERE slot_id = $1 LIMIT 1",
          [slotId],
        );
        if (existingBooking && existingBooking.rows && existingBooking.rows[0]) {
          created.push({ id: existingBooking.rows[0].id, slotId });
          continue;
        }
      } catch (e) {
        console.warn("Failed to check existing booking for slot", e);
      }

      // create booking
      const ins = await query(
        "INSERT INTO bookings(student_id, slot_id, lesson_type, guest_name, guest_email, guest_phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
        [null, slotId, "Demo", "Demo User", "demo@example.com", null],
      );
      const id = ins.rows[0].id;

      // create calendar event for the booking (idempotent if booking exists)
      try {
        const { createCalendarEvent } = await import("../lib/calendar");
        // build ISO-local start/end
        const parts = String(date).split("-").map(Number);
        const y = parts[0],
          m = parts[1] - 1,
          d = parts[2];
        const tparts = String(time).split(":").map(Number);
        const hh = tparts[0] || 0,
          mm = tparts[1] || 0;
        const startLocal = `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
        const endDate = new Date(y, m, d, hh, mm, 0);
        endDate.setMinutes(endDate.getMinutes() + 30);
        const endLocal = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}T${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}:00`;

        // double-check any existing calendar event for this slot (race-safe)
        const existEv = await query(
          "SELECT calendar_event_id, recurrence_id FROM bookings WHERE slot_id = $1 AND (calendar_event_id IS NOT NULL OR recurrence_id IS NOT NULL) LIMIT 1",
          [slotId],
        );
        if (existEv && existEv.rows && existEv.rows[0] && (existEv.rows[0].calendar_event_id || existEv.rows[0].recurrence_id)) {
          await query("UPDATE bookings SET calendar_event_id = $1, recurrence_id = $2 WHERE id = $3", [existEv.rows[0].calendar_event_id || existEv.rows[0].recurrence_id, existEv.rows[0].recurrence_id || null, id]);
        } else {
          const ev = await createCalendarEvent({
            summary: `Demo Lesson`,
            description: `Demo booking on ${date} at ${time}`,
            startDateTime: startLocal,
            endDateTime: endLocal,
          });
          if (ev && ev.id) {
            await query(
              "UPDATE bookings SET calendar_event_id = $1 WHERE id = $2",
              [ev.id, id],
            );
          }
        }
      } catch (e) {
        console.error("Failed to create demo calendar event", e);
      }

      created.push({ id, slotId });
    }
    res.json({ ok: true, created });
  } catch (e) {
    console.error("Failed to create demo bookings:", e);
    res.status(500).json({ error: "Failed to create demo bookings" });
  }
});

export default router;
