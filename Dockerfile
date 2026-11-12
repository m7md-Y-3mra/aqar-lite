FROM node:22-bookworm-slim AS base
# Prisma's schema engine (migrate deploy) needs OpenSSL at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
RUN --mount=type=cache,target=/app/.next/cache npm run build
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production
ENV PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/src/server/env.ts ./src/server/env.ts
COPY --from=build --chown=node:node /app/src/generated ./src/generated
COPY --from=build --chown=node:node /app/docker/app/entrypoint.sh ./docker/app/entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["./docker/app/entrypoint.sh"]
