import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/admin/messages
router.get("/messages", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const limit = parseInt(String(req.query.limit || "50"), 10);
    // include messages that are not deleted and either not expired OR saved by the current user
    const r = await query(
      `SELECT * FROM messages WHERE deleted_at IS NULL AND (expire_at IS NULL OR expire_at > now() OR saved_by @> $2::jsonb) ORDER BY created_at DESC LIMIT $1`,
      [limit, JSON.stringify([req.user.id])],
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
    const { sender_id, content, recipient_id, save } = req.body as any;
    if (!content) return res.status(400).json({ error: "Missing content" });
    const sid = req.user.id || sender_id || null;
    // default expire_at to 21 days from now unless explicitly saved
    const expireAt = save
      ? null
      : new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
    const ins = await query(
      "INSERT INTO messages(sender_id, recipient_id, content, expire_at) VALUES ($1,$2,$3,$4) RETURNING *",
      [sid, recipient_id || null, content, expireAt],
    );
    const msg = ins.rows[0];
    // broadcast to websocket clients
    try {
      req.app.locals.broadcast?.("message:new", msg);
    } catch (e) {
      console.error("WS broadcast error:", e);
    }
    // create notification for recipient
    try {
      if (msg.recipient_id) {
        await query(
          "INSERT INTO notifications(user_id, actor_id, type, meta) VALUES ($1,$2,$3,$4)",
          [
            msg.recipient_id,
            msg.sender_id,
            "message",
            JSON.stringify({
              messageId: msg.id,
              snippet: (msg.content || "").slice(0, 200),
            }),
          ],
        );
      }
    } catch (err) {
      console.error("Failed to create notification for message:", err);
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

// endpoints to save/unsave messages for a user
router.post("/messages/:id/save", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    // add user id to saved_by jsonb array if not present
    await query(
      `UPDATE messages SET saved_by = COALESCE(saved_by, '[]'::jsonb) || $2::jsonb WHERE id = $1 AND (saved_by IS NULL OR NOT (saved_by @> $2::jsonb))`,
      [id, JSON.stringify([req.user.id])],
    );
    // also clear expire_at to prevent auto-deletion for this message
    await query(`UPDATE messages SET expire_at = NULL WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save message" });
  }
});

router.delete("/messages/:id/save", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    // remove user id from saved_by array
    await query(
      `UPDATE messages SET saved_by = (CASE WHEN saved_by IS NULL THEN '[]'::jsonb ELSE (SELECT jsonb_agg(x) FROM jsonb_array_elements_text(saved_by) x WHERE x != $2) END) WHERE id = $1`,
      [id, req.user.id],
    );
    // if no saved_by remain, set expire_at to 21 days from now so it will auto delete
    const cnt = await query(
      "SELECT jsonb_array_length(COALESCE(saved_by,'[]'::jsonb)) as cnt FROM messages WHERE id = $1",
      [id],
    );
    if (cnt.rows[0].cnt === 0) {
      await query(
        "UPDATE messages SET expire_at = now() + interval '21 days' WHERE id = $1",
        [id],
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unsave message" });
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
