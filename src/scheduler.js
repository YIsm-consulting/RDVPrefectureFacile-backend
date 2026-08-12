const cron        = require('node-cron');
const { runScan } = require('./scraper');

const INTERVAL_SECONDS = parseInt(process.env.SCRAPER_INTERVAL_SECONDS) || 45;

/* Liste de sujets SEO — couvre ~50 semaines, puis recyclée avec un angle "mise à jour" */
const BLOG_TOPICS = [
  { topic: "Comment obtenir un récépissé de demande de titre de séjour en 2026", category: "Guides pratiques" },
  { topic: "ANEF : guide complet pour créer son compte et déposer sa demande en ligne", category: "Guides pratiques" },
  { topic: "Titre de séjour 'passeport talent' : conditions, procédure et délais", category: "Titre de séjour" },
  { topic: "Comment prouver son intégration républicaine pour une naturalisation", category: "Naturalisation" },
  { topic: "Premier titre de séjour étudiant en France : procédure complète 2026", category: "Titre de séjour" },
  { topic: "Regroupement familial : documents, délais et procédure complète", category: "Guides pratiques" },
  { topic: "Le visa long séjour valant titre de séjour (VLS-TS) : comment le valider", category: "Guides pratiques" },
  { topic: "Comment contester un refus de titre de séjour en préfecture", category: "Guides pratiques" },
  { topic: "Renouvellement de carte de séjour 'vie privée et familiale' : tout savoir", category: "Titre de séjour" },
  { topic: "Titre de séjour salarié : conditions, documents et démarches en 2026", category: "Titre de séjour" },
  { topic: "Délais préfecture : comment suivre l'avancement de son dossier", category: "Conseils" },
  { topic: "Naturalisation par mariage : conditions, délais et dossier complet", category: "Naturalisation" },
  { topic: "Que faire quand la préfecture ne répond pas à vos mails ou appels", category: "Conseils" },
  { topic: "Titre de séjour pour travailleur indépendant en France : guide 2026", category: "Titre de séjour" },
  { topic: "OQTF : vos droits, les recours possibles et les délais légaux", category: "Guides pratiques" },
  { topic: "Comment accélérer le traitement de son dossier en préfecture", category: "Conseils" },
  { topic: "Passage du statut étudiant au statut de travailleur : démarches complètes", category: "Titre de séjour" },
  { topic: "La carte de résident européen longue durée : qui peut en bénéficier", category: "Titre de séjour" },
  { topic: "Naturalisation par décret : toutes les étapes de A à Z", category: "Naturalisation" },
  { topic: "Comment préparer un recours gracieux auprès de la préfecture", category: "Guides pratiques" },
  { topic: "Titre de séjour pour les conjoints de Français : procédure 2026", category: "Titre de séjour" },
  { topic: "L'examen du DELF B1 pour la naturalisation : comment bien se préparer", category: "Naturalisation" },
  { topic: "Comprendre les différents types de titres de séjour en France", category: "Guides pratiques" },
  { topic: "Asylum seeker en France : titre de séjour après statut réfugié", category: "Titre de séjour" },
  { topic: "Les erreurs fréquentes dans un dossier de titre de séjour à éviter", category: "Conseils" },
  { topic: "Rendez-vous préfecture : comment se préparer le jour J", category: "Conseils" },
  { topic: "Titre de séjour pour les parents d'enfants français : guide complet", category: "Titre de séjour" },
  { topic: "Comment changer de préfecture compétente pour son dossier", category: "Guides pratiques" },
  { topic: "Les droits des étrangers en situation irrégulière en France en 2026", category: "Guides pratiques" },
  { topic: "Accès aux soins pour les étrangers en France : droits et démarches", category: "Guides pratiques" },
  { topic: "Naturalisation : comprendre le casier judiciaire et les condamnations bloquantes", category: "Naturalisation" },
  { topic: "Titre de séjour pour les aidants familiaux d'une personne malade", category: "Titre de séjour" },
  { topic: "La procédure de convocation en préfecture : à quoi s'attendre", category: "Conseils" },
  { topic: "Titre de séjour et chômage : que se passe-t-il pour votre statut", category: "Guides pratiques" },
  { topic: "Délais de la préfecture de Paris en 2026 : ce qu'il faut savoir", category: "Actualités 2026" },
  { topic: "Comment faire une demande d'admission exceptionnelle au séjour", category: "Guides pratiques" },
  { topic: "Titre de séjour 'chercheur' et 'étudiant-chercheur' : conditions 2026", category: "Titre de séjour" },
  { topic: "Réforme de l'immigration 2026 : ce qui change pour les titres de séjour", category: "Actualités 2026" },
  { topic: "Comment prouver sa résidence en France pour un dossier préfecture", category: "Conseils" },
  { topic: "Naturalisation : la cérémonie de citoyenneté, comment ça se passe", category: "Naturalisation" },
  { topic: "Titre de séjour et divorce : quelles conséquences sur votre droit au séjour", category: "Guides pratiques" },
  { topic: "Le médiateur administratif : quand et comment y faire appel", category: "Guides pratiques" },
  { topic: "Titre de séjour pour les retraités étrangers résidant en France", category: "Titre de séjour" },
  { topic: "Comment remplir le formulaire CERFA de demande de titre de séjour", category: "Guides pratiques" },
  { topic: "Préfectures et sous-préfectures : quelle est la différence pour vos démarches", category: "Guides pratiques" },
  { topic: "Titre de séjour et création d'entreprise en France : démarches 2026", category: "Titre de séjour" },
  { topic: "Nationalité française : peut-on la perdre et dans quels cas", category: "Naturalisation" },
  { topic: "Recours devant le tribunal administratif contre un refus préfecture", category: "Guides pratiques" },
  { topic: "Séjour en France après 70 ans : les démarches pour les seniors étrangers", category: "Guides pratiques" },
  { topic: "Titre de séjour : peut-on travailler pendant l'instruction du dossier", category: "Conseils" },
];

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

async function runBlogCron() {
  try {
    const Anthropic    = require('@anthropic-ai/sdk');
    const { supabase } = require('./database');

    /* Récupérer les slugs existants pour éviter les doublons */
    const { data: existing } = await supabase.from('blog_posts').select('slug, title');
    const existingCount = existing?.length || 0;

    /* Choisir le prochain sujet : on boucle sur la liste ; à chaque tour complet,
       on redemande le même thème avec un angle "mise à jour" pour éviter un contenu identique */
    const cycle = Math.floor(existingCount / BLOG_TOPICS.length);
    const base  = BLOG_TOPICS[existingCount % BLOG_TOPICS.length];
    const topicEntry = cycle === 0
      ? base
      : { topic: `${base.topic} — mise à jour ${new Date().getFullYear()}`, category: base.category };

    console.log(`[BLOG-CRON] Génération : "${topicEntry.topic}"`);

    const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role:    'user',
        content: `Tu es un expert en démarches administratives françaises (préfectures, titres de séjour, naturalisation).

Écris un article de blog complet et SEO-optimisé pour RDVPrefectureFacile.fr sur le sujet : "${topicEntry.topic}"

Règles :
- Longueur : 800-1200 mots
- Ton : professionnel, bienveillant, pratique
- Structure : h2 et h3, paragraphes courts
- Conseils concrets et actionnables
- Mentionner RDVPrefectureFacile.fr naturellement à la fin comme outil d'alerte automatique
- Année : 2026
- Langue : français

Réponds UNIQUEMENT en JSON valide (aucun texte avant ou après) :
{
  "title": "Le titre complet",
  "excerpt": "Résumé 1-2 phrases max 160 caractères",
  "slug": "slug-kebab-case-sans-accents",
  "reading_time": 6,
  "content": "<h2>...</h2><p>...</p>..."
}`
      }]
    });

    let json;
    try {
      const text  = message.content[0].text;
      const match = text.match(/\{[\s\S]*\}/);
      json = JSON.parse(match ? match[0] : text);
    } catch {
      console.error('[BLOG-CRON] Erreur parsing JSON IA');
      return;
    }

    let slug = (json.slug || json.title)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const { data: dup } = await supabase.from('blog_posts').select('slug').eq('slug', slug).single();
    if (dup) slug = `${slug}-${Date.now()}`;

    const published_at = new Date().toISOString();

    await supabase.from('blog_posts').insert({
      slug,
      title:        json.title,
      excerpt:      json.excerpt || '',
      content:      json.content,
      category:     topicEntry.category,
      status:       'published',
      reading_time: json.reading_time || 5,
      published_at
    });

    console.log(`[BLOG-CRON] Article publié : "${json.title}"`);

    const { publishStaticArticle } = require('./blogStatic');
    await publishStaticArticle({
      slug, title: json.title, excerpt: json.excerpt || '', content: json.content,
      category: topicEntry.category, reading_time: json.reading_time || 5, published_at
    });
  } catch (err) {
    console.error('[BLOG-CRON] Erreur:', err.message);
  }
}

const scheduler = {
  task:     null,
  blogTask: null,

  start() {
    const expression = `*/${INTERVAL_SECONDS} * * * * *`;
    console.log(`[SCHEDULER] Cron démarré : toutes les ${INTERVAL_SECONDS} secondes`);

    this.task = cron.schedule(expression, runScanWithStats, {
      scheduled: true,
      timezone:  'Europe/Paris'
    });

    /* Blog : lun/mer/ven à 9h00, en continu */
    this.blogTask = cron.schedule('0 9 * * 1,3,5', runBlogCron, {
      scheduled: true,
      timezone:  'Europe/Paris'
    });
    console.log('[SCHEDULER] Blog cron démarré : lun/mer/ven 9h00 (3 articles/semaine)');

    setTimeout(() => {
      console.log('[SCHEDULER] Premier scan au démarrage...');
      runScanWithStats();
    }, 10000);

    /* Rattrapage blog au démarrage : si aucun article aujourd'hui et jour éligible → générer */
    setTimeout(async () => {
      try {
        const { supabase } = require('./database');
        const today     = new Date().toISOString().slice(0, 10);
        const dayOfWeek = new Date().getDay(); // 1=lun, 3=mer, 5=ven

        if (![1, 3, 5].includes(dayOfWeek)) return;

        const { data } = await supabase
          .from('blog_posts')
          .select('id')
          .gte('created_at', today + 'T00:00:00.000Z')
          .limit(1);

        if (data && data.length > 0) {
          console.log('[BLOG-CRON] Article déjà publié aujourd\'hui — rattrapage ignoré.');
          return;
        }

        console.log('[BLOG-CRON] Rattrapage au démarrage — génération d\'un article…');
        await runBlogCron();
      } catch (err) {
        console.error('[BLOG-CRON] Erreur rattrapage:', err.message);
      }
    }, 30000);
  },

  stop() {
    if (this.task)     { this.task.stop();     console.log('[SCHEDULER] Robot arrêté.'); }
    if (this.blogTask) { this.blogTask.stop();  console.log('[SCHEDULER] Blog cron arrêté.'); }
  }
};

function getSchedulerStats() {
  return {
    ...stats,
    intervalSeconds: INTERVAL_SECONDS
  };
}

module.exports = { scheduler, getSchedulerStats, runScanWithStats };
