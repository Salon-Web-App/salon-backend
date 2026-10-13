// Generates the 6-digit numeric code sent to the customer via SMS/email.
const crypto = require("crypto");

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

module.exports = { generateOtpCode };
