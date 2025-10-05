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
  const rows = q.rows.map((r: any) => {
    try {
      if (r.email) return r;
      if (r.email_encrypted) {
        const { decryptText } = require("../lib/crypto");
        const parsed =
          typeof r.email_encrypted === "string"
            ? JSON.parse(r.email_encrypted)
            : r.email_encrypted;
        const dec = decryptText(parsed);
        r.email = dec || null;
      }
    } catch (e) {
      // ignore
    }
    return r;
  });
  res.json(rows);
});

// GET /api/admin/students/admins - list admin users
router.get("/students/admins", async (_req, res) => {
  try {
    const q = await query(
      `SELECT id AS user_id, email, name FROM users WHERE role = 'admin' ORDER BY created_at ASC`,
    );
    res.json(q.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load admins" });
  }
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

  const { digest } = await import("../lib/crypto");
  const existingUserRes = await query(
    "SELECT id, role FROM users WHERE email_index = $1 LIMIT 1",
    [digest(email).toString()],
  );
  // fallback to old behavior for existing rows
  if (existingUserRes.rows.length === 0) {
    const fallback = await query(
      "SELECT id, role FROM users WHERE lower(email)=lower($1) LIMIT 1",
      [email],
    );
    if (fallback.rows.length) {
      existingUserRes.rows = fallback.rows;
    }
  }

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
    const { encryptText, digest } = await import("../lib/crypto");
    const enc = encryptText(email);
    const emailToStore = enc.encrypted ? JSON.stringify(enc) : email;
    const emailIndex = digest(email);
    const phoneEnc = phone ? encryptText(phone) : null;
    const phoneToStore =
      phoneEnc && phoneEnc.encrypted ? JSON.stringify(phoneEnc) : phone || null;
    const userRes = await query(
      "INSERT INTO users(email_encrypted, email_index, phone_encrypted, password_hash, role, name, email_verified) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [
        emailToStore,
        emailIndex,
        phoneToStore,
        hash,
        "student",
        name || null,
        true,
      ],
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

// Sync group chats based on student.band
router.post("/group-chats/sync", async (_req, res) => {
  try {
    // get distinct bands
    const bandsRes = await query(
      "SELECT DISTINCT band FROM students WHERE band IS NOT NULL AND band <> ''",
    );
    const bands = bandsRes.rows.map((r: any) => r.band).filter(Boolean);
    const adminsRes = await query("SELECT id FROM users WHERE role = 'admin'");
    const adminIds = adminsRes.rows.map((r: any) => r.id);
    for (const band of bands) {
      // ensure room exists
      const roomRes = await query(
        "SELECT id FROM rooms WHERE name = $1 LIMIT 1",
        [band],
      );
      let roomId: string;
      if (roomRes.rows.length) {
        roomId = roomRes.rows[0].id;
      } else {
        const ins = await query(
          "INSERT INTO rooms(name, metadata) VALUES ($1,$2) RETURNING id",
          [band, JSON.stringify({ auto: true })],
        );
        roomId = ins.rows[0].id;
      }
      // add members: all users in students with this band
      const membersRes = await query(
        "SELECT u.id FROM users u JOIN students s ON s.user_id = u.id WHERE s.band = $1",
        [band],
      );
      const memberIds = membersRes.rows.map((r: any) => r.id);
      const toAdd = Array.from(new Set([...memberIds, ...adminIds]));
      for (const uid of toAdd) {
        try {
          await query(
            "INSERT INTO room_members(room_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
            [roomId, uid],
          );
        } catch (e) {
          // ignore
        }
      }
    }
    res.json({ ok: true, bands });
  } catch (err) {
    console.error("Failed to sync group chats", err);
    res.status(500).json({ error: "Failed to sync group chats" });
  }
});

// list rooms
router.get("/rooms", async (_req, res) => {
  try {
    const r = await query(
      "SELECT r.id, r.name, r.metadata, count(rm.user_id) as members FROM rooms r LEFT JOIN room_members rm ON rm.room_id = r.id GROUP BY r.id ORDER BY r.name",
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load rooms" });
  }
});

export default router;
