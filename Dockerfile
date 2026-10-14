# syntax=docker/dockerfile:1.7
#
# One image for the API, worker and migration task; the latter two override CMD.

ARG NODE_IMAGE=node:22.23.3-alpine3.24.2@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

FROM ${NODE_IMAGE} AS base
WORKDIR /app
# Prisma engines need openssl on Alpine.
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

FROM base AS deps-prod
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

FROM base AS dev
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY prisma ./prisma
RUN npx prisma generate
EXPOSE 3000
CMD ["npx", "nodemon", "src/server.js"]

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

# Code stays root-owned; only .adminjs is writable because AdminJS writes
# its component bundle there at startup.
RUN addgroup -S app && adduser -S -G app app \
 && mkdir -p /app/.adminjs \
 && chown app:app /app/.adminjs

USER app
EXPOSE 3000
CMD ["node", "src/server.js"]
