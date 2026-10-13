# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
# OpenSSL needed for Prisma engine on alpine
RUN apk add --no-cache openssl libc6-compat

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# If you have a build step (TS compile, etc.), uncomment:
# RUN npm run build

# ---- Production dependencies only ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Copy prod-only node_modules first
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy app source/build output, but NOT node_modules (already have the right one above)
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
# Add any other directories your app actually needs at runtime (e.g. public/, views/, dist/ if you have a build step)

RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && mkdir -p /app/.adminjs \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["node", "src/server.js"]