// Thin wrapper around the Twilio SDK so the rest of the app never touches
// Twilio credentials directly.
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

async function sendSms(to, body) {
  return client.messages.create({
    to,
    from: process.env.TWILIO_FROM_NUMBER,
    body,
  });
}

module.exports = { sendSms };
