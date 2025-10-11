import express from "express";
import { query } from "../db";

const router = express.Router();

// GET /api/posts - list recent posts with media, reaction_count, comment_count
router.get("/posts", async (req, res) => {
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

    // user reactions for the current user
    const userReactionMap: Record<string, string | null> = {};
    try {
      if (req.user && ids.length) {
        const ur = await query(
          `SELECT post_id, type FROM post_reactions WHERE post_id = ANY($1) AND user_id = $2`,
          [ids, req.user.id],
        );
        for (const r of ur.rows) userReactionMap[r.post_id] = r.type;
      }
    } catch (e) {
      console.error("Failed to load user reactions:", e);
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
      user_reaction: userReactionMap[p.id] || null,
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
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { author_id, author_name, body, attachments } = req.body as any;
    if (!body && (!attachments || attachments.length === 0))
      return res.status(400).json({ error: "Empty post" });

    const authorId = req.user.id || author_id || null;
    const insert = await query(
      "INSERT INTO posts(author_id, title, body, is_public, metadata) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at",
      [
        authorId,
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

    try {
      req.app.locals.broadcast?.(null, "post:new", { id: postId, body, attachments });
    } catch (e) {
      console.error("WS broadcast error:", e);
    }
    // create mention notifications for any @username in body
    try {
      const mentionRegex = /@([\w._-]+)/g;
      let m;
      while ((m = mentionRegex.exec(body || ""))) {
        const username = m[1];
        const u = await query(
          "SELECT id FROM users WHERE username = $1 OR name = $1 LIMIT 1",
          [username],
        );
        if (u.rows[0]) {
          const uid = u.rows[0].id;
          if (uid !== authorId) {
            const notifRes = await query(
              "INSERT INTO notifications(user_id, actor_id, type, meta) VALUES ($1,$2,$3,$4) RETURNING id, user_id, actor_id, type, meta, created_at",
              [
                uid,
                authorId,
                "mention",
                JSON.stringify({ postId, snippet: (body || "").slice(0, 200) }),
              ],
            );
            try { if (notifRes && notifRes.rows && notifRes.rows[0]) req.app.locals.broadcast?.(notifRes.rows[0].user_id || null, 'notification:new', notifRes.rows[0]); } catch(e){}
          }
        }
      }
    } catch (err) {
      console.error("Failed to create mention notifications for post:", err);
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
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const c = await query(
      "SELECT c.*, u.name as author_name, u.role as author_role FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.post_id = $1 ORDER BY c.created_at ASC",
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
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const { author_id, body } = req.body as any;
    if (!body) return res.status(400).json({ error: "Missing comment body" });
    const authorId = req.user.id || author_id || null;
    const ins = await query(
      "INSERT INTO comments(post_id, author_id, body) VALUES ($1,$2,$3) RETURNING id, created_at",
      [id, authorId, body],
    );
    // Notify post author (unless commenter is same) and mentioned users
    try {
      const postRes = await query("SELECT author_id FROM posts WHERE id = $1", [
        id,
      ]);
      const postAuthor = postRes.rows[0] && postRes.rows[0].author_id;
      if (postAuthor && postAuthor !== authorId) {
        const notifRes = await query(
          "INSERT INTO notifications(user_id, actor_id, type, meta) VALUES ($1,$2,$3,$4) RETURNING id, user_id, actor_id, type, meta, created_at",
          [
            postAuthor,
            authorId,
            "post:comment",
            JSON.stringify({ postId: id, snippet: (body || "").slice(0, 200) }),
          ],
        );
        try { if (notifRes && notifRes.rows && notifRes.rows[0]) req.app.locals.broadcast?.(notifRes.rows[0].user_id || null, 'notification:new', notifRes.rows[0]); } catch(e) {}
      }
      // mentions
      const mentionRegex = /@([\w._-]+)/g;
      let m;
      while ((m = mentionRegex.exec(body))) {
        const username = m[1];
        const u = await query(
          "SELECT id FROM users WHERE username = $1 OR name = $1 LIMIT 1",
          [username],
        );
        if (u.rows[0]) {
          const uid = u.rows[0].id;
          if (uid !== authorId) {
            const notifRes = await query(
              "INSERT INTO notifications(user_id, actor_id, type, meta) VALUES ($1,$2,$3,$4) RETURNING id, user_id, actor_id, type, meta, created_at",
              [
                uid,
                authorId,
                "mention",
                JSON.stringify({
                  postId: id,
                  snippet: (body || "").slice(0, 200),
                }),
              ],
            );
            try { if (notifRes && notifRes.rows && notifRes.rows[0]) req.app.locals.broadcast?.(notifRes.rows[0].user_id || null, 'notification:new', notifRes.rows[0]); } catch(e) {}
          }
        }
      }
    } catch (err) {
      console.error("Failed to create notifications for comment:", err);
    }

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

// PUT /api/posts/:id/comments/:commentId - edit comment (author or admin)
router.put("/posts/:id/comments/:commentId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id: postId, commentId } = req.params;
    const { body } = req.body as any;
    if (!body) return res.status(400).json({ error: "Missing body" });
    const c = await query(
      "SELECT author_id FROM comments WHERE id = $1 AND post_id = $2",
      [commentId, postId],
    );
    if (!c.rows.length)
      return res.status(404).json({ error: "Comment not found" });
    const comment = c.rows[0];
    if (comment.author_id !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });
    await query(
      "UPDATE comments SET body = $1, edited_at = now() WHERE id = $2",
      [body, commentId],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to edit comment" });
  }
});

// DELETE /api/posts/:id/comments/:commentId - delete comment (author or admin)
router.delete("/posts/:id/comments/:commentId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id: postId, commentId } = req.params;
    const c = await query(
      "SELECT author_id FROM comments WHERE id = $1 AND post_id = $2",
      [commentId, postId],
    );
    if (!c.rows.length)
      return res.status(404).json({ error: "Comment not found" });
    const comment = c.rows[0];
    if (comment.author_id !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });
    await query("DELETE FROM comments WHERE id = $1", [commentId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// POST /api/posts/:id/reactions
router.post("/posts/:id/reactions", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const { user_id, type } = req.body as any; // type like 'heart', 'like', 'smile'
    if (!type) return res.status(400).json({ error: "Missing reaction type" });
    const uid = req.user.id || user_id || null;

    // ensure post exists
    const p = await query("SELECT id FROM posts WHERE id = $1", [id]);
    if (!p.rows.length)
      return res.status(404).json({ error: "Post not found" });

    // Replace previous reaction (if any) to ensure only one reaction per user per post
    try {
      await query(
        "DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2",
        [id, uid],
      );
      await query(
        "INSERT INTO post_reactions(post_id, user_id, type) VALUES ($1,$2,$3)",
        [id, uid, type],
      );
      res.json({ ok: true });
    } catch (dbErr: any) {
      console.error("DB error adding reaction:", dbErr);
      if (dbErr && dbErr.code === "23503") {
        return res.status(400).json({ error: "Invalid post or user" });
      }
      return res.status(500).json({ error: "Failed to add reaction" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add reaction" });
  }
});

// PUT /api/posts/:id - edit a post (author or admin)
router.put("/posts/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const { body, title } = req.body as any;
    const p = await query(
      "SELECT author_id, metadata FROM posts WHERE id = $1",
      [id],
    );
    const post = p.rows[0];
    if (!post) return res.status(404).json({ error: "Not found" });
    if (post.author_id !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });
    const metadata = post.metadata || {};
    metadata.edited = true;
    metadata.edited_at = new Date().toISOString();
    // record who edited the post (role and name) when available
    try {
      metadata.edited_by_role = req.user.role || null;
      metadata.edited_by_name = req.user.name || null;
    } catch (e) {
      /* ignore */
    }
    await query(
      "UPDATE posts SET body = $1, title = $2, metadata = $3, updated_at = now() WHERE id = $4",
      [body || null, title || null, JSON.stringify(metadata), id],
    );
    // notify post author if edited by admin and not the same user
    try {
      if (req.user.role === "admin") {
        const postAuthor = post.author_id;
        if (postAuthor && postAuthor !== req.user.id) {
          await query(
            "INSERT INTO notifications(user_id, actor_id, type, meta) VALUES ($1,$2,$3,$4)",
            [
              postAuthor,
              req.user.id,
              "post:edited_by_admin",
              JSON.stringify({
                postId: id,
                snippet: (body || "").slice(0, 200),
              }),
            ],
          );
        }
      }
    } catch (err) {
      console.error("Failed to create notification for post edit:", err);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to edit post" });
  }
});

// DELETE /api/posts/:id/reactions - remove reaction for current user
router.delete("/posts/:id/reactions", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    await query(
      "DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2",
      [id, req.user.id],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove reaction" });
  }
});

// DELETE /api/posts/:id - delete post (author or admin)
router.delete("/posts/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const p = await query("SELECT author_id FROM posts WHERE id = $1", [id]);
    const post = p.rows[0];
    if (!post) return res.status(404).json({ error: "Not found" });
    if (post.author_id !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });
    await query("DELETE FROM posts WHERE id = $1", [id]);
    // notify post author if deleted by admin
    try {
      if (req.user.role === "admin") {
        const postAuthor = post.author_id;
        if (postAuthor && postAuthor !== req.user.id) {
          await query(
            "INSERT INTO notifications(user_id, actor_id, type, meta) VALUES ($1,$2,$3,$4)",
            [
              postAuthor,
              req.user.id,
              "post:deleted_by_admin",
              JSON.stringify({ postId: id }),
            ],
          );
        }
      }
    } catch (err) {
      console.error("Failed to create notification for post delete:", err);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

export default router;
