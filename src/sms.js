const twilio = require('twilio');

let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  console.warn('[TWILIO] Credentials manquants — SMS désactivés');
}

async function sendSMS(to, message) {
  if (!client) {
    console.warn('[SMS] Client Twilio non initialisé — SMS non envoyé');
    return null;
  }
  const formatted = to.startsWith('+') ? to : `+33${to.replace(/^0/, '')}`;

  const result = await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to:   formatted
  });

  console.log(`[SMS] Envoyé à ${formatted} — SID: ${result.sid}`);
  return result;
}

module.exports = { sendSMS };
