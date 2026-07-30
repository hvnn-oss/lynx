# Lynx

Lynx는 AI Agent 실행을 Run 단위로 기록하고, 문제의 원인 후보를 조사하며,
위험한 Tool 실행을 직전에 통제하는 운영 플랫폼입니다.

```text
Observe → Understand → Control → Improve
```

현재 저장소에는 TypeScript SDK, Hono 수집·관리 API, 운영 대시보드, 내부
관리자 앱과 SDK/OpenAPI 문서가 함께 들어 있습니다. 아래 설명은 로드맵이
아니라 현재 코드에 구현된 경계를 기준으로 합니다.

## 현재 구현 범위

- `@lynxops/sdk`가 Run, Session, LLM 호출, Tool 호출, 정책 판단과 결과
  이벤트를 백그라운드로 전송합니다.
- SDK는 중앙에서 배포한 프롬프트와 방화벽 정책을 로컬에 캐시하고,
  실행 직전에 정책을 평가할 수 있습니다.
- Hono backend는 Workspace API Key 기반 이벤트 수집과 Run 조회,
  Access Token 기반 관리 API를 분리해 제공합니다.
- Issue Record는 먼저 저장된 뒤 worker가 비동기로 평가하며, fingerprint를
  이용해 기존 이슈에 묶거나 새 이슈를 생성합니다.
- 방화벽 정책, 승인 요청, 탐지·차단 기록, 프롬프트 버전·배포·실험을
  관리할 수 있습니다.
- Dashboard는 실행, 세션, Agent, 비용, 이슈, 방화벽과 프롬프트 운영
  화면을 제공합니다.
- Admin은 감사 기록, 조직과 요금제, 파일럿 대상, Workspace API Key와
  OpenAPI 사용량을 관리합니다.

Lynx는 모든 입력과 출력을 항상 원문으로 저장하지 않습니다. SDK의
`full`, `metadata-only`, `smart` 수집 모드와 마스킹 설정에 따라 보존되는
payload가 달라집니다.

## 저장소 구성

- `apps/hono-backend`: Hono 기반 관리 API, SDK OpenAPI, 인증, 이벤트 수집,
  이슈 처리, 방화벽, 프롬프트 운영과 background worker
- `apps/lynx-dashboard`: 운영자가 실행 상태와 문제를 확인하는 Next.js
  대시보드
- `apps/lynx-admin`: 감사, 조직, 요금제, 파일럿과 API 사용량을 관리하는
  내부 Next.js 앱
- `apps/acme-ai`: `@lynxops/sdk` 연동을 검증하는 예제 Agent 앱
- `apps/sdk-docs`: SDK와 OpenAPI 공개 문서
- `sdks/lynx-sdk`: 고객 서비스에 설치되는 TypeScript SDK
- `packages/database`: TypeORM 엔티티, 마이그레이션과 seed
- `packages/sdk-types`: SDK와 수집 서버가 공유하는 공개 타입과 OpenAPI 계약
- `packages/dto`: 관리 API와 프론트엔드가 공유하는 Zod DTO
- `packages/contract`: 관리 API의 method, path, params, request, response 계약
- `packages/constants`: 권한, 상태, API Key scope와 오류 코드
- `packages/ui`: Dashboard에서 재사용하는 UI 컴포넌트

## 요구 사항

전체 monorepo 개발 환경:

- Node.js `>=20.9.0`—Next.js 16 앱까지 포함한 기준이며 CI는 Node.js 24를
  사용합니다.
- pnpm `11.17.0`
- PostgreSQL
- Valkey 또는 Redis 프로토콜 호환 서버
- root `prepare` 스크립트에서 pre-commit을 설치할 때 사용할 Python과 pip

`@lynxops/sdk` 패키지만 사용할 때의 최소 Node.js 버전은 `18`입니다.
로컬 PostgreSQL과 Valkey는 `compose.yaml`로 실행할 수 있습니다.

## 시작하기

패키지 매니저 버전을 맞추고 의존성을 설치합니다.

```bash
corepack enable
pnpm install
```

Docker로 API, worker, PostgreSQL, Valkey와 Dashboard를 함께 실행하려면:

```bash
docker compose up --build
```

소스에서 개발 서버를 실행할 때는 backend에 필요한 환경 변수와
PostgreSQL·Valkey 연결을 먼저 준비합니다.

```bash
pnpm build
pnpm dev
```

루트 `pnpm dev`는 SDK 문서 앱을 제외한 workspace의 `dev` 스크립트를
실행합니다. 문서는 별도로 실행합니다.

```bash
pnpm --filter docs dev
```

개별 앱:

```bash
pnpm --filter hono-backend dev
pnpm --filter lynx-dashboard dev
pnpm --filter lynx-admin dev
pnpm --filter acme-ai dev
pnpm --filter docs dev
```

기본 개발 포트:

- Hono backend: `http://localhost:8000`
- Dashboard: `http://localhost:3000`
- Admin: `http://localhost:3001`
- SDK docs: `http://localhost:3002`
- ACME SDK example: `http://localhost:3100`

Dashboard와 Admin은 `BACKEND_URL`을 사용해 backend로 요청을 전달합니다.
ACME 앱의 production start와 컨테이너 기본 포트는 `3200`이며 개발
서버만 `3100`을 사용합니다.

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

SDK 기본 endpoint는 `https://api.lynxops.co`입니다. 로컬 backend나
자체 배포 서버를 사용할 때는 `endpoint`를 명시합니다. `initialize()`는
관리형 프롬프트와 정책을 미리 불러올 때 사용하며, 단순 이벤트 수집만
사용한다면 필수 호출은 아닙니다.

## API와 테넌트 경계

- 관리 API는 Access Token과 조직·Workspace 접근 권한을 사용합니다.
- `/openapi/v1`은 Workspace API Key와 endpoint별 최소 scope를 사용합니다.
- 이벤트 수집에는 `events:write`, runtime config에는 `config:read`와
  `policies:read`, OpenAPI Run 조회에는 `usage:read`가 필요합니다.
- 서버는 SDK payload의 `workspaceId`보다 인증된 API Key의 Workspace와
  environment를 우선합니다.
- 현재 공개 OpenAPI 문서는 `GET /openapi.json`에서 확인할 수 있습니다.

공유 계약 변경 후에는 `packages/constants`, `packages/sdk-types`,
`packages/dto`, `packages/database`, `packages/contract`가 먼저 빌드되어야
합니다. Backend의 `predev`와 `prebuild`가 이 순서를 처리합니다.

## Backend 프로세스 역할

API와 worker는 같은 `hono-backend` 코드와 이미지를 사용하지만
`LYNX_PROCESS_ROLE`로 실행 역할을 분리할 수 있습니다.

- `api`: HTTP API만 실행
- `worker`: Issue Record 평가, Webhook 전송, 데이터 보존과 운영 상태
  점검 worker만 실행
- `all`: API와 worker를 한 프로세스에서 함께 실행하는 기본 개발 모드

`compose.yaml`은 API와 worker를 별도 컨테이너로 실행합니다. 현재 worker는
PostgreSQL polling을 사용하므로 여러 worker로 확장하기 전에 claim과
동시 실행 동작을 다시 검증해야 합니다.

## 데이터베이스

```bash
pnpm migration:run
pnpm migration:revert
pnpm seed:plans
```

스키마는 TypeORM `synchronize`가 아니라 마이그레이션으로 변경합니다.
다음 명령은 스키마와 데이터를 삭제하므로 로컬 개발 DB에서만 사용합니다.

```bash
pnpm db:reset
```

## 상태 확인

- `GET /health`: 프로세스 응답과 배포 `releaseSha`, `deployedAt`
- `GET /health/live`: liveness 확인
- `GET /health/ready`: PostgreSQL, Valkey와 worker 운영 상태 확인

Backend 배포 workflow는 commit SHA로 ECR 이미지를 만들고, 일회성 ECS
Task로 마이그레이션을 실행한 뒤 ECS 서비스를 갱신합니다. Dashboard와
Admin은 공통 ECS 배포 workflow를 사용하며, 최초 실행에서는
`publish_only`로 이미지만 ECR에 올린 뒤 ECS 서비스와 Target Group을
연결할 수 있습니다. ECS 관련 변수가 아직 없으면 push 실행도 자동으로
이미지만 게시합니다. ACME에는 Dockerfile만 있고 자동 배포 workflow는
아직 없습니다.

Dashboard와 Admin 배포 환경에는 다음 GitHub Actions 변수가 필요합니다.

- 공통: `AWS_ACCOUNT_ID`, `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `ECS_CLUSTER`
- 앱별: `ECR_REPOSITORY`, `ECS_SERVICE`, `ECS_TASK_DEFINITION`,
  `ECS_CONTAINER_NAME`
- 연결: `BACKEND_URL`, 선택 사항인 `HEALTHCHECK_URL`

완전한 private subnet 배포에서는 `BACKEND_URL`에 public API 주소를 넣지
않고 ECS Service Connect나 private service discovery의 내부 backend
주소를 사용해야 합니다.

## 검증

변경 범위에 가장 가까운 명령부터 실행합니다.

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
pnpm --filter hono-backend build
pnpm --filter hono-backend test
```

## 현재 확장 경계

- 원본 이벤트와 현재 Dashboard 집계는 PostgreSQL을 사용합니다.
- 데이터가 증가하면 무거운 실시간 집계를 hourly rollup과 usage summary
  형태로 옮기는 것을 검토합니다.
- Issue Record와 Webhook worker는 queue 제품이 아니라 PostgreSQL claim과
  polling을 사용합니다.
- 원본 payload를 다루는 기능은 수집 모드, 크기 제한과 민감정보 마스킹
  설정을 함께 확인해야 합니다.
- `@lynxops/sdk`가 현재 공식 구현 언어이며 다른 언어는 `/openapi.json`과
  공개 문서를 기준으로 별도 구현할 수 있습니다.
