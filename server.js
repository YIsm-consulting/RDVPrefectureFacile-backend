require('dotenv').config();

/* Filet de sécurité : une erreur asynchrone imprévue (ex. crash interne de
   Playwright pendant un scan) ne doit jamais faire tomber toute l'API —
   webhooks Stripe, panel admin et blog doivent continuer de fonctionner. */
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException (processus maintenu en vie):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection (processus maintenu en vie):', reason);
});

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const { scheduler } = require('./src/scheduler');

const { router: authRoutes } = require('./src/routes/auth');
const alertsRoutes            = require('./src/routes/alerts');
const webhookRoutes           = require('./src/routes/webhooks');
const adminRoutes             = require('./src/routes/admin');
const blogRoutes              = require('./src/routes/blog');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

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
app.use(express.json({ limit: '200kb' }));
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
app.use('/api/blog',     blogRoutes);

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

/* Fermer proprement le navigateur partagé du scraper lors d'un redéploiement
   (Railway envoie SIGTERM), pour éviter tout process Chromium fantôme. */
process.on('SIGTERM', async () => {
  const { closeBrowser } = require('./src/scraper');
  await closeBrowser();
  process.exit(0);
});

module.exports = app;
