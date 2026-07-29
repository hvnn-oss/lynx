# Lynx

Lynx는 AI Agent 실행을 Run 단위로 기록하고, 문제 원인 후보를 추적하며,
위험한 Tool 실행을 직전에 통제하는 운영 플랫폼입니다.

핵심 흐름은 다음과 같습니다.

```text
Observe → Understand → Control → Improve
```

## 저장소 구성

- `apps/hono-backend`: Hono 기반 관리 API, SDK OpenAPI, 인증, 이벤트 수집,
  이슈 판정, 방화벽 및 프롬프트 운영을 담당합니다.
- `apps/lynx-dashboard`: 운영자가 Run, Session, Agent, 비용, 이슈, 정책과
  프롬프트를 확인하는 Next.js 대시보드입니다.
- `apps/acme-ai`: `@lynxops/sdk` 연결을 검증하는 예제 Agent 앱입니다.
- `apps/sdk-docs`: SDK와 OpenAPI 공개 문서입니다.
- `apps/lynx-admin`: 향후 내부 운영 기능을 위한 초기 관리자 앱입니다.
- `sdks/lynx-sdk`: 고객 서비스에 설치되는 TypeScript SDK입니다.
- `packages/database`: TypeORM 엔티티, 초기 마이그레이션과 시드를 관리합니다.
- `packages/sdk-types`: SDK와 수집 서버가 공유하는 공개 요청 계약입니다.
- `packages/dto`: 관리 API와 대시보드가 공유하는 Zod DTO입니다.
- `packages/contract`: HTTP method, path, params, request, response 계약입니다.
- `packages/constants`: 권한, 상태, API Key scope와 오류 코드를 관리합니다.
- `packages/ui`: 대시보드 공통 UI 컴포넌트입니다.

## 요구 사항

- Node.js `>=18`
- pnpm `11.17.0`
- PostgreSQL
- Redis

## 시작하기

의존성 설치 후 전체 공유 패키지와 앱을 빌드합니다.

```bash
pnpm install
pnpm build
```

전체 개발 환경:

```bash
pnpm dev
```

개별 앱:

```bash
pnpm --filter hono-backend dev
pnpm --filter lynx-dashboard dev
pnpm --filter acme-ai dev
pnpm --filter docs dev
```

기본 포트:

- Hono backend: `http://localhost:8000` 또는 `PORT`
- Dashboard: `http://localhost:3000`
- SDK docs: `http://localhost:3002`
- ACME SDK example: `http://localhost:3100`

대시보드는 `BACKEND_URL`을 사용해 `/api/*` 요청을 Hono 서버로 전달합니다.

## SDK 빠른 예시

```ts
import { LynxTracer } from "@lynxops/sdk";

const lynx = new LynxTracer({
  clientId: "support-api",
  agentId: "support-agent",
  apiKey: process.env.LYNX_API_KEY,
});

await lynx.initialize();

await lynx.run("SupportAgent", async () => {
  lynx.userInput("환불하고 싶어요");
  lynx.decision("refund workflow selected");
});

await lynx.shutdown();
```

SDK 기본 endpoint는 `https://api.lynxops.co`입니다. 자체 서버나 로컬
백엔드를 사용할 때만 `endpoint`를 지정합니다.

## API 경계

- 관리 API는 Access Token과 조직·워크스페이스 capability를 사용합니다.
- `/openapi/v1`은 Workspace API Key와 최소 scope를 사용합니다.
- SDK payload의 `workspaceId`보다 API Key에서 확인한 workspace 경계를
  우선합니다.
- 공유 계약 변경 후에는 `packages/constants`, `packages/sdk-types`,
  `packages/dto`, `packages/database`, `packages/contract` 순서의 빌드가
  선행되어야 합니다. 루트 `pnpm dev`와 backend `predev`가 이를 처리합니다.

## 데이터베이스

```bash
pnpm migration:run
pnpm migration:revert
pnpm db:reset
```

스키마는 TypeORM `synchronize`가 아니라 마이그레이션으로만 변경합니다.

## 검증

```bash
pnpm check-types
pnpm lint
pnpm test
```

SDK:

```bash
pnpm --filter @lynxops/sdk build
pnpm --filter @lynxops/sdk test
```

Backend:

```bash
pnpm --filter hono-backend test
```

## 현재 확장 경계

- 이벤트 원본은 PostgreSQL에 저장하고 대시보드 집계도 현재 PostgreSQL에서
  계산합니다.
- 데이터 증가 시 Dashboard repository를 직접 확장하지 않고 hourly rollup과
  usage summary 테이블로 이전합니다.
- Issue Record worker는 현재 단일 프로세스 polling 방식입니다. 다중 서버로
  확장할 때 별도 worker process 또는 queue로 분리합니다.
- 원본 payload를 다루는 기능은 수집 모드와 마스킹 설정을 확인해야 합니다.
