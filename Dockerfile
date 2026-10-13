# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22.23.3-alpine3.24.2@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

# ---------- base: shared OS layer ----------
FROM ${NODE_IMAGE} AS base
WORKDIR /app
# openssl: Prisma's query/schema engines link against it on Alpine.
# libc6-compat: glibc shims some engine builds still look for.
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# ---------- deps-prod: production node_modules only ----------
FROM base AS deps-prod
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# ---------- dev: local development (all deps, nodemon) ----------
FROM base AS dev
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY prisma ./prisma
RUN npx prisma generate
# Source is bind-mounted by docker-compose.override.yml, not copied.
EXPOSE 3000
CMD ["npx", "nodemon", "src/server.js"]

# ---------- runtime: production image ----------
FROM base AS runtime

ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="salon-backend" \
      org.opencontainers.image.revision="${GIT_SHA}"
ENV GIT_SHA=${GIT_SHA}

COPY --from=deps-prod /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src

RUN addgroup -S app && adduser -S -G app app \
 && mkdir -p /app/.adminjs \
 && chown app:app /app/.adminjs

USER app
EXPOSE 3000
CMD ["node", "src/server.js"]