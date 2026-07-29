FROM node:24-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED="1"

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/lynx-admin/package.json apps/lynx-admin/package.json
COPY apps/lynx-admin ./apps/lynx-admin

RUN pnpm install --frozen-lockfile --ignore-scripts

ARG BACKEND_URL="http://hono-backend:8000"
ENV BACKEND_URL="$BACKEND_URL"

RUN pnpm --filter lynx-admin build

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV HOSTNAME="0.0.0.0"
ENV PORT="3001"

WORKDIR /app

RUN addgroup --system --gid 1001 lynx \
  && adduser --system --uid 1001 --ingroup lynx lynx

COPY --from=builder --chown=lynx:lynx /app/apps/lynx-admin/.next/standalone ./
COPY --from=builder --chown=lynx:lynx /app/apps/lynx-admin/.next/static ./apps/lynx-admin/.next/static
COPY --from=builder --chown=lynx:lynx /app/apps/lynx-admin/public ./apps/lynx-admin/public

USER lynx

EXPOSE 3001

CMD ["node", "apps/lynx-admin/server.js"]
