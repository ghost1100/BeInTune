import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/admin/learning/:studentId
router.get("/learning/:studentId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { studentId } = req.params;
    // if not admin, ensure the current user is requesting their own resources
    if (req.user.role !== "admin") {
      const s = await query(
        "SELECT id FROM students WHERE user_id = $1 LIMIT 1",
        [req.user.id],
      );
      if (s.rows.length === 0 || s.rows[0].id !== studentId)
        return res.status(403).json({ error: "Forbidden" });
    }
    const r = await query(
      "SELECT * FROM learning_resources WHERE student_id = $1 ORDER BY created_at DESC",
      [studentId],
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load resources" });
  }
});

// POST /api/admin/learning/:studentId
// body: { title, description, media: [{id,url,mime}] }
router.post("/learning/:studentId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { studentId } = req.params;
    // only admin may post
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });
    const { title, description, media } = req.body as any;
    const mjson = JSON.stringify(media || []);
    const ins = await query(
      "INSERT INTO learning_resources(student_id, uploaded_by, title, description, media) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [
        studentId,
        req.user.id || null,
        title || null,
        description || null,
        mjson,
      ],
    );
    const rows = await query(
      "SELECT * FROM learning_resources WHERE student_id = $1 ORDER BY created_at DESC",
      [studentId],
    );
    res.json(rows.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save resources" });
  }
});

// DELETE entire learning resource entry (only admin)
router.delete("/learning/entry/:entryId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { entryId } = req.params;
    await query("DELETE FROM learning_resources WHERE id = $1", [entryId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete resource entry" });
  }
});

// DELETE a single media item from a learning resource entry
router.delete("/learning/entry/:entryId/media/:mediaId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const { entryId, mediaId } = req.params;
    const r = await query("SELECT media, student_id FROM learning_resources WHERE id = $1 LIMIT 1", [entryId]);
    if (!r.rows.length) return res.status(404).json({ error: "Resource entry not found" });
    const mediaArr = r.rows[0].media || [];
    const filtered = (Array.isArray(mediaArr) ? mediaArr : []).filter((m: any) => String(m.id) !== String(mediaId) && m.url !== mediaId);
    await query("UPDATE learning_resources SET media = $1 WHERE id = $2", [JSON.stringify(filtered), entryId]);
    const rows = await query("SELECT * FROM learning_resources WHERE student_id = $1 ORDER BY created_at DESC", [r.rows[0].student_id]);
    res.json(rows.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove media item" });
  }
});

export default router;
