import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/admin/teachers
router.get("/teachers", async (_req, res) => {
  const q = await query(
    `SELECT id as user_id, email, name, phone, years, about, image FROM users WHERE role = 'teacher' ORDER BY created_at DESC`
  );
  res.json(q.rows);
});

// POST /api/admin/teachers - create or update teacher
router.post("/teachers", async (req, res) => {
  const { userId, email, name, phone, years, about, image } = req.body as any;
  if (userId) {
    await query("UPDATE users SET email=$1, name=$2, phone=$3, years=$4, about=$5, image=$6, updated_at=now() WHERE id=$7", [email || null, name || null, phone || null, years || null, about || null, image || null, userId]);
    return res.json({ ok: true, userId });
  }
  const ins = await query("INSERT INTO users(email, role, name, phone, years, about, image) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [email || null, 'teacher', name || null, phone || null, years || null, about || null, image || null]);
  res.json({ ok: true, userId: ins.rows[0].id });
});

// DELETE /api/admin/teachers/:id
router.delete("/teachers/:id", async (req, res) => {
  const { id } = req.params;
  await query("DELETE FROM users WHERE id = $1 AND role = 'teacher'", [id]);
  res.json({ ok: true });
});

export default router;
