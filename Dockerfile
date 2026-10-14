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

FROM deps-prod AS admin-bundle
COPY scripts ./scripts
COPY src ./src
# Placeholder values only to satisfy config validation; nothing connects.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    REDIS_URL=redis://localhost:6379 \
    ADMIN_SESSION_SECRET=build JWT_SECRET=build \
    FRONTEND_ORIGIN=http://localhost \
    CLOUDINARY_CLOUD_NAME=build CLOUDINARY_API_KEY=build CLOUDINARY_API_SECRET=build \
    node scripts/bundle-admin.js \
 && test -s .adminjs/bundle.js

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

COPY --from=admin-bundle /app/.adminjs ./.adminjs
ENV ADMIN_JS_SKIP_BUNDLE=true

RUN addgroup -S app && adduser -S -G app app

USER app
EXPOSE 3000
CMD ["node", "src/server.js"]
