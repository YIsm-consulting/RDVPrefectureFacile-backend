/* eslint-disable */
const crypto = require("node:crypto");

// TEMPORAIRE (migration vers le serveur) : exporte les variables d'environnement chiffrées
// (RSA-OAEP + AES-256-GCM). Seule la clé privée restée sur le PC du propriétaire peut les lire.
// À supprimer immédiatement après usage.
const PUB = "-----BEGIN PUBLIC KEY-----\nMIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAgT64RMLOQ58ahmb0LmUT\nsmukDpOk65vyphpVHHtVFRWyjnwr1VVbadiIDHuxdw2ti00B2QEAFz3otqCy5e6D\ng3ICQYkjuLQGUdJsjnh1+mzcponbJnwwi6bKugJUK3FMKbteouO3E7Yd9n/2JjiA\nPRvmiJXKwOXjfxtgTr+LSM/BI5NTEVrtuP3Qkf4TzSWlIs3UB6WIJNlD79yGHlYV\nZOOcoYsqFGG95xkp9ssQYDBNvdvVEhZ4BEuUtP4y3OCfbyYR/bFbjdjb5BTcOS29\nt4sSd/4Yd3HFXY93MlldOvX93Sk3dG7vRQUFV62klrx5xrM9GDqQhYvRZpfM/tqS\nhFXEElcA0g0WioueImN+cCFx5vPB8Azdg5Nx45gp/OKsvy6gwf4+A1X8oOJvP4hk\nlzTEoOwvfI28320BuiK6RjFEF0fbh87EHH3fceClbzSOTvhSPqyZ+GPcfixjZxWx\nlAymw52dLc7kQZ8inEy4M+MO4eOmk/wGrO1w2ywNBKB9AgMBAAE=\n-----END PUBLIC KEY-----";
const TOKEN_SHA256 = "12568a6e53f2a8f4cafc8506873a90a251757d9644eb23491d17e93bc976008c";
const NAMES = ["ADMIN_SETUP_KEY","ALTCHA_SECRET","ANTHROPIC_API_KEY","BREVO_API_KEY","FRONTEND_URL","GITHUB_TOKEN","JWT_SECRET","MAX_CONCURRENT_SCRAPERS","SCRAPER_HEADLESS","SCRAPER_INTERVAL_SECONDS","SENDGRID_API_KEY","SENDGRID_FROM_EMAIL","STRIPE_PRICE_ID","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","SUPABASE_SERVICE_KEY","SUPABASE_URL","DATABASE_URL","TELEGRAM_BOT_TOKEN","TELEGRAM_CHAT_ID"];
function exportEnv(token) {

  const given = crypto.createHash("sha256").update(String(token || "")).digest();
  const expected = Buffer.from(TOKEN_SHA256, "hex");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  const data = {};
  for (const n of NAMES) if (process.env[n] !== undefined) data[n] = process.env[n];
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  const wrapped = crypto.publicEncrypt({ key: PUB, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
  return { k: wrapped.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ct: ct.toString("base64") };
}

module.exports = function mountExport(app, path) {
  app.post(path, (req, res) => {
    const out = exportEnv(req.get("x-export-token"));
    if (!out) return res.status(404).send("Not found");
    res.set("Cache-Control", "no-store").json(out);
  });
};
