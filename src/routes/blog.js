const express = require('express');
const router  = express.Router();

/* GET /api/blog/posts */
router.get('/posts', async (req, res) => {
  try {
    const { supabase } = require('../database');
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, slug, title, excerpt, category, reading_time, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json({ posts: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/blog/posts/:slug */
router.get('/posts/:slug', async (req, res) => {
  try {
    const { supabase } = require('../database');
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('status', 'published')
      .single();
    if (error || !data) return res.status(404).json({ error: 'Article introuvable.' });
    res.json({ post: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
