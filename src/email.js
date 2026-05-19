const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function buildAlertHTML({ firstName, prefecture, demarche, slotText, slotUrl }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Créneau disponible — RDVPrefectureFacile</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1B4FD8;padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">RDVPrefectureFacile.fr</p>
            <h1 style="margin:12px 0 0;color:#ffffff;font-size:26px;font-weight:700;">🟢 Créneau disponible !</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 24px;color:#374151;font-size:16px;">Bonjour ${firstName || 'cher(e) abonné(e)'},</p>
            <p style="margin:0 0 24px;color:#374151;font-size:16px;">Un créneau vient d'être détecté pour votre démarche :</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F7FF;border:1px solid #DBEAFE;border-radius:8px;margin-bottom:32px;">
              <tr><td style="padding:24px;">
                <p style="margin:0 0 12px;color:#6B7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Détails du créneau</p>
                <p style="margin:0 0 8px;color:#111827;font-size:15px;"><strong>📍 Préfecture :</strong> ${prefecture}</p>
                <p style="margin:0 0 8px;color:#111827;font-size:15px;"><strong>📋 Démarche :</strong> ${demarche}</p>
                <p style="margin:0;color:#111827;font-size:15px;"><strong>🗓️ Créneau :</strong> ${slotText}</p>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${slotUrl}" style="display:inline-block;background:#0FA47A;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:17px;font-weight:700;">
                  → Réserver maintenant
                </a>
              </td></tr>
            </table>

            <p style="margin:32px 0 0;color:#6B7280;font-size:13px;text-align:center;">
              ⚡ Les créneaux partent vite — ne tardez pas !
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;padding:24px 40px;border-top:1px solid #E5E7EB;text-align:center;">
            <p style="margin:0;color:#9CA3AF;font-size:12px;">
              Vous recevez cet email car vous êtes abonné à RDVPrefectureFacile.fr<br>
              <a href="https://rdvprefecturefacile.fr/tableau-de-bord" style="color:#1B4FD8;">Gérer mes alertes</a> ·
              <a href="https://rdvprefecturefacile.fr/mentions-legales" style="color:#1B4FD8;">Mentions légales</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendAlertEmail({ to, firstName, prefecture, demarche, slotText, slotUrl }) {
  const msg = {
    to,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name:  'RDVPrefectureFacile'
    },
    subject:  `🟢 Créneau disponible — ${prefecture} (${demarche})`,
    text:     `Bonjour ${firstName || ''},\n\nUn créneau est disponible !\n\n📍 ${prefecture}\n📋 ${demarche}\n🗓️ ${slotText}\n\n→ Réservez : ${slotUrl}\n\n— RDVPrefectureFacile.fr`,
    html:     buildAlertHTML({ firstName, prefecture, demarche, slotText, slotUrl })
  };

  const [response] = await sgMail.send(msg);
  console.log(`[EMAIL] Envoyé à ${to} — status ${response.statusCode}`);
  return response;
}

async function sendWelcomeEmail({ to, firstName }) {
  const msg = {
    to,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name:  'RDVPrefectureFacile'
    },
    subject: 'Bienvenue sur RDVPrefectureFacile.fr 🎉',
    text:    `Bonjour ${firstName || ''},\n\nVotre compte est activé. Créez votre première alerte depuis votre tableau de bord.\n\nhttps://rdvprefecturefacile.fr/tableau-de-bord\n\n— L'équipe RDVPrefectureFacile`,
    html:    `<!DOCTYPE html><html lang="fr"><body style="font-family:Inter,Arial,sans-serif;background:#f4f6f9;padding:40px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:#1B4FD8;padding:32px;text-align:center;">
          <h1 style="color:#fff;margin:0;">Bienvenue ! 🎉</h1>
        </div>
        <div style="padding:40px;">
          <p>Bonjour ${firstName || 'cher(e) abonné(e)'},</p>
          <p>Votre compte RDVPrefectureFacile est activé. Vous pouvez maintenant créer vos alertes et être notifié dès qu'un créneau est disponible.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="https://rdvprefecturefacile.fr/tableau-de-bord" style="background:#1B4FD8;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;">
              Accéder à mon tableau de bord
            </a>
          </div>
        </div>
      </div>
    </body></html>`
  };

  const [response] = await sgMail.send(msg);
  console.log(`[EMAIL] Bienvenue envoyé à ${to}`);
  return response;
}

async function sendResetEmail({ to, firstName, resetUrl }) {
  const msg = {
    to,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'RDVPrefectureFacile' },
    subject: 'Réinitialisation de votre mot de passe',
    text: `Bonjour ${firstName || ''},\n\nCliquez sur ce lien pour réinitialiser votre mot de passe (valable 1h) :\n${resetUrl}\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.\n\n— RDVPrefectureFacile.fr`,
    html: `<!DOCTYPE html><html lang="fr"><body style="font-family:Inter,Arial,sans-serif;background:#f4f6f9;padding:40px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:#1B4FD8;padding:32px;text-align:center;">
          <h1 style="color:#fff;margin:0;">Réinitialisation du mot de passe</h1>
        </div>
        <div style="padding:40px;">
          <p>Bonjour ${firstName || ''},</p>
          <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous (lien valable <strong>1 heure</strong>) :</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetUrl}" style="background:#1B4FD8;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="color:#6B7280;font-size:0.85rem;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        </div>
      </div>
    </body></html>`
  };
  const [response] = await sgMail.send(msg);
  console.log(`[EMAIL] Reset envoyé à ${to}`);
  return response;
}

module.exports = { sendAlertEmail, sendWelcomeEmail, sendResetEmail };
