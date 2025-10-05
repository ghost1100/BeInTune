import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/admin/messages
router.get("/messages", async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit || "50"), 10);
    const r = await query("SELECT * FROM messages ORDER BY created_at DESC LIMIT $1", [limit]);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// POST /api/admin/messages
router.post("/messages", async (req, res) => {
  try {
    const { sender_id, content, recipient_id } = req.body as any;
    if (!content) return res.status(400).json({ error: "Missing content" });
    const ins = await query(
      "INSERT INTO messages(sender_id, recipient_id, content) VALUES ($1,$2,$3) RETURNING *",
      [sender_id || null, recipient_id || null, content]
    );
    res.json({ ok: true, message: ins.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
