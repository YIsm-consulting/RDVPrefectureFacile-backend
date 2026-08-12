/* Génère une page HTML statique pour un article de blog et la publie
   dans le repo frontend via l'API GitHub (Contents API), pour un
   meilleur référencement (contenu servi statique, meta/OG/JSON-LD,
   indexation automatique via sitemap dynamique). */

const OWNER  = 'YIsm-consulting';
const REPO   = 'RDVPrefectureFacile';
const BRANCH = 'master';
const SITE   = 'https://rdvprefecturefacile.fr';

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderArticleHtml(post) {
  const canonical = `${SITE}/blog/${post.slug}.html`;
  const publishedIso = new Date(post.published_at || Date.now()).toISOString();
  const dateFr = new Date(post.published_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const title = escapeHtml(post.title);
  const desc  = escapeHtml(post.excerpt || '');
  const category = escapeHtml(post.category || '');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || '',
    datePublished: publishedIso,
    dateModified: publishedIso,
    author: { '@type': 'Organization', name: 'RDVPrefectureFacile.fr' },
    publisher: { '@type': 'Organization', name: 'RDVPrefectureFacile.fr' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — RDVPrefectureFacile.fr</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/svg+xml" href="../assets/img/favicon.svg">
  <meta name="theme-color" content="#1B4FD8">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="RDVPrefectureFacile.fr">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../assets/css/style.css">
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-R618GZZ60K"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-R618GZZ60K');
  </script>
  <!-- Fin Google Analytics -->
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    .article-body { max-width: 760px; margin: 0 auto; }
    .article-body h2 { font-size: 1.4rem; margin: 2rem 0 1rem; color: var(--gray-900); }
    .article-body h3 { font-size: 1.1rem; margin: 1.5rem 0 0.75rem; color: var(--gray-900); }
    .article-body p { color: var(--gray-500); line-height: 1.8; margin-bottom: 1rem; }
    .article-body ul, .article-body ol { color: var(--gray-500); line-height: 1.8; margin: 0 0 1rem 1.5rem; }
    .article-body li { margin-bottom: 0.4rem; }
    .article-body strong { color: var(--gray-900); }
    .article-body blockquote { border-left: 4px solid var(--blue); padding: 1rem 1.5rem; background: var(--blue-light); border-radius: 0 8px 8px 0; margin: 1.5rem 0; }
    .article-body blockquote p { color: var(--blue); font-weight: 600; margin: 0; }
    .article-cta { background: linear-gradient(135deg, var(--blue) 0%, #0F3499 100%); border-radius: var(--radius-lg); padding: 40px; text-align: center; margin-top: 48px; }
    .article-cta h3 { color: var(--white); margin-bottom: 12px; }
    .article-cta p { color: rgba(255,255,255,0.85); margin-bottom: 24px; }
  </style>
</head>
<body>

<nav class="navbar">
  <div class="container">
    <div class="navbar-inner">
      <a href="../index.html" class="navbar-logo">RDV<span>Prefecture</span><span class="dot">Facile</span></a>
      <ul class="navbar-nav">
        <li><a href="../comment-ca-marche.html">Comment ça marche</a></li>
        <li><a href="../prefectures.html">Préfectures</a></li>
        <li><a href="../tarifs.html">Tarifs</a></li>
        <li><a href="index.html" class="active">Blog</a></li>
        <li><a href="../faq.html">FAQ</a></li>
        <li><a href="../contact.html">Contact</a></li>
      </ul>
      <div class="navbar-actions">
        <a href="../connexion.html" class="btn btn-secondary btn-sm">Se connecter</a>
        <a href="../inscription.html" class="btn btn-primary btn-sm">Créer mon alerte</a>
      </div>
      <button class="navbar-toggle"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>
<div class="mobile-menu">
  <a href="../comment-ca-marche.html">Comment ça marche</a>
  <a href="../prefectures.html">Préfectures</a>
  <a href="../tarifs.html">Tarifs</a>
  <a href="index.html">Blog</a>
  <a href="../faq.html">FAQ</a>
  <a href="../contact.html">Contact</a>
  <a href="../connexion.html" class="btn btn-secondary">Se connecter</a>
  <a href="../inscription.html" class="btn btn-primary">Créer mon alerte</a>
</div>

<div class="page-header">
  <div class="container">
    <div class="breadcrumb"><a href="../index.html">Accueil</a><span>›</span><a href="index.html">Blog</a><span>›</span>${category}</div>
    <div class="blog-cat" style="margin-bottom:12px;">${category}</div>
    <h1 style="max-width:760px;">${title}</h1>
    <p style="max-width:660px;">${desc}</p>
    <div style="margin-top:20px;font-size:0.85rem;color:rgba(255,255,255,0.7);">${dateFr} · ${post.reading_time || 5} min de lecture</div>
  </div>
</div>

<section class="section">
  <div class="container">
    <div class="article-body">
      ${post.content}

      <div class="article-cta">
        <h3>Ne ratez plus jamais un créneau disponible</h3>
        <p>RDVPrefectureFacile.fr surveille les disponibilités toutes les 45 secondes et vous alerte instantanément par SMS et email.</p>
        <a href="../inscription.html" class="btn" style="background:var(--white);color:var(--blue);font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;">Créer mon alerte — 29,90€/mois →</a>
      </div>
    </div>
  </div>
</section>

<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <span class="footer-logo">RDVPrefectureFacile.fr</span>
        <p class="footer-tagline">Le service d'alerte qui surveille les créneaux de préfecture pour vous, 24h/24 et 7j/7.</p>
        <div class="footer-disclaimer">⚠️ Service privé et indépendant — non affilié à l'administration française.</div>
      </div>
      <div class="footer-col"><h4>Service</h4><ul><li><a href="../comment-ca-marche.html">Comment ça marche</a></li><li><a href="../tarifs.html">Tarifs</a></li><li><a href="../prefectures.html">Préfectures</a></li><li><a href="../inscription.html">Créer mon alerte</a></li></ul></div>
      <div class="footer-col"><h4>Informations</h4><ul><li><a href="../faq.html">FAQ</a></li><li><a href="index.html">Blog</a></li><li><a href="../a-propos.html">À propos</a></li><li><a href="../contact.html">Contact</a></li></ul></div>
      <div class="footer-col"><h4>Légal</h4><ul><li><a href="../mentions-legales.html">Mentions légales</a></li><li><a href="../cgv.html">CGV</a></li><li><a href="../politique-confidentialite.html">Confidentialité</a></li></ul></div>
    </div>
    <div class="footer-bottom">
      <div class="footer-bottom-left">© 2026 RDVPrefectureFacile.fr — Tous droits réservés</div>
      <div class="footer-bottom-right"><a href="../mentions-legales.html">Mentions légales</a><a href="../cgv.html">CGV</a><a href="../politique-confidentialite.html">Confidentialité</a></div>
    </div>
  </div>
</footer>
<script src="../assets/js/main.js"></script>
</body>
</html>
`;
}

/* Publie (crée/écrase) blog/{slug}.html dans le repo frontend via l'API GitHub.
   Ne fait rien (avec un simple avertissement) si GITHUB_TOKEN n'est pas configuré,
   pour ne jamais faire échouer la publication de l'article lui-même. */
async function publishStaticArticle(post) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('[BLOG-STATIC] GITHUB_TOKEN absent — page statique non générée pour', post.slug);
    return;
  }

  const path = `blog/${post.slug}.html`;
  const html = renderArticleHtml(post);

  try {
    /* Récupérer le sha si le fichier existe déjà (mise à jour) */
    let sha;
    const getRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }

    const putRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Blog : publication automatique — ${post.title}`,
        content: Buffer.from(html, 'utf8').toString('base64'),
        branch: BRANCH,
        ...(sha ? { sha } : {})
      })
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      console.error('[BLOG-STATIC] Échec publication GitHub:', putRes.status, err);
      return;
    }

    console.log(`[BLOG-STATIC] Page statique publiée : blog/${post.slug}.html`);
  } catch (err) {
    console.error('[BLOG-STATIC] Erreur:', err.message);
  }
}

module.exports = { renderArticleHtml, publishStaticArticle };
