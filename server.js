require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const { scheduler } = require('./src/scheduler');

const { router: authRoutes } = require('./src/routes/auth');
const alertsRoutes            = require('./src/routes/alerts');
const webhookRoutes           = require('./src/routes/webhooks');
const adminRoutes             = require('./src/routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Sécurité ── */
app.use(helmet());
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://www.rdvprefecturefacile.fr',
  'https://rdvprefecturefacile.fr',
  'http://localhost:3000',
  /\.vercel\.app$/
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = allowedOrigins.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    cb(ok ? null : new Error('CORS'), ok);
  },
  credentials: true
}));

/* ── Webhook Stripe avant le body-parser JSON ── */
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

/* ── Body parsers ── */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

/* ── Rate limiting ── */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes.' }
});
app.use('/api/', limiter);

/* ── Routes ── */
app.use('/api/auth',     authRoutes);
app.use('/api/alerts',   alertsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin',    adminRoutes);

/* ── Health check ── */
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'RDVPrefectureFacile API',
    version:   '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/* ── 404 ── */
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable.' });
});

/* ── Erreurs globales ── */
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Une erreur interne est survenue.'
      : err.message
  });
});

/* ── Démarrage ── */
app.listen(PORT, () => {
  console.log(`✅ API démarrée sur le port ${PORT}`);
  console.log(`🌍 Environnement : ${process.env.NODE_ENV}`);
  scheduler.start();
  console.log(`🤖 Robot de surveillance démarré (toutes les ${process.env.SCRAPER_INTERVAL_SECONDS || 45} sec)`);
});

module.exports = app;
