const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function createCheckoutSession({ userId, email, successUrl, cancelUrl }) {
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
  const session = await stripe.billingPortal.sessions.create({
    customer:   stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/tableau-de-bord`
  });

  return session;
}

async function cancelSubscription(stripeSubscriptionId) {
  const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true
  });

  return subscription;
}

async function constructWebhookEvent(payload, signature) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

async function getSubscription(stripeSubscriptionId) {
  return stripe.subscriptions.retrieve(stripeSubscriptionId);
}

async function getCustomer(stripeCustomerId) {
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
