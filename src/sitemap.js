/* Copie de api/sitemap.xml.js du site (ex-fonction Vercel), servie par l API sur notre serveur. */
/* Sitemap généré dynamiquement à chaque requête : reprend les pages fixes
   du site + scanne automatiquement blog/*.html pour inclure tout article
   statique (anciens articles + articles IA générés par le cron), sans
   jamais avoir besoin d'éditer un fichier sitemap.xml à la main. */

const fs = require('fs');
const path = require('path');

const SITE = 'https://rdvprefecturefacile.fr';

const STATIC_PAGES = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/tarifs', changefreq: 'monthly', priority: '0.9' },
  { loc: '/comment-ca-marche', changefreq: 'monthly', priority: '0.8' },
  { loc: '/prefectures', changefreq: 'monthly', priority: '0.8' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.8' },
  { loc: '/blog', changefreq: 'weekly', priority: '0.7' },
  { loc: '/contact', changefreq: 'yearly', priority: '0.6' },
  { loc: '/a-propos', changefreq: 'yearly', priority: '0.5' }
];

module.exports = (req, res) => {
  let articleSlugs = [];
  try {
    const blogDir = path.join(process.env.STATIC_SITE_DIR || process.cwd(), 'blog');
    articleSlugs = fs.readdirSync(blogDir)
      .filter(f => f.endsWith('.html') && f !== 'index.html' && f !== 'article.html')
      .map(f => f.replace(/\.html$/, ''));
  } catch {
    articleSlugs = [];
  }

  const urls = [
    ...STATIC_PAGES.map(p => `  <url><loc>${SITE}${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`),
    ...articleSlugs.map(slug => `  <url><loc>${SITE}/blog/${slug}.html</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`)
  ].join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(xml);
};
