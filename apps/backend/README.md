# Lynx Backend

Lynx 백엔드는 SDK 이벤트를 수집하고, 인증/조직/관측 API를 제공하는 NestJS 서비스입니다.

주요 역할:

- SDK 이벤트 단건 수집: `POST /openapi/v1/events`
- SDK 이벤트 배치 수집: `POST /openapi/v1/events/batch`
- 이벤트 저장과 retention 처리
- 대시보드/관측 API 제공
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

## 관련 패키지

- `@repo/database`: `EventEntity`, `SessionEntity` 등 저장 모델
- `@repo/dto`: API 요청/응답 DTO
- `@repo/sdk-types`: SDK 이벤트 타입
