/* ============================================================
   Anti-robot ALTCHA (preuve de travail, sans compte externe ni cookie)
   Le navigateur du visiteur résout un petit calcul (1 à 2 s) avant
   l'inscription ou la demande de nouveau mot de passe : négligeable
   pour un humain, coûteux pour un robot qui envoie en masse.
   ============================================================ */
const { createChallenge, CappedMap, randomInt } = require('altcha-lib');
const { verify, deriveHmacKeySecret } = require('altcha-lib/frameworks/shared');
const { deriveKey } = require('altcha-lib/algorithms/pbkdf2');

const SECRET = `altcha:${process.env.ALTCHA_SECRET || process.env.JWT_SECRET || 'rdv-dev-secret'}`;
const keySecretPromise = deriveHmacKeySecret(SECRET);

/* Solutions déjà utilisées : une même solution ne sert qu'à un seul envoi. */
const store = new CappedMap({ maxSize: 10000 });

async function newChallenge() {
  return createChallenge({
    algorithm: 'PBKDF2/SHA-256',
    cost: 1000,
    counter: randomInt(1000, 3000),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    deriveKey,
    hmacSignatureSecret: SECRET,
    hmacKeySignatureSecret: await keySecretPromise,
  });
}

/* Renvoie null si la preuve est valide, sinon la raison du refus. */
async function checkAltcha(payload) {
  if (typeof payload !== 'string' || !payload) return 'preuve absente';
  const { error } = await verify(payload, deriveKey, SECRET, await keySecretPromise, store);
  return error || null;
}

/* Middleware Express : refuse la requête si la preuve est absente ou invalide. */
function requireAltcha(req, res, next) {
  checkAltcha(req.body && req.body.altcha)
    .then((reason) => {
      if (!reason) return next();
      console.warn(`[ALTCHA] ${req.method} ${req.originalUrl} bloqué : ${reason}`);
      res.status(400).json({ error: 'Vérification anti-robot non terminée ou expirée. Patientez quelques secondes puis réessayez.' });
    })
    .catch(next);
}

module.exports = { newChallenge, checkAltcha, requireAltcha };
