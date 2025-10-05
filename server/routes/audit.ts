import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/admin/audit-logs
router.get("/audit-logs", async (_req, res) => {
  const q = await query(
    `SELECT a.id, a.user_id, a.action, a.meta, a.created_at, u.email, u.username, u.role FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 1000`,
  );
  res.json(q.rows);
});

export default router;
