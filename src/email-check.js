const { Resolver } = require("node:dns/promises");
const DISPOSABLE_DOMAINS = require("./disposable-domains");

// Résolveur DNS dédié (serveurs publics) : le DNS « système » vu par Node n'est pas
// fiable partout (sur le serveur Windows il pointe vers 127.0.0.1 où rien ne répond).
const resolver = new Resolver({ timeout: 2500, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8", "9.9.9.9"]);
const resolveMx = (d) => resolver.resolveMx(d);
const resolve4 = (d) => resolver.resolve4(d);
const resolve6 = (d) => resolver.resolve6(d);

// Vérification des adresses e-mail saisies dans les formulaires (côté serveur) :
//  1. format valide ;
//  2. domaine absent de la liste des e-mails jetables (yopmail, temp-mail…), sous-domaines compris ;
//  3. domaine capable de recevoir du courrier (enregistrement MX, ou à défaut une adresse IP) ;
//  4. serveur de réception (MX) qui n'appartient pas à un service jetable : attrape les
//     nouveaux domaines que ces services créent en permanence et qui ne sont pas encore listés.
// En cas de panne DNS (délai dépassé…), on laisse passer : on ne bloque jamais un vrai visiteur
// sur un incident technique, les autres protections restent actives.

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const DNS_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 2000;
const cache = new Map();

const EMAIL_MESSAGES = {
  invalid: "Adresse e-mail invalide. Vérifiez votre saisie.",
  disposable:
    "Les adresses e-mail temporaires ou jetables ne sont pas acceptées. Merci d'utiliser votre adresse habituelle.",
  "no-mail": "Ce nom de domaine ne peut pas recevoir d'e-mails. Vérifiez votre adresse.",
};

function isDisposableDomain(domain) {
  const parts = String(domain || "").toLowerCase().replace(/\.$/, "").split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("DNS timeout"), { code: "ETIMEOUT" })), DNS_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const isMissing = (err) => err?.code === "ENOTFOUND" || err?.code === "ENODATA";

async function checkDns(domain) {
  try {
    const records = await withTimeout(resolveMx(domain));
    const hosts = records.map((r) => String(r.exchange || "").toLowerCase().replace(/\.$/, "")).filter(Boolean);
    if (hosts.some(isDisposableDomain)) return "disposable";
    if (hosts.length) return null;
    if (records.length) return "no-mail"; // « MX nul » : le domaine déclare ne recevoir aucun e-mail
  } catch (err) {
    if (!isMissing(err)) return null; // panne DNS : on laisse passer
    if (err.code === "ENOTFOUND") return "no-mail"; // le domaine n'existe pas
  }
  // Pas de MX : la norme autorise la livraison directe sur l'adresse IP du domaine.
  for (const resolve of [resolve4, resolve6]) {
    try {
      if ((await withTimeout(resolve(domain))).length) return null;
    } catch (err) {
      if (!isMissing(err)) return null;
    }
  }
  return "no-mail";
}

/**
 * Renvoie null si l'adresse est acceptable, sinon { code, message } avec
 * code = "invalid" | "disposable" | "no-mail" et un message à afficher au visiteur.
 */
async function checkEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  let code = null;
  if (value.length > 254 || !EMAIL_RE.test(value)) {
    code = "invalid";
  } else {
    const domain = value.slice(value.lastIndexOf("@") + 1);
    if (isDisposableDomain(domain)) {
      code = "disposable";
    } else {
      const hit = cache.get(domain);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        code = hit.code;
      } else {
        code = await checkDns(domain);
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
        cache.set(domain, { code, at: Date.now() });
      }
    }
  }
  return code ? { code, message: EMAIL_MESSAGES[code] } : null;
}
module.exports = { checkEmail, isDisposableDomain, EMAIL_MESSAGES };
