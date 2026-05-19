const cron        = require('node-cron');
const { runScan } = require('./scraper');

const INTERVAL_SECONDS = parseInt(process.env.SCRAPER_INTERVAL_SECONDS) || 45;

const stats = {
  lastScanAt:       null,
  lastScanDuration: null,
  lastAlertCount:   0,
  lastSlotsFound:   0,
  totalScans:       0,
  running:          false
};

async function runScanWithStats() {
  if (stats.running) return;
  stats.running = true;
  const start = Date.now();
  try {
    const result = await runScan();
    stats.lastScanAt       = new Date().toISOString();
    stats.lastScanDuration = Date.now() - start;
    stats.lastAlertCount   = result?.alertCount  || 0;
    stats.lastSlotsFound   = result?.slotsFound  || 0;
    stats.totalScans++;
  } catch (err) {
    console.error('[SCHEDULER] Erreur pendant le scan:', err.message);
  } finally {
    stats.running = false;
  }
}

const scheduler = {
  task: null,

  start() {
    const expression = `*/${INTERVAL_SECONDS} * * * * *`;
    console.log(`[SCHEDULER] Cron démarré : toutes les ${INTERVAL_SECONDS} secondes`);

    this.task = cron.schedule(expression, runScanWithStats, {
      scheduled: true,
      timezone:  'Europe/Paris'
    });

    setTimeout(() => {
      console.log('[SCHEDULER] Premier scan au démarrage...');
      runScanWithStats();
    }, 10000);
  },

  stop() {
    if (this.task) {
      this.task.stop();
      console.log('[SCHEDULER] Robot arrêté.');
    }
  }
};

function getSchedulerStats() {
  return {
    ...stats,
    intervalSeconds: INTERVAL_SECONDS
  };
}

module.exports = { scheduler, getSchedulerStats, runScanWithStats };
