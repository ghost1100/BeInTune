import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/admin/messages
router.get("/messages", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const limit = parseInt(String(req.query.limit || "50"), 10);
    const r = await query(
      "SELECT * FROM messages WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1",
      [limit],
    );
    const rows = r.rows;
    const ids = rows.map((m: any) => m.id);
    // reactions counts
    let reactionMap: Record<string, Record<string, number>> = {};
    if (ids.length) {
      const rc = await query(
        `SELECT message_id, type, count(*) as cnt FROM message_reactions WHERE message_id = ANY($1) GROUP BY message_id, type`,
        [ids],
      );
      for (const r of rc.rows) {
        reactionMap[r.message_id] = reactionMap[r.message_id] || {};
        reactionMap[r.message_id][r.type] = parseInt(r.cnt, 10);
      }
    }
    // user reactions
    const userReactionMap: Record<string, string | null> = {};
    if (req.user && ids.length) {
      const ur = await query(
        `SELECT message_id, type FROM message_reactions WHERE message_id = ANY($1) AND user_id = $2`,
        [ids, req.user.id],
      );
      for (const r of ur.rows) userReactionMap[r.message_id] = r.type;
    }

    const out = rows.map((m: any) => ({
      ...m,
      reactions: reactionMap[m.id] || {},
      user_reaction: userReactionMap[m.id] || null,
    }));
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// POST /api/admin/messages
router.post("/messages", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { sender_id, content, recipient_id } = req.body as any;
    if (!content) return res.status(400).json({ error: "Missing content" });
    const sid = req.user.id || sender_id || null;
    const ins = await query(
      "INSERT INTO messages(sender_id, recipient_id, content) VALUES ($1,$2,$3) RETURNING *",
      [sid, recipient_id || null, content],
    );
    const msg = ins.rows[0];
    // broadcast to websocket clients
    try {
      req.app.locals.broadcast?.("message:new", msg);
    } catch (e) {
      console.error("WS broadcast error:", e);
    }
    res.json({ ok: true, message: msg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// POST /api/admin/messages/:id/reactions
router.post("/messages/:id/reactions", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const { type } = req.body as any;
    if (!type) return res.status(400).json({ error: "Missing reaction type" });
    const uid = req.user.id;

    // ensure message exists
    const m = await query("SELECT id FROM messages WHERE id = $1", [id]);
    if (!m.rows.length)
      return res.status(404).json({ error: "Message not found" });

    try {
      await query(
        "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2",
        [id, uid],
      );
      await query(
        "INSERT INTO message_reactions(message_id, user_id, type) VALUES ($1,$2,$3)",
        [id, uid, type],
      );
      res.json({ ok: true });
    } catch (dbErr: any) {
      console.error("DB error adding message reaction:", dbErr);
      if (dbErr && dbErr.code === "23503") {
        return res.status(400).json({ error: "Invalid message or user" });
      }
      return res.status(500).json({ error: "Failed to add message reaction" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add message reaction" });
  }
});

// PUT /api/admin/messages/:id - edit message (sender only)
router.put("/messages/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const { content } = req.body as any;
    const m = await query("SELECT sender_id FROM messages WHERE id = $1", [id]);
    const msg = m.rows[0];
    if (!msg) return res.status(404).json({ error: "Not found" });
    if (msg.sender_id !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });
    await query(
      "UPDATE messages SET content = $1, edited_at = now() WHERE id = $2",
      [content, id],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to edit message" });
  }
});

// DELETE /api/admin/messages/:id/reactions - remove reaction for current user
router.delete("/messages/:id/reactions", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    await query(
      "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2",
      [id, req.user.id],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove message reaction" });
  }
});

// DELETE /api/admin/messages/:id - delete message (sender only)
router.delete("/messages/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const m = await query("SELECT sender_id FROM messages WHERE id = $1", [id]);
    const msg = m.rows[0];
    if (!msg) return res.status(404).json({ error: "Not found" });
    if (msg.sender_id !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });
    await query("UPDATE messages SET deleted_at = now() WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;
