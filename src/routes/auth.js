const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../database');
const { sendWelcomeEmail } = require('../email');

const router = express.Router();

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

/* ── Middleware d'authentification ── */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant.' });
  }

  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}

/* POST /api/auth/register */
router.post('/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Mot de passe trop court (min 8 caractères).' });
    }

    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await db.createUser({
      email,
      password_hash,
      first_name: first_name || null,
      last_name:  last_name  || null,
      phone:      phone      || null
    });

    /* Email de bienvenue (non bloquant) */
    sendWelcomeEmail({ to: email, firstName: first_name })
      .catch(e => console.error('[EMAIL] Bienvenue échec:', e.message));

    const token = generateToken(user.id);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, first_name: user.first_name }
    });

  } catch (err) {
    console.error('[AUTH] Register:', err.message);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

/* POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const subscription = await db.getSubscription(user.id);
    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id:         user.id,
        email:      user.email,
        first_name: user.first_name,
        last_name:  user.last_name,
        phone:      user.phone
      },
      subscription: subscription || null
    });

  } catch (err) {
    console.error('[AUTH] Login:', err.message);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

/* GET /api/auth/me */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user         = await db.getUserById(req.userId);
    const subscription = await db.getSubscription(req.userId);
    const alerts       = await db.getAlertsByUser(req.userId);

    res.json({
      user: {
        id:         user.id,
        email:      user.email,
        first_name: user.first_name,
        last_name:  user.last_name,
        phone:      user.phone
      },
      subscription: subscription || null,
      alertsCount:  alerts.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* PUT /api/auth/profile */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { first_name, last_name, phone } = req.body;
    const updates = {};
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name  !== undefined) updates.last_name  = last_name;
    if (phone      !== undefined) updates.phone      = phone;

    const user = await db.updateUser(req.userId, updates);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
});

/* PUT /api/auth/password */
router.put('/password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Champs requis manquants.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Nouveau mot de passe trop court.' });
    }

    const user  = await db.getUserById(req.userId);
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
    }

    const password_hash = await bcrypt.hash(new_password, 12);
    await db.updateUser(req.userId, { password_hash });

    res.json({ message: 'Mot de passe mis à jour.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* POST /api/auth/forgot-password */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis.' });

    const user = await db.getUserByEmail(email);
    if (!user) return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });

    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reinitialiser-mot-de-passe.html?token=${resetToken}`;

    const { sendResetEmail } = require('../email');
    await sendResetEmail({ to: email, firstName: user.first_name, resetUrl });

    res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
  } catch (err) {
    console.error('[AUTH] Forgot password:', err.message);
    res.status(500).json({ error: 'Erreur lors de l\'envoi.' });
  }
});

/* POST /api/auth/reset-password */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'Token et mot de passe requis.' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (min 8 caractères).' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'Lien invalide ou expiré.' });
    }

    if (decoded.type !== 'password-reset') return res.status(400).json({ error: 'Token invalide.' });

    const password_hash = await bcrypt.hash(new_password, 12);
    await db.updateUser(decoded.userId, { password_hash });

    res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (err) {
    console.error('[AUTH] Reset password:', err.message);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation.' });
  }
});

/* POST /api/auth/setup-admin
   Clé maître : rdv-admin-init-2025
   Crée ou met à jour un compte admin avec l'email et le mot de passe fournis.
   Ne fonctionne qu'avec la clé maître. */
router.post('/setup-admin', async (req, res) => {
  const { master_key, email, password } = req.body;

  if (master_key !== 'rdv-admin-init-2025') {
    return res.status(403).json({ error: 'Clé invalide.' });
  }
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email et mot de passe (min 8 car.) requis.' });
  }

  try {
    const { supabase } = require('../database');
    const password_hash = await bcrypt.hash(password, 12);

    let user = await db.getUserByEmail(email);

    if (user) {
      await supabase.from('users')
        .update({ password_hash, role: 'admin', updated_at: new Date() })
        .eq('id', user.id);
      return res.json({ message: 'Mot de passe admin mis à jour.', email });
    }

    await supabase.from('users').insert({
      email,
      password_hash,
      first_name: 'Admin',
      last_name:  'RDV',
      role:       'admin'
    });

    res.json({ message: 'Compte admin créé.', email });
  } catch (err) {
    console.error('[AUTH] setup-admin:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, authenticate };
