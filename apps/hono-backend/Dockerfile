FROM node:24-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/hono-backend/package.json apps/hono-backend/package.json
COPY packages ./packages
COPY apps/hono-backend ./apps/hono-backend

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter hono-backend build
RUN pnpm --filter hono-backend deploy --prod --legacy /opt/lynx-backend

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV="production"
WORKDIR /app

RUN addgroup --system --gid 1001 lynx \
  && adduser --system --uid 1001 --ingroup lynx lynx

COPY --from=builder --chown=lynx:lynx /opt/lynx-backend ./

USER lynx
EXPOSE 8000

CMD ["node", "dist/index.js"]
