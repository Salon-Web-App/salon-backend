// SMS_MODE: "send" delivers via Twilio, anything else only logs.
const logger = require("./logger");
const { maskContact } = require("../utils/mask");

const MODE = process.env.SMS_MODE || "log";

const client =
  MODE === "send"
    ? require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

async function sendSms(to, body) {
  if (MODE !== "send") {
    logger.info({ to: maskContact(to), mode: MODE }, "sms not sent (log mode)");
    return { skipped: true };
  }
  const msg = await client.messages.create({
    to,
    from: process.env.TWILIO_FROM_NUMBER,
    body,
  });
  // Body is not logged: it can contain an OTP.
  logger.info({ to: maskContact(to), sid: msg.sid }, "sms sent");
  return msg;
}

module.exports = { sendSms };
