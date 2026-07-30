FROM node:24-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED="1"
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/lynx-dashboard/package.json apps/lynx-dashboard/package.json
COPY packages ./packages
COPY apps/lynx-dashboard ./apps/lynx-dashboard

RUN pnpm install --frozen-lockfile --ignore-scripts --prod=false

# 패키지 빌드에서 pnpm shim에 의존하지 않고 TypeScript CLI를 찾도록 보장합니다.
ENV PATH="/app/node_modules/typescript/bin:$PATH"

ARG BACKEND_URL="http://hono-backend:8000"
ENV BACKEND_URL="$BACKEND_URL"
RUN pnpm exec turbo run build --filter=lynx-dashboard

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"
WORKDIR /app

RUN addgroup --system --gid 1001 lynx \
  && adduser --system --uid 1001 --ingroup lynx lynx

COPY --from=builder --chown=lynx:lynx /app/apps/lynx-dashboard/.next/standalone ./
COPY --from=builder --chown=lynx:lynx /app/apps/lynx-dashboard/.next/static ./apps/lynx-dashboard/.next/static
COPY --from=builder --chown=lynx:lynx /app/apps/lynx-dashboard/public ./apps/lynx-dashboard/public

USER lynx
EXPOSE 3000

CMD ["node", "apps/lynx-dashboard/server.js"]
