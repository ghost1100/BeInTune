import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/posts - list recent posts with media, reaction_count, comment_count
router.get("/posts", async (_req, res) => {
  try {
    const postsRes = await query(
      `SELECT p.*, u.name as author_name, u.email as author_email
       FROM posts p LEFT JOIN users u ON p.author_id = u.id
       WHERE p.is_public IS DISTINCT FROM false
       ORDER BY p.created_at DESC LIMIT 50`,
    );
    const posts = postsRes.rows;
    const ids = posts.map((p: any) => p.id);
    let mediaMap: Record<string, any[]> = {};
    if (ids.length) {
      const mres = await query(
        `SELECT pm.post_id, m.id, m.url, m.mime FROM post_media pm JOIN media m ON pm.media_id = m.id WHERE pm.post_id = ANY($1)`,
        [ids],
      );
      for (const r of mres.rows) {
        mediaMap[r.post_id] = mediaMap[r.post_id] || [];
        mediaMap[r.post_id].push({ id: r.id, url: r.url, mime: r.mime });
      }
    }

    // reaction counts
    const rc = await query(
      `SELECT post_id, type, count(*) as cnt FROM post_reactions WHERE post_id = ANY($1) GROUP BY post_id, type`,
      [ids.length ? ids : [null]],
    );
    const reactionMap: Record<string, Record<string, number>> = {};
    for (const r of rc.rows) {
      reactionMap[r.post_id] = reactionMap[r.post_id] || {};
      reactionMap[r.post_id][r.type] = parseInt(r.cnt, 10);
    }

    // comment counts
    const cc = await query(
      `SELECT post_id, count(*) as cnt FROM comments WHERE post_id = ANY($1) GROUP BY post_id`,
      [ids.length ? ids : [null]],
    );
    const commentMap: Record<string, number> = {};
    for (const r of cc.rows) commentMap[r.post_id] = parseInt(r.cnt, 10);

    const out = posts.map((p: any) => ({
      ...p,
      media: mediaMap[p.id] || [],
      reactions: reactionMap[p.id] || {},
      comment_count: commentMap[p.id] || 0,
    }));
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load posts" });
  }
});

// POST /api/posts - create a new post
// body: { author_id?, author_name?, body, attachments? (array of media ids) }
router.post("/posts", async (req, res) => {
  try {
    const { author_id, author_name, body, attachments } = req.body as any;
    if (!body && (!attachments || attachments.length === 0))
      return res.status(400).json({ error: "Empty post" });

    const insert = await query(
      "INSERT INTO posts(author_id, title, body, is_public, metadata) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at",
      [
        author_id || null,
        null,
        body || null,
        true,
        JSON.stringify({ author_name: author_name || null }),
      ],
    );
    const postId = insert.rows[0].id;

    if (attachments && attachments.length) {
      for (const m of attachments) {
        await query(
          "INSERT INTO post_media(post_id, media_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [postId, m],
        );
      }
    }

    res.json({ ok: true, id: postId, created_at: insert.rows[0].created_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// GET /api/posts/:id/comments
router.get("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const c = await query(
      "SELECT c.*, u.name as author_name FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.post_id = $1 ORDER BY c.created_at ASC",
      [id],
    );
    res.json(c.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load comments" });
  }
});

// POST /api/posts/:id/comments
router.post("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { author_id, body } = req.body as any;
    if (!body) return res.status(400).json({ error: "Missing comment body" });
    const ins = await query(
      "INSERT INTO comments(post_id, author_id, body) VALUES ($1,$2,$3) RETURNING id, created_at",
      [id, author_id || null, body],
    );
    res.json({
      ok: true,
      id: ins.rows[0].id,
      created_at: ins.rows[0].created_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// POST /api/posts/:id/reactions
router.post("/posts/:id/reactions", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, type } = req.body as any; // type like 'heart', 'like', 'smile'
    if (!type) return res.status(400).json({ error: "Missing reaction type" });
    await query(
      "INSERT INTO post_reactions(post_id, user_id, type) VALUES ($1,$2,$3)",
      [id, user_id || null, type],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add reaction" });
  }
});

export default router;
