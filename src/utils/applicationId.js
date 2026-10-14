// Generates the short, human-readable public tracking code customers use
// to check booking status (e.g. "APP-7F3A2"). Kept separate from the DB's
// internal uuid `id` so the public code can be short and typo-friendly.
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

function generateApplicationId() {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `APP-${code}`;
}

module.exports = { generateApplicationId };
