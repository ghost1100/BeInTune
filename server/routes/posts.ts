// PUT /api/posts/:id/comments/:commentId - edit comment (author or admin)
router.put('/posts/:id/comments/:commentId', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { id: postId, commentId } = req.params;
    const { body } = req.body as any;
    if (!body) return res.status(400).json({ error: 'Missing body' });
    const c = await query('SELECT author_id FROM comments WHERE id = $1 AND post_id = $2', [commentId, postId]);
    if (!c.rows.length) return res.status(404).json({ error: 'Comment not found' });
    const comment = c.rows[0];
    if (comment.author_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });
    await query('UPDATE comments SET body = $1, edited_at = now() WHERE id = $2', [body, commentId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

// DELETE /api/posts/:id/comments/:commentId - delete comment (author or admin)
router.delete('/posts/:id/comments/:commentId', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { id: postId, commentId } = req.params;
    const c = await query('SELECT author_id FROM comments WHERE id = $1 AND post_id = $2', [commentId, postId]);
    if (!c.rows.length) return res.status(404).json({ error: 'Comment not found' });
    const comment = c.rows[0];
    if (comment.author_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});
