import express from "express";
import bcrypt from "bcrypt";
import { query } from "../db";

const router = express.Router();

// GET /api/admin/students - list students with user info
router.get("/students", async (_req, res) => {
  const q = await query(
    `SELECT
        u.id AS user_id,
        s.id AS student_id,
        s.id AS id,
        COALESCE(s.name, u.name) AS name,
        u.email,
        s.age,
        s.parent_name,
        s.parent_email,
        s.phone,
        s.address,
        s.marketing_consent,
        s.created_at,
        s.updated_at,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at
      FROM users u
      JOIN students s ON s.user_id = u.id
      WHERE u.role = 'student'
      ORDER BY u.created_at DESC`,
  );
  res.json(q.rows);
});

// POST /api/admin/students - create student (creates user + student row)
router.post("/students", async (req, res) => {
  const {
    email,
    name,
    age,
    parent_name,
    parent_email,
    phone,
    address,
    marketing_consent,
    tempPassword,
  } = req.body as any;
  if (!email) return res.status(400).json({ error: "Missing email" });

  const existingUserRes = await query(
    "SELECT id, role FROM users WHERE lower(email)=lower($1) LIMIT 1",
    [email],
  );

  let userId: string;
  let generatedPassword: string | null = null;

  if (existingUserRes.rows.length > 0) {
    const existing = existingUserRes.rows[0];
    if (existing.role !== "student") {
      return res
        .status(409)
        .json({ error: "Email already belongs to another account." });
    }
    const studentCheck = await query(
      "SELECT id FROM students WHERE user_id = $1 LIMIT 1",
      [existing.id],
    );
    if (studentCheck.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "A student with this email already exists." });
    }
    userId = existing.id;
  } else {
    const pw = tempPassword || Math.random().toString(36).slice(2, 10);
    const hash = await bcrypt.hash(pw, 10);
    const userRes = await query(
      "INSERT INTO users(email, password_hash, role, name, email_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [email, hash, "student", name || null, true],
    );
    userId = userRes.rows[0].id;
    generatedPassword = pw;
  }

  const studentRes = await query(
    "INSERT INTO students(user_id, name, age, parent_name, parent_email, phone, address, marketing_consent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    [
      userId,
      name || null,
      age || null,
      parent_name || null,
      parent_email || null,
      phone || null,
      address || null,
      marketing_consent || false,
    ],
  );

  res.json({
    ok: true,
    userId,
    studentId: studentRes.rows[0].id,
    tempPassword: generatedPassword,
  });
});

// PUT /api/admin/students/:id - update student (student_id)
router.put("/students/:id", async (req, res) => {
  const { id } = req.params;
  const patch = req.body as any;
  // find student
  const sRes = await query("SELECT * FROM students WHERE id = $1", [id]);
  if (sRes.rows.length === 0)
    return res.status(404).json({ error: "Student not found" });
  const s = sRes.rows[0];

  const nextName = patch.name === undefined ? s.name : patch.name;
  const nextAge = patch.age === undefined ? s.age : patch.age;
  const nextParentName =
    patch.parent_name === undefined ? s.parent_name : patch.parent_name;
  const nextParentEmail =
    patch.parent_email === undefined ? s.parent_email : patch.parent_email;
  const nextPhone = patch.phone === undefined ? s.phone : patch.phone;
  const nextAddress = patch.address === undefined ? s.address : patch.address;
  const nextMarketing =
    patch.marketing_consent === undefined
      ? s.marketing_consent
      : patch.marketing_consent;

  await query(
    "UPDATE students SET name=$1, age=$2, parent_name=$3, parent_email=$4, phone=$5, address=$6, marketing_consent=$7, updated_at=now() WHERE id=$8",
    [
      nextName,
      nextAge,
      nextParentName,
      nextParentEmail,
      nextPhone,
      nextAddress,
      nextMarketing,
      id,
    ],
  );

  if (patch.email !== undefined || patch.name !== undefined) {
    const userRes = await query("SELECT email, name FROM users WHERE id = $1", [
      s.user_id,
    ]);
    const user = userRes.rows[0] || {};
    const nextEmail = patch.email === undefined ? user.email : patch.email;
    const nextUserName = patch.name === undefined ? user.name : patch.name;
    await query(
      "UPDATE users SET email = COALESCE($1, email), name = COALESCE($2, name), updated_at = now() WHERE id = $3",
      [nextEmail ?? null, nextUserName ?? null, s.user_id],
    );
  }

  res.json({ ok: true });
});

// DELETE /api/admin/students/:id - delete student
router.delete("/students/:id", async (req, res) => {
  const { id } = req.params;
  const sRes = await query("SELECT * FROM students WHERE id = $1", [id]);
  if (sRes.rows.length === 0)
    return res.status(404).json({ error: "Student not found" });
  const s = sRes.rows[0];
  try {
    await query("DELETE FROM users WHERE id = $1", [s.user_id]);
  } catch (err: any) {
    console.error("Failed to delete student", err);
    return res.status(500).json({ error: "Unable to delete student" });
  }
  res.json({ ok: true });
});

export default router;
