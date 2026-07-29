FROM node:24-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED="1"

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/acme-ai/package.json apps/acme-ai/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/sdk-types/package.json packages/sdk-types/package.json
COPY packages/tailwind-config/package.json packages/tailwind-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY sdks/lynx-sdk/package.json sdks/lynx-sdk/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts --prod=false

COPY packages/eslint-config ./packages/eslint-config
COPY packages/sdk-types ./packages/sdk-types
COPY packages/tailwind-config ./packages/tailwind-config
COPY packages/typescript-config ./packages/typescript-config
COPY packages/ui ./packages/ui
COPY sdks/lynx-sdk ./sdks/lynx-sdk
COPY apps/acme-ai ./apps/acme-ai

RUN node node_modules/typescript/bin/tsc -p packages/sdk-types/tsconfig.json

WORKDIR /app/sdks/lynx-sdk

RUN node node_modules/tsup/dist/cli-default.js src/index.ts --format cjs,esm --clean --dts

WORKDIR /app

RUN pnpm --filter acme-ai build

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV HOSTNAME="0.0.0.0"
ENV PORT="3200"

WORKDIR /app

RUN addgroup --system --gid 1001 lynx \
  && adduser --system --uid 1001 --ingroup lynx lynx

COPY --from=builder --chown=lynx:lynx /app/apps/acme-ai/.next/standalone ./
COPY --from=builder --chown=lynx:lynx /app/apps/acme-ai/.next/static ./apps/acme-ai/.next/static

USER lynx

EXPOSE 3200

CMD ["node", "apps/acme-ai/server.js"]
