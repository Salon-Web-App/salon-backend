// Nodemailer transporter, configured against any SMTP relay (Resend,
// SendGrid, Postmark, etc. all offer SMTP credentials that drop in here).
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP verification failed:", error);
  } else {
    console.log("SMTP server is ready");
  }
});
async function sendEmail(to, subject, html) {
  return;
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}

module.exports = { sendEmail };
