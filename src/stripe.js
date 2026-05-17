const Stripe = require('stripe');

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.warn('[STRIPE] STRIPE_SECRET_KEY manquant — paiements désactivés');
}

async function createCheckoutSession({ userId, email, successUrl, cancelUrl }) {
  if (!stripe) throw new Error('Stripe non configuré — ajoutez STRIPE_SECRET_KEY dans les variables Railway');
  const session = await stripe.checkout.sessions.create({
    mode:               'subscription',
    payment_method_types: ['card'],
    customer_email:     email,
    line_items: [{
      price:    process.env.STRIPE_PRICE_ID,
      quantity: 1
    }],
    metadata:      { userId },
    success_url:   successUrl || `${process.env.FRONTEND_URL}/tableau-de-bord?payment=success`,
    cancel_url:    cancelUrl  || `${process.env.FRONTEND_URL}/tarifs?payment=cancel`,
    locale:        'fr',
    allow_promotion_codes: true
  });

  return session;
}

async function createCustomerPortalSession(stripeCustomerId) {
  if (!stripe) throw new Error('Stripe non configuré');
  const session = await stripe.billingPortal.sessions.create({
    customer:   stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/tableau-de-bord`
  });

  return session;
}

async function cancelSubscription(stripeSubscriptionId) {
  if (!stripe) throw new Error('Stripe non configuré');
  const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true
  });

  return subscription;
}

async function constructWebhookEvent(payload, signature) {
  if (!stripe) throw new Error('Stripe non configuré');
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

async function getSubscription(stripeSubscriptionId) {
  if (!stripe) throw new Error('Stripe non configuré');
  return stripe.subscriptions.retrieve(stripeSubscriptionId);
}

async function getCustomer(stripeCustomerId) {
  if (!stripe) throw new Error('Stripe non configuré');
  return stripe.customers.retrieve(stripeCustomerId);
}

module.exports = {
  stripe,
  createCheckoutSession,
  createCustomerPortalSession,
  cancelSubscription,
  constructWebhookEvent,
  getSubscription,
  getCustomer
};
