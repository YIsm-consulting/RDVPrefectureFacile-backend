const axios = require('axios');

if (!process.env.BREVO_API_KEY) {
  console.warn('[BREVO] BREVO_API_KEY manquant — SMS désactivés');
}

async function sendSMS(to, message) {
  if (!process.env.BREVO_API_KEY) {
    console.warn('[SMS] Brevo non configuré — SMS non envoyé');
    return null;
  }

  const recipient = to.startsWith('+') ? to : `+33${to.replace(/^0/, '')}`;

  const result = await axios.post(
    'https://api.brevo.com/v3/transactionalSMS/sms',
    {
      sender:    'RDVPrefect',
      recipient,
      content:   message,
      type:      'transactional'
    },
    {
      headers: {
        'api-key':      process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log(`[SMS] Envoyé à ${recipient} — messageId: ${result.data.messageId}`);
  return result.data;
}

module.exports = { sendSMS };
