const express = require('express');
const db      = require('../database');
const { constructWebhookEvent } = require('../stripe');

const router = express.Router();

/* POST /api/webhooks/stripe */
router.post('/stripe', async (req, res) => {
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = await constructWebhookEvent(req.body, signature);
  } catch (err) {
    console.error('[WEBHOOK] Signature invalide:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  console.log(`[WEBHOOK] Événement reçu: ${event.type}`);

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;

        const userId         = session.metadata?.userId;
        const customerId     = session.customer;
        const subscriptionId = session.subscription;

        if (!userId) {
          console.error('[WEBHOOK] userId manquant dans metadata');
          break;
        }

        /* Lier le customer Stripe à l'utilisateur */
        await db.updateUser(userId, { stripe_customer_id: customerId });

        /* Créer/mettre à jour l'abonnement */
        const { getSubscription } = require('../stripe');
        const sub = await getSubscription(subscriptionId);

        await db.upsertSubscription({
          user_id:               userId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id:        sub.items.data[0]?.price?.id,
          status:                'active',
          current_period_end:    new Date(sub.current_period_end * 1000)
        });

        console.log(`[WEBHOOK] ✅ Abonnement activé pour user ${userId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub    = event.data.object;
        const userId = await getUserIdFromCustomer(sub.customer);
        if (!userId) break;

        await db.upsertSubscription({
          user_id:               userId,
          stripe_subscription_id: sub.id,
          stripe_price_id:        sub.items.data[0]?.price?.id,
          status:                sub.status,
          current_period_end:    new Date(sub.current_period_end * 1000)
        });

        console.log(`[WEBHOOK] Abonnement mis à jour: ${sub.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object;
        const userId = await getUserIdFromCustomer(sub.customer);
        if (!userId) break;

        await db.upsertSubscription({
          user_id:               userId,
          stripe_subscription_id: sub.id,
          stripe_price_id:        sub.items.data[0]?.price?.id,
          status:                'canceled',
          current_period_end:    new Date(sub.current_period_end * 1000)
        });

        /* Désactiver les alertes de l'utilisateur */
        const { supabase } = require('../database');
        await supabase
          .from('alerts')
          .update({ active: false })
          .eq('user_id', userId);

        console.log(`[WEBHOOK] ❌ Abonnement annulé pour user ${userId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const userId  = await getUserIdFromCustomer(invoice.customer);
        if (!userId) break;
        console.log(`[WEBHOOK] ⚠️ Paiement échoué pour user ${userId}`);
        break;
      }

      default:
        console.log(`[WEBHOOK] Événement ignoré: ${event.type}`);
    }
  } catch (err) {
    console.error('[WEBHOOK] Erreur traitement:', err.message);
  }

  res.json({ received: true });
});

async function getUserIdFromCustomer(stripeCustomerId) {
  try {
    const { supabase } = require('../database');
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();
    return data?.id || null;
  } catch {
    return null;
  }
}

module.exports = router;
