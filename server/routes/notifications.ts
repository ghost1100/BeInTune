import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/notifications - list notifications for current user
router.get("/notifications", async (req, res) => {
  try {
    // If unauthenticated, return an empty array instead of 401 so client components
    // that poll notifications (e.g. NotificationBell) don't throw unhandled errors.
    if (!req.user) {
      return res.json([]);
    }
    const limit = parseInt(String(req.query.limit || "50"), 10);
    const r = await query(
      "SELECT n.*, u.name as actor_name FROM notifications n LEFT JOIN users u ON n.actor_id = u.id WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT $2",
      [req.user.id, limit],
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

// PATCH /api/notifications/:id/read - mark as read
router.patch("/notifications/:id/read", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    await query(
      "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
      [id, req.user.id],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

export default router;
