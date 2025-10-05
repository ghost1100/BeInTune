import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/admin/learning/:studentId
router.get("/learning/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const r = await query("SELECT * FROM learning_resources WHERE student_id = $1 ORDER BY created_at DESC", [studentId]);
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
    const { studentId } = req.params;
    const { title, description, media } = req.body as any;
    const mjson = JSON.stringify(media || []);
    const ins = await query(
      "INSERT INTO learning_resources(student_id, uploaded_by, title, description, media) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [studentId, null, title || null, description || null, mjson]
    );
    const rows = await query("SELECT * FROM learning_resources WHERE student_id = $1 ORDER BY created_at DESC", [studentId]);
    res.json(rows.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save resources" });
  }
});

export default router;
