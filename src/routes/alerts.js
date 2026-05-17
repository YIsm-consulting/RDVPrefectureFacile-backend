const express = require('express');
const db      = require('../database');
const { authenticate } = require('./auth');

const router = express.Router();

const MAX_ALERTS_PER_USER = 5;

/* GET /api/alerts — lister mes alertes */
router.get('/', authenticate, async (req, res) => {
  try {
    const alerts = await db.getAlertsByUser(req.userId);
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des alertes.' });
  }
});

/* POST /api/alerts — créer une alerte */
router.post('/', authenticate, async (req, res) => {
  try {
    /* Vérifier abonnement actif */
    const subscription = await db.getSubscription(req.userId);
    if (!subscription) {
      return res.status(403).json({
        error: 'Abonnement requis pour créer des alertes.',
        code:  'NO_SUBSCRIPTION'
      });
    }

    /* Limiter le nombre d'alertes */
    const existing = await db.getAlertsByUser(req.userId);
    if (existing.length >= MAX_ALERTS_PER_USER) {
      return res.status(400).json({
        error: `Limite de ${MAX_ALERTS_PER_USER} alertes atteinte.`
      });
    }

    const { prefecture, prefecture_url, demarche } = req.body;

    if (!prefecture || !demarche) {
      return res.status(400).json({ error: 'Préfecture et démarche requis.' });
    }

    const alert = await db.createAlert({
      user_id:        req.userId,
      prefecture,
      prefecture_url: prefecture_url || '',
      demarche,
      active:         true
    });

    res.status(201).json({ alert });

  } catch (err) {
    console.error('[ALERTS] Create:', err.message);
    res.status(500).json({ error: 'Erreur lors de la création de l\'alerte.' });
  }
});

/* DELETE /api/alerts/:id — supprimer/désactiver une alerte */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await db.deactivateAlert(req.params.id, req.userId);
    res.json({ message: 'Alerte désactivée.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

/* POST /api/alerts/checkout — créer session Stripe */
router.post('/checkout', authenticate, async (req, res) => {
  try {
    const { createCheckoutSession } = require('../stripe');
    const user    = await db.getUserById(req.userId);
    const session = await createCheckoutSession({
      userId:     req.userId,
      email:      user.email,
      successUrl: req.body.success_url,
      cancelUrl:  req.body.cancel_url
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[CHECKOUT] Error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la création du paiement.' });
  }
});

/* POST /api/alerts/portal — portail client Stripe */
router.post('/portal', authenticate, async (req, res) => {
  try {
    const { createCustomerPortalSession } = require('../stripe');
    const user = await db.getUserById(req.userId);

    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'Aucun abonnement Stripe trouvé.' });
    }

    const session = await createCustomerPortalSession(user.stripe_customer_id);
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Erreur portail.' });
  }
});

module.exports = router;
