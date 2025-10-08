import express from "express";
import bcrypt from "bcrypt";
import { query } from "../db";

const router = express.Router();

// POST /api/admin/users/:id/set-password
router.post("/users/:id/set-password", async (req, res) => {
  const { id } = req.params;
  const { password } = req.body as { password?: string };
  if (!password) return res.status(400).json({ error: "Missing password" });
  if (!id) return res.status(400).json({ error: "Missing user id" });

  const hash = await bcrypt.hash(password, 10);
  await query(
    "UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2",
    [hash, id],
  );

  // Log audit
  await query(
    "INSERT INTO audit_logs(user_id, action, meta) VALUES ($1, $2, $3)",
    [null, "admin:set-password", JSON.stringify({ userId: id })],
  );

  res.json({ ok: true });
});

// POST /api/admin/me/update
// body: { identifier, currentPassword, newUsername?, newPassword? }
router.post("/me/update", async (req, res) => {
  const { identifier, currentPassword, newUsername, newPassword } =
    req.body as {
      identifier?: string;
      currentPassword?: string;
      newUsername?: string;
      newPassword?: string;
    };
  if (!identifier || !currentPassword)
    return res
      .status(400)
      .json({ error: "Missing identifier or currentPassword" });

  const userRes = await query(
    "SELECT id, username, email, password_hash FROM users WHERE lower(email)=lower($1) OR lower(username)=lower($1) LIMIT 1",
    [identifier],
  );
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });

  const match = user.password_hash
    ? await bcrypt.compare(currentPassword, user.password_hash)
    : false;
  if (!match)
    return res.status(401).json({ error: "Invalid current password" });

  if (newUsername) {
    await query("UPDATE users SET username = $1 WHERE id = $2", [
      newUsername,
      user.id,
    ]);
  }
  if (newPassword) {
    const h = await bcrypt.hash(newPassword, 10);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      h,
      user.id,
    ]);
  }

  await query(
    "INSERT INTO audit_logs(user_id, action, meta) VALUES ($1, $2, $3)",
    [
      user.id,
      "user:update-self",
      JSON.stringify({
        newUsername: !!newUsername,
        newPassword: !!newPassword,
      }),
    ],
  );

  res.json({ ok: true });
});

// DEV: seed sample students (only allowed in non-production or when ALLOW_DEV_SEED=true)
router.post("/seed-students", async (req, res) => {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEV_SEED !== "true"
  ) {
    return res.status(403).json({ error: "Not allowed in production" });
  }
  try {
    const samples = [
      {
        name: "Alice Smith",
        age: 14,
        email: "alice.smith@example.com",
        parent_name: "Mary Smith",
        parent_email: "mary.smith@example.com",
        parent_phone: "07123456701",
        emergency_contacts: "Mary Smith: 07123456701",
        allergies: "Peanuts",
        medications: "",
        instruments: ["Guitar"],
        band: "The Rockets",
      },
      {
        name: "Bob Jones",
        age: 17,
        email: "bob.jones@example.com",
        parent_name: "",
        parent_email: "",
        parent_phone: "",
        emergency_contacts: "Dad: 07123456702",
        allergies: "",
        medications: "Inhaler",
        instruments: ["Drums", "Bass"],
        band: "The Rockets",
      },
      {
        name: "Charlie Brown",
        age: 10,
        email: "charlie.brown@example.com",
        parent_name: "Laura Brown",
        parent_email: "laura.brown@example.com",
        parent_phone: "07123456703",
        emergency_contacts: "Laura Brown: 07123456703",
        allergies: "None",
        medications: "",
        instruments: ["Piano"],
        band: null,
      },
      {
        name: "Diana King",
        age: 22,
        email: "diana.king@example.com",
        parent_name: "",
        parent_email: "",
        parent_phone: "",
        emergency_contacts: "Friend: 07123456704",
        allergies: "Dust",
        medications: "Antihistamine",
        instruments: ["Violin"],
        band: null,
      },
      {
        name: "Evan Lee",
        age: 8,
        email: "evan.lee@example.com",
        parent_name: "Peter Lee",
        parent_email: "peter.lee@example.com",
        parent_phone: "07123456705",
        emergency_contacts: "Peter Lee: 07123456705",
        allergies: "Eggs",
        medications: "",
        instruments: ["Voice"],
        band: "The Rockets",
      },
      {
        name: "Fiona Green",
        age: 30,
        email: "fiona.green@example.com",
        parent_name: "",
        parent_email: "",
        parent_phone: "",
        emergency_contacts: "Self: 07123456706",
        allergies: "",
        medications: "",
        instruments: ["Ukulele"],
        band: null,
      },
      {
        name: "George Hall",
        age: 15,
        email: "george.hall@example.com",
        parent_name: "Anna Hall",
        parent_email: "anna.hall@example.com",
        parent_phone: "07123456707",
        emergency_contacts: "Anna Hall: 07123456707",
        allergies: "Bees",
        medications: "EpiPen",
        instruments: ["Guitar", "Piano"],
        band: "The Rockets",
      },
      {
        name: "Hannah Young",
        age: 19,
        email: "hannah.young@example.com",
        parent_name: "",
        parent_email: "",
        parent_phone: "",
        emergency_contacts: "Friend: 07123456708",
        allergies: "Gluten",
        medications: "",
        instruments: ["Saxophone"],
        band: null,
      },
    ];

    const password = req.body?.password || "BkQR7Aczt";
    const { encryptText, digest } = await import("../lib/crypto");
    const created: any[] = [];
    for (const s of samples) {
      // ensure unique email by adding timestamp if exists
      let email = s.email;
      const index = digest(String(email)).toString();
      const exists = await query(
        "SELECT id FROM users WHERE email_index = $1 LIMIT 1",
        [index],
      );
      if (exists.rows.length) {
        const t = String(Date.now()).slice(-6);
        email = `${email.split("@")[0]}.${t}@${email.split("@")[1]}`;
      }
      const pwHash = await bcrypt.hash(password, 10);
      const enc = encryptText(email);
      const emailToStore = enc.encrypted ? JSON.stringify(enc) : email;
      const emailIndex = digest(email);
      const phoneEnc = s.parent_phone ? encryptText(s.parent_phone) : null;
      const phoneToStore =
        phoneEnc && phoneEnc.encrypted
          ? JSON.stringify(phoneEnc)
          : s.parent_phone || null;
      const u = await query(
        "INSERT INTO users(email, email_encrypted, email_index, phone_encrypted, password_hash, role, name, email_verified) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
        [
          email || null,
          emailToStore,
          emailIndex,
          phoneToStore,
          pwHash,
          "student",
          s.name || null,
          true,
        ],
      );
      const userId = u.rows[0].id;
      await query(
        "INSERT INTO students(user_id, name, age, parent_name, parent_email, parent_phone, phone, address, emergency_contacts, allergies, medications, instruments, band, marketing_consent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
        [
          userId,
          s.name || null,
          s.age || null,
          s.parent_name || null,
          s.parent_email || null,
          s.parent_phone || null,
          null,
          null,
          s.emergency_contacts || null,
          s.allergies || null,
          s.medications || null,
          s.instruments && Array.isArray(s.instruments)
            ? JSON.stringify(s.instruments)
            : null,
          s.band || null,
          false,
        ],
      );
      created.push({ email, name: s.name, userId });
    }
    res.json({ ok: true, created });
  } catch (e) {
    console.error("Seed failed", e);
    res.status(500).json({ error: "Seed failed" });
  }
});

export default router;
