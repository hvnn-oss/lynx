# Lynx Backend

Lynx 백엔드는 SDK 이벤트를 수집하고, 인증/조직/관측/디버그 API를 제공하는 NestJS 서비스입니다.

주요 역할:

- SDK 이벤트 단건 수집: `POST /openapi/v1/events/ingest`
- SDK 이벤트 배치 수집: `POST /openapi/v1/events/batch`
- ingestion batch size, timestamp skew, rate limit 방어
- 이벤트 저장과 retention 처리
- 대시보드/관측/디버그 API 제공
- 회원가입, 로그인, 이메일 인증, 조직 설정 API 제공

## 실행

레포 루트에서 실행합니다.

```bash
pnpm install
pnpm --filter backend dev
```

프로덕션 빌드:

```bash
pnpm --filter backend build
pnpm --filter backend start:prod
```

테스트:

```bash
pnpm --filter backend test
pnpm --filter backend test:e2e
```

## 환경 변수

`.env` 또는 `.env.local`에 설정합니다.

```env
NODE_ENV=development
PORT=4000
APP_VERSION=1.0.0
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000

JSON_BODY_LIMIT=2mb
CORS_ORIGIN=http://localhost:3000
INGEST_RATE_LIMIT_PER_MINUTE=600
MAX_INGEST_BATCH_SIZE=100
MAX_EVENT_FUTURE_SKEW_SECONDS=300

JWT_ACCESS_SECRET=change-me-access-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-me-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=lynx
DB_SYNCHRONIZE=true
DB_LOGGING=true

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=3600

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_SECURE=false
SMTP_FROM_EMAIL=noreply@example.com

RETENTION_DAYS_FREE=3
RETENTION_DAYS_PRO=30
RETENTION_DAYS_ENTERPRISE=365
```

## SDK 연동

SDK의 `endpoint`는 백엔드 주소를 가리켜야 합니다.

```ts
const lynx = new LynxTracer({
  clientId: 'support-api',
  endpoint: 'http://localhost:4000',
  apiKey: process.env.LYNX_API_KEY,
});
```

SDK는 배치 이벤트를 `/openapi/v1/events/batch`로 전송합니다. 백엔드는 `x-api-key` 또는 `Authorization: Bearer ...` 헤더를 읽어 수집 요청을 처리합니다.

## Ingestion 운영 가드

- 배치 요청당 workspace 조회를 1회로 제한합니다.
- 같은 배치 안에서 동일 agent/session은 캐시해 반복 조회를 줄입니다.
- `MAX_INGEST_BATCH_SIZE`를 초과한 요청은 거절합니다.
- 오래된 이벤트는 workspace plan retention 기준으로 건너뜁니다.
- 너무 먼 미래 timestamp는 거절합니다.
- ingestion endpoint에는 간단한 in-memory rate limit이 적용됩니다.

## Debug API

디버그 API는 대시보드가 세션 단위로 문제를 조회할 수 있도록 deterministic 분석 결과를 제공합니다. 실제 replay 실행이나 LLM 기반 RCA는 v1 범위에 포함하지 않습니다.

세션 단위 API:

```text
GET  /api/v1/debug/sessions
GET  /api/v1/debug/sessions/:sessionId/events
GET  /api/v1/debug/sessions/:sessionId/timeline
GET  /api/v1/debug/sessions/:sessionId/root-cause
GET  /api/v1/debug/sessions/:sessionId/memory
POST /api/v1/debug/sessions/:sessionId/reproduce
POST /api/v1/debug/sessions/:sessionId/policy/simulate
```

집계 API:

```text
GET /api/v1/debug/patterns
GET /api/v1/debug/bottlenecks
GET /api/v1/debug/latency
```

모든 API는 `workspaceId`를 기준으로 권한을 확인합니다. 세션 조회는 항상 `workspaceId + sessionId` 조합으로 조회해 다른 workspace의 세션이 노출되지 않게 합니다.

v1 분석 규칙:

- RCA는 `analysisMethod: HEURISTIC_V1` 기반 후보와 근거를 반환합니다.
- 패턴 signature는 `SIGNATURE_V1` 정규화 규칙을 사용합니다.
- timeline은 잘못된 span parent, cycle, 누락 parent를 방어적으로 처리합니다.
- reproduce는 실제 실행이 아니라 `DRY_RUN_ONLY` replay plan을 생성합니다.
- policy simulate는 저장된 `POLICY_EVALUATION` 이벤트 기반 추정이며 `actuallyEvaluated: false`를 반환합니다.

## DB 마이그레이션

관측/디버그 조회와 ingestion을 위해 이벤트, 세션, 에이전트, 워크스페이스 인덱스 마이그레이션이 포함되어 있습니다.

```bash
pnpm --filter @repo/database build
```

실제 마이그레이션 실행 방식은 배포 환경의 TypeORM migration runner 설정을 따릅니다.

## 관련 패키지

- `@repo/database`: `EventEntity`, `SessionEntity` 등 저장 모델
- `@repo/dto`: API 요청/응답 DTO
- `@repo/sdk-types`: SDK 이벤트 타입
