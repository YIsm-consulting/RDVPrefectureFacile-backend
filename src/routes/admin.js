const express = require('express');
const jwt     = require('jsonwebtoken');
const db      = require('../database');

const router = express.Router();

/* Middleware admin */
function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non autorisé.' });
  }

  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }

    req.adminId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide.' });
  }
}

/* POST /api/admin/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');

    const user = await db.getUserByEmail(email);
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ error: 'Accès refusé.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const token = jwt.sign(
      { userId: user.id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* GET /api/admin/stats */
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Erreur stats.' });
  }
});

/* GET /api/admin/users */
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const { supabase } = require('../database');
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, role, created_at, stripe_customer_id')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json({ users: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* GET /api/admin/subscriptions */
router.get('/subscriptions', authenticateAdmin, async (req, res) => {
  try {
    const { supabase } = require('../database');
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, users(email, first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json({ subscriptions: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* GET /api/admin/alerts */
router.get('/alerts', authenticateAdmin, async (req, res) => {
  try {
    const { supabase } = require('../database');
    const { data, error } = await supabase
      .from('alerts')
      .select('*, users(email, first_name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    res.json({ alerts: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* GET /api/admin/notifications */
router.get('/notifications', authenticateAdmin, async (req, res) => {
  try {
    const { supabase } = require('../database');
    const { data, error } = await supabase
      .from('notifications')
      .select('*, users(email, first_name), alerts(prefecture, demarche)')
      .order('sent_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    res.json({ notifications: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* DELETE /api/admin/alerts/:id */
router.delete('/alerts/:id', authenticateAdmin, async (req, res) => {
  try {
    const { supabase } = require('../database');
    const { error } = await supabase
      .from('alerts')
      .update({ active: false })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Alerte désactivée.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

module.exports = router;
