const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendSMS(to, message) {
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
