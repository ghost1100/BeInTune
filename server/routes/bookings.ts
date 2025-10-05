import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/admin/slots?date=YYYY-MM-DD
router.get('/slots', async (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0,10));
  const q = await query('SELECT * FROM slots WHERE slot_date = $1 ORDER BY slot_time', [date]);
  res.json(q.rows);
});

// POST /api/admin/slots - create slot
router.post('/slots', async (req, res) => {
  const { teacher_id, slot_date, slot_time, duration_minutes } = req.body as any;
  if (!slot_date || !slot_time) return res.status(400).json({ error: 'Missing slot_date or slot_time' });
  const ins = await query('INSERT INTO slots(teacher_id, slot_date, slot_time, duration_minutes, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id', [teacher_id || null, slot_date, slot_time, duration_minutes || 30]);
  res.json({ ok: true, id: ins.rows[0].id });
});

// DELETE /api/admin/slots/:id
router.delete('/slots/:id', async (req, res) => {
  const { id } = req.params;
  await query('DELETE FROM slots WHERE id = $1', [id]);
  res.json({ ok: true });
});

// GET /api/admin/bookings?date=YYYY-MM-DD
router.get('/bookings', async (req, res) => {
  const date = req.query.date ? String(req.query.date) : null;
  let q;
  if (date) q = await query('SELECT b.*, s.user_id as student_user_id, u.email as student_email, u.name as student_name FROM bookings b LEFT JOIN students s ON b.student_id = s.id LEFT JOIN users u ON s.user_id = u.id WHERE b.created_at::date = $1 ORDER BY b.created_at DESC', [date]);
  else q = await query('SELECT b.*, s.user_id as student_user_id, u.email as student_email, u.name as student_name FROM bookings b LEFT JOIN students s ON b.student_id = s.id LEFT JOIN users u ON s.user_id = u.id ORDER BY b.created_at DESC');
  res.json(q.rows);
});

// POST /api/admin/bookings - create booking
router.post('/bookings', async (req, res) => {
  const { student_id, slot_id, lesson_type } = req.body as any;
  if (!slot_id) return res.status(400).json({ error: 'Missing slot_id' });
  const slotRes = await query('SELECT * FROM slots WHERE id = $1', [slot_id]);
  if (!slotRes.rows[0]) return res.status(404).json({ error: 'Slot not found' });

  const ins = await query('INSERT INTO bookings(student_id, slot_id, lesson_type) VALUES ($1,$2,$3) RETURNING id, created_at', [student_id || null, slot_id, lesson_type || null]);
  // mark slot unavailable
  await query('UPDATE slots SET is_available = false WHERE id = $1', [slot_id]);
  res.json({ ok: true, bookingId: ins.rows[0].id, created_at: ins.rows[0].created_at });
});

// DELETE /api/admin/bookings/:id
router.delete('/bookings/:id', async (req, res) => {
  const { id } = req.params;
  // free the slot if exists
  const bRes = await query('SELECT slot_id FROM bookings WHERE id = $1', [id]);
  if (bRes.rows[0]) {
    const slotId = bRes.rows[0].slot_id;
    if (slotId) await query('UPDATE slots SET is_available = true WHERE id = $1', [slotId]);
  }
  await query('DELETE FROM bookings WHERE id = $1', [id]);
  res.json({ ok: true });
});

export default router;
