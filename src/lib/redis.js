// Shared Redis connection. Used directly for OTP key storage (short TTL
// key-value pairs) and passed to BullMQ as its connection.
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ when sharing a connection
});

module.exports = redis;
