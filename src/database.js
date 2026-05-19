const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

let supabase;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    realtime: { transport: ws }
  });
} else {
  console.warn('[DB] SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant — base de données désactivée');
  supabase = null;
}

/* ── Schéma SQL à exécuter une seule fois dans Supabase ──
   Copiez ce SQL dans l'éditeur SQL de Supabase (supabase.com → SQL Editor)
   ──────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255),
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  phone           VARCHAR(20),
  stripe_customer_id VARCHAR(100),
  role            VARCHAR(20) DEFAULT 'user',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(100) UNIQUE,
  stripe_price_id       VARCHAR(100),
  status                VARCHAR(50) DEFAULT 'active',
  current_period_end    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  prefecture     VARCHAR(200) NOT NULL,
  prefecture_url TEXT NOT NULL,
  demarche       VARCHAR(200) NOT NULL,
  active         BOOLEAN DEFAULT true,
  last_checked   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  alert_id    UUID REFERENCES alerts(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  slot_date   VARCHAR(200),
  slot_url    TEXT,
  channel     VARCHAR(20),
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_active ON alerts(active);
CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_notifications_alert ON notifications(alert_id);

── */

function db() {
  if (!supabase) throw new Error('Base de données non configurée — ajoutez SUPABASE_URL et SUPABASE_SERVICE_KEY dans Railway');
  return supabase;
}

module.exports = {
  supabase,

  async getUserById(id) {
    const { data, error } = await db()
      .from('users').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async getUserByEmail(email) {
    const { data, error } = await db()
      .from('users').select('*').eq('email', email).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createUser(userData) {
    const { data, error } = await db()
      .from('users').insert(userData).select().single();
    if (error) throw error;
    return data;
  },

  async updateUser(id, updates) {
    const { data, error } = await db()
      .from('users').update({ ...updates, updated_at: new Date() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async getActiveAlerts() {
    const { data, error } = await db()
      .from('alerts')
      .select('*, users(email, phone, first_name)')
      .eq('active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getAlertsByUser(userId) {
    const { data, error } = await db()
      .from('alerts').select('*').eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async createAlert(alertData) {
    const { data, error } = await db()
      .from('alerts').insert(alertData).select().single();
    if (error) throw error;
    return data;
  },

  async updateAlertChecked(alertId) {
    const { error } = await db()
      .from('alerts').update({ last_checked: new Date() }).eq('id', alertId);
    if (error) throw error;
  },

  async deactivateAlert(alertId, userId) {
    const { error } = await db()
      .from('alerts').update({ active: false })
      .eq('id', alertId).eq('user_id', userId);
    if (error) throw error;
  },

  async logNotification(data) {
    const { error } = await db().from('notifications').insert(data);
    if (error) console.error('[DB] Erreur log notification:', error);
  },

  async getSubscription(userId) {
    const { data, error } = await db()
      .from('subscriptions').select('*').eq('user_id', userId)
      .eq('status', 'active').single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async upsertSubscription(subData) {
    const { data, error } = await db()
      .from('subscriptions')
      .upsert(subData, { onConflict: 'stripe_subscription_id' })
      .select().single();
    if (error) throw error;
    return data;
  },

  async getStats() {
    const client = db();
    const [users, alerts, notifications, subs] = await Promise.all([
      client.from('users').select('id', { count: 'exact', head: true }),
      client.from('alerts').select('id', { count: 'exact', head: true }).eq('active', true),
      client.from('notifications').select('id', { count: 'exact', head: true }),
      client.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active')
    ]);
    return {
      totalUsers:         users.count || 0,
      activeAlerts:       alerts.count || 0,
      totalNotifications: notifications.count || 0,
      activeSubscriptions: subs.count || 0
    };
  }
};
