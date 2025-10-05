import express from "express";
import bcrypt from "bcrypt";
import { query } from "../db";

const router = express.Router();

// GET /api/admin/students - list students with user info
router.get("/students", async (_req, res) => {
  const q = await query(
    `SELECT u.id as user_id, u.email, u.name, s.id as student_id, s.age, s.parent_name, s.parent_email, s.phone, s.address, s.marketing_consent
     FROM users u JOIN students s ON s.user_id = u.id WHERE u.role = 'student' ORDER BY u.created_at DESC`
  );
  res.json(q.rows);
});

// POST /api/admin/students - create student (creates user + student row)
router.post("/students", async (req, res) => {
  const { email, name, age, parent_name, parent_email, phone, address, marketing_consent, tempPassword } = req.body as any;
  if (!email) return res.status(400).json({ error: "Missing email" });

  // create user
  const pw = tempPassword || Math.random().toString(36).slice(2, 10);
  const hash = await bcrypt.hash(pw, 10);
  const userRes = await query(
    "INSERT INTO users(email, password_hash, role, name, email_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [email, hash, "student", name || null, true]
  );
  const userId = userRes.rows[0].id;

  const studentRes = await query(
    "INSERT INTO students(user_id, name, age, parent_name, parent_email, phone, address, marketing_consent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    [userId, name || null, age || null, parent_name || null, parent_email || null, phone || null, address || null, marketing_consent || false]
  );

  res.json({ ok: true, userId, studentId: studentRes.rows[0].id, tempPassword: pw });
});

// PUT /api/admin/students/:id - update student (student_id)
router.put("/students/:id", async (req, res) => {
  const { id } = req.params;
  const patch = req.body as any;
  // find student
  const sRes = await query("SELECT * FROM students WHERE id = $1", [id]);
  if (sRes.rows.length === 0) return res.status(404).json({ error: "Student not found" });
  const s = sRes.rows[0];

  await query(
    "UPDATE students SET name=$1, age=$2, parent_name=$3, parent_email=$4, phone=$5, address=$6, marketing_consent=$7, updated_at=now() WHERE id=$8",
    [patch.name || s.name, patch.age || s.age, patch.parent_name || s.parent_name, patch.parent_email || s.parent_email, patch.phone || s.phone, patch.address || s.address, patch.marketing_consent ?? s.marketing_consent, id]
  );

  if (patch.email || patch.name) {
    await query("UPDATE users SET email=$1, name=$2 WHERE id=$3", [patch.email || null, patch.name || null, s.user_id]);
  }

  res.json({ ok: true });
});

// DELETE /api/admin/students/:id - delete student
router.delete("/students/:id", async (req, res) => {
  const { id } = req.params;
  const sRes = await query("SELECT * FROM students WHERE id = $1", [id]);
  if (sRes.rows.length === 0) return res.status(404).json({ error: "Student not found" });
  const s = sRes.rows[0];
  await query("DELETE FROM users WHERE id = $1", [s.user_id]);
  res.json({ ok: true });
});

export default router;
