// SMTP email sender. EMAIL_MODE controls delivery:
//   "send" — really send via SMTP (production)
//   "log"  — don't send; log that an email would have gone out (local dev)
const nodemailer = require("nodemailer");
const logger = require("./logger");
const { maskContact } = require("../utils/mask");

const MODE = process.env.EMAIL_MODE || "log";

const transporter =
  MODE === "send"
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      })
    : null;

if (transporter) {
  transporter
    .verify()
    .then(() => logger.info({ host: process.env.SMTP_HOST }, "SMTP ready"))
    .catch((err) => logger.warn({ err }, "SMTP verification failed"));
}

async function sendEmail(to, subject, html) {
  if (MODE !== "send") {
    logger.info(
      { to: maskContact(to), subject, mode: MODE },
      "email not sent (log mode)",
    );
    return { skipped: true };
  }
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
  logger.info(
    { to: maskContact(to), subject, messageId: info.messageId },
    "email sent",
  );
  return info;
}

module.exports = { sendEmail };
