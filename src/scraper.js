const { chromium } = require('playwright');
const db            = require('./database');
const { sendSMS }   = require('./sms');
const { sendAlertEmail } = require('./email');

/* ── Préfectures connues et leurs URLs de réservation ── */
const PREFECTURE_CONFIGS = {
  'Paris (75)': {
    url: 'https://www.rdv.prefecturedepolice.interieur.gouv.fr/jmap/ma-prise-de-rdv.html',
    selectors: {
      available: '.creneaux-disponibles, .slot-available, [class*="disponible"]',
      date:      '.date-rdv, .creneau-date',
      time:      '.heure-rdv, .creneau-heure'
    }
  },
  'Lyon (69)': {
    url: 'https://www.rhone.gouv.fr/Services-de-l-Etat/Securite-et-protection-de-la-population/Etrangers/Prise-de-rendez-vous',
    selectors: {
      available: '.rdv-disponible, .creneau-libre',
      date:      '.date',
      time:      '.heure'
    }
  },
  'Marseille (13)': {
    url: 'https://www.bouches-du-rhone.gouv.fr/Démarches/Etrangers',
    selectors: {
      available: '.slot-free, .disponible',
      date:      '.slot-date',
      time:      '.slot-time'
    }
  }
};

/* ── Scraper générique pour un site de réservation préfecture ── */
async function checkPrefecture(alert) {
  const config = PREFECTURE_CONFIGS[alert.prefecture] || {
    url: alert.prefecture_url,
    selectors: { available: '.creneau, .slot, .disponible, [class*="available"]' }
  };

  let browser = null;

  try {
    browser = await chromium.launch({
      headless: process.env.SCRAPER_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      viewport: { width: 1366, height: 768 }
    });

    const page = await context.newPage();
    await page.setDefaultTimeout(30000);

    /* Navigation */
    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    /* Accepter les cookies si présents */
    const cookieBtn = page.locator('button:has-text("Accepter"), button:has-text("Accept"), #accept-cookies').first();
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieBtn.click();
      await page.waitForTimeout(1000);
    }

    /* Chercher des créneaux disponibles */
    const slots = await page.evaluate((selectors) => {
      const found = [];
      const elements = document.querySelectorAll(selectors.available);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 2) {
          found.push({
            text,
            href: el.querySelector('a')?.href || window.location.href
          });
        }
      });
      return found;
    }, config.selectors);

    await db.updateAlertChecked(alert.id);

    if (slots.length > 0) {
      console.log(`[SCRAPER] ✅ ${slots.length} créneau(x) trouvé(s) pour ${alert.prefecture}`);
      return {
        found:  true,
        slots,
        url:    config.url,
        prefecture: alert.prefecture,
        demarche:   alert.demarche
      };
    }

    return { found: false };

  } catch (err) {
    console.error(`[SCRAPER] ❌ Erreur pour ${alert.prefecture}:`, err.message);
    return { found: false, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

/* ── Envoyer les alertes à l'utilisateur ── */
async function notifyUser(alert, result) {
  const user     = alert.users;
  const slotInfo = result.slots[0];
  const message  = `🟢 Créneau disponible !\n\n📍 ${result.prefecture}\n📋 ${result.demarche}\n🗓️ ${slotInfo.text}\n\n→ Réservez vite : ${slotInfo.href || result.url}\n\n— RDVPrefectureFacile.fr`;

  const promises = [];

  /* SMS */
  if (user.phone) {
    promises.push(
      sendSMS(user.phone, message).catch(e =>
        console.error('[SMS] Erreur:', e.message)
      )
    );
  }

  /* Email */
  if (user.email) {
    promises.push(
      sendAlertEmail({
        to:          user.email,
        firstName:   user.first_name,
        prefecture:  result.prefecture,
        demarche:    result.demarche,
        slotText:    slotInfo.text,
        slotUrl:     slotInfo.href || result.url
      }).catch(e => console.error('[EMAIL] Erreur:', e.message))
    );
  }

  await Promise.allSettled(promises);

  /* Log en base */
  await db.logNotification({
    alert_id:  alert.id,
    user_id:   alert.user_id,
    slot_date: slotInfo.text,
    slot_url:  slotInfo.href || result.url,
    channel:   'sms+email'
  });
}

/* ── Lancer le scan de toutes les alertes actives ── */
async function runScan() {
  console.log(`[SCRAPER] 🔍 Scan démarré — ${new Date().toLocaleTimeString('fr-FR')}`);

  const alerts = await db.getActiveAlerts();
  console.log(`[SCRAPER] ${alerts.length} alerte(s) active(s) à surveiller`);

  const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_SCRAPERS) || 5;
  const chunks = [];
  for (let i = 0; i < alerts.length; i += maxConcurrent) {
    chunks.push(alerts.slice(i, i + maxConcurrent));
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(alert => checkPrefecture(alert))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value.found) {
        await notifyUser(chunk[i], result.value);
      }
    }

    /* Pause entre les batches pour ne pas surcharger */
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`[SCRAPER] ✅ Scan terminé — ${new Date().toLocaleTimeString('fr-FR')}`);
}

module.exports = { runScan, checkPrefecture };
