// Single shared Prisma client instance. Import this everywhere instead of
// creating `new PrismaClient()` in multiple files, which would open too
// many DB connections.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
