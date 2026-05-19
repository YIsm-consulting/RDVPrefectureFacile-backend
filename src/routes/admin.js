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

/* DELETE /api/admin/users/:id */
router.delete('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const { supabase } = require('../database');
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Utilisateur supprimé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* GET /api/admin/cron-status */
router.get('/cron-status', authenticateAdmin, (req, res) => {
  try {
    const { getSchedulerStats } = require('../scheduler');
    res.json(getSchedulerStats());
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* POST /api/admin/trigger-scan */
router.post('/trigger-scan', authenticateAdmin, async (req, res) => {
  try {
    const { runScanWithStats } = require('../scheduler');
    runScanWithStats(); // fire and forget
    res.json({ message: 'Scan lancé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* POST /api/admin/create-test-data */
router.post('/create-test-data', authenticateAdmin, async (req, res) => {
  try {
    const { supabase } = require('../database');
    const bcrypt = require('bcryptjs');

    const testEmail = 'test@rdvprefecturefacile.fr';
    const testPassword = 'Test1234!';

    /* Remove existing test user */
    await supabase.from('users').delete().eq('email', testEmail);

    const hash = await bcrypt.hash(testPassword, 12);
    const { data: user, error: uErr } = await supabase
      .from('users')
      .insert({
        email:          testEmail,
        password_hash:  hash,
        first_name:     'Test',
        last_name:      'Robot',
        phone:          null,
        role:           'user'
      })
      .select().single();

    if (uErr) throw uErr;

    /* Fake active subscription */
    await supabase.from('subscriptions').insert({
      user_id:               user.id,
      stripe_subscription_id: `sub_test_${Date.now()}`,
      stripe_price_id:        'price_test',
      status:                 'active',
      current_period_end:     new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
    });

    /* Test alerts for main prefectures */
    const testAlerts = [
      { prefecture: 'Paris (75)',    demarche: 'Titre de séjour - renouvellement' },
      { prefecture: 'Lyon (69)',     demarche: 'Naturalisation' },
      { prefecture: 'Marseille (13)', demarche: 'Carte de résident 10 ans' }
    ];

    for (const a of testAlerts) {
      await supabase.from('alerts').insert({
        user_id:        user.id,
        prefecture:     a.prefecture,
        prefecture_url: '',
        demarche:       a.demarche,
        active:         true
      });
    }

    res.json({
      message: 'Compte test créé avec succès.',
      credentials: { email: testEmail, password: testPassword },
      userId: user.id
    });
  } catch (err) {
    console.error('[ADMIN] create-test-data:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/admin/test-notification */
router.post('/test-notification', authenticateAdmin, async (req, res) => {
  try {
    const { supabase } = require('../database');
    const { sendAlertEmail } = require('../email');
    const { sendSMS } = require('../sms');

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId requis.' });

    const { data: user, error } = await supabase
      .from('users').select('*').eq('id', userId).single();
    if (error || !user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const fakeAlert = {
      prefecture: 'Paris (75)',
      demarche:   'Titre de séjour - renouvellement',
      slotText:   'Lundi 2 juin 2025 à 09h30',
      slotUrl:    'https://www.rdvprefecturefacile.fr'
    };

    const promises = [];

    if (user.phone) {
      const msg = `🟢 TEST — Créneau disponible !\n📍 ${fakeAlert.prefecture}\n📋 ${fakeAlert.demarche}\n🗓️ ${fakeAlert.slotText}\n→ ${fakeAlert.slotUrl}\n— RDVPrefectureFacile.fr`;
      promises.push(sendSMS(user.phone, msg).catch(e => ({ smsError: e.message })));
    }

    if (user.email) {
      promises.push(sendAlertEmail({
        to:         user.email,
        firstName:  user.first_name,
        prefecture: fakeAlert.prefecture,
        demarche:   fakeAlert.demarche,
        slotText:   fakeAlert.slotText,
        slotUrl:    fakeAlert.slotUrl
      }).catch(e => ({ emailError: e.message })));
    }

    const results = await Promise.allSettled(promises);
    res.json({ message: 'Notification test envoyée.', results: results.map(r => r.value || r.reason?.message) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
