function maskContact(value) {
  if (!value || typeof value !== "string") return value;
  if (value.includes("@")) {
    const [user, domain] = value.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return value.length > 4 ? `***${value.slice(-4)}` : "****";
}

module.exports = { maskContact };
