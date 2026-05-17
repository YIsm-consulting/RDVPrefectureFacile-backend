const cron        = require('node-cron');
const { runScan } = require('./scraper');

const INTERVAL = parseInt(process.env.SCRAPER_INTERVAL_MINUTES) || 2;

/* ── Convertit N minutes en expression cron ── */
function minutesToCron(minutes) {
  if (minutes === 1)  return '* * * * *';
  if (minutes < 60)   return `*/${minutes} * * * *`;
  return '0 * * * *';
}

const scheduler = {
  task: null,

  start() {
    const expression = minutesToCron(INTERVAL);
    console.log(`[SCHEDULER] Cron démarré : "${expression}" (toutes les ${INTERVAL} min)`);

    this.task = cron.schedule(expression, async () => {
      try {
        await runScan();
      } catch (err) {
        console.error('[SCHEDULER] Erreur pendant le scan:', err.message);
      }
    }, {
      scheduled: true,
      timezone:  'Europe/Paris'
    });

    /* Premier scan immédiat au démarrage */
    setTimeout(async () => {
      console.log('[SCHEDULER] Premier scan au démarrage...');
      try { await runScan(); } catch (err) { console.error(err.message); }
    }, 5000);
  },

  stop() {
    if (this.task) {
      this.task.stop();
      console.log('[SCHEDULER] Robot arrêté.');
    }
  }
};

module.exports = { scheduler };
