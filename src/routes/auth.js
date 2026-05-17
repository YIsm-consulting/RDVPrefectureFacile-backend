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

module.exports = { router, authenticate };
