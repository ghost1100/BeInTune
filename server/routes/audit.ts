import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/admin/audit-logs
router.get("/audit-logs", async (_req, res) => {
  const q = await query(
    `SELECT
        a.id,
        a.user_id,
        a.action,
        a.meta,
        a.created_at,
        u.email AS actor_email,
        u.username AS actor_username,
        u.name AS actor_name,
        u.role AS actor_role,
        target.id AS target_id,
        target.email AS target_email,
        target.username AS target_username,
        target.name AS target_name,
        target.role AS target_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN users target ON target.id::text = a.meta ->> 'userId'
      ORDER BY a.created_at DESC
      LIMIT 1000`,
  );

  const rows = q.rows.map((row) => {
    let meta: any = row.meta;
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = { raw: row.meta };
      }
    }

    const actorDisplayName =
      row.actor_username ||
      row.actor_name ||
      row.actor_email ||
      (row.user_id ? `User ${String(row.user_id).slice(0, 8)}` : "System");

    const targetDisplayName =
      row.target_username ||
      row.target_name ||
      row.target_email ||
      (meta && typeof meta === "object" && meta.userId
        ? `User ${String(meta.userId).slice(0, 8)}`
        : null);

    return {
      id: row.id,
      user_id: row.user_id,
      action: row.action,
      meta,
      created_at: row.created_at,
      email: row.actor_email,
      username: row.actor_username,
      name: row.actor_name,
      role: row.actor_role,
      target_id: row.target_id,
      target_email: row.target_email,
      target_username: row.target_username,
      target_name: row.target_name,
      target_role: row.target_role,
      displayName: actorDisplayName,
      targetDisplayName,
    };
  });

  res.json(rows);
});

export default router;
