const cron        = require('node-cron');
const { runScan } = require('./scraper');

const INTERVAL_SECONDS = parseInt(process.env.SCRAPER_INTERVAL_SECONDS) || 45;

const scheduler = {
  task: null,

  start() {
    /* node-cron supporte 6 champs : seconde minute heure jour mois joursemaine */
    const expression = `*/${INTERVAL_SECONDS} * * * * *`;
    console.log(`[SCHEDULER] Cron démarré : toutes les ${INTERVAL_SECONDS} secondes`);

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
    }, 10000);
  },

  stop() {
    if (this.task) {
      this.task.stop();
      console.log('[SCHEDULER] Robot arrêté.');
    }
  }
};

module.exports = { scheduler };
