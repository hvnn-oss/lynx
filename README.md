# Lynx

Lynx는 AI 에이전트가 왜 특정 행동을 했는지 추적하고, 문제가 생겼을 때 원인을 빠르게 분석하기 위한 관측성 플랫폼입니다.

SDK는 AI 서비스 안에서 실행 컨텍스트, LLM 호출, 도구 호출, 정책 판단, 결과 상태를 수집합니다. 백엔드는 이벤트를 수집하고 저장하며, 대시보드는 세션 타임라인과 지표를 통해 디버깅 흐름을 제공합니다.

## 프로젝트 구조

```text
lynx/
├─ apps/
│  ├─ backend/          # NestJS API, 이벤트 수집, 인증, 관측 API
│  ├─ lynx-dashboard/   # Next.js 대시보드
│  └─ lynx-landing/     # Next.js 제품 소개/개발자 허브
├─ sdks/
│  └─ lynx-sdk/         # AI 서비스에 설치하는 TypeScript SDK
└─ packages/
   ├─ constants/        # 공통 상수
   ├─ database/         # TypeORM 엔티티와 DB 설정
   ├─ dto/              # 백엔드 API 요청/응답 DTO
   ├─ eslint-config/    # 공통 ESLint 설정
   ├─ sdk-types/        # SDK와 백엔드가 공유하는 이벤트 타입
   ├─ tailwind-config/  # 공통 Tailwind 설정
   ├─ typescript-config/# 공통 TypeScript 설정
   └─ ui/               # 공통 UI 컴포넌트
```

## 핵심 구성

- `@repo/sdk`: AI 서비스에 설치하는 SDK입니다. 기본적으로 백그라운드 전송, 짧은 timeout, circuit breaker, 큐 overflow 정책을 사용합니다.
- `backend`: SDK가 보내는 `/openapi/v1/events`와 `/openapi/v1/events/batch` 이벤트를 수집합니다.
- `@repo/sdk-types`: SDK 이벤트 스키마를 백엔드와 공유합니다.
- `@repo/dto`: 대시보드, 관측, 디버깅 API의 요청/응답 DTO를 제공합니다.
- `lynx-dashboard`: 수집된 세션, 이벤트, 비용, 병목, 정책 이벤트를 확인하는 콘솔입니다.
- `lynx-landing`: 제품 소개와 SDK 사용 흐름을 보여주는 페이지입니다.

## 요구 사항

- Node.js `>=18`
- pnpm `11.9.0`
- PostgreSQL
- Redis

## 시작하기

```bash
pnpm install
pnpm build
```

개발 서버를 모두 실행하려면:

```bash
pnpm dev
```

개별 앱 실행:

```bash
pnpm --filter backend dev
pnpm --filter lynx-dashboard dev
pnpm --filter lynx-landing dev
```

기본 포트:

- backend: `http://localhost:4000` 또는 `.env`의 `PORT`
- lynx-dashboard: `http://localhost:3000`
- lynx-landing: `http://localhost:3001`

## SDK 빠른 예시

```ts
import { LynxTracer } from "@repo/sdk";

const lynx = new LynxTracer({
  clientId: "support-api",
  endpoint: "http://localhost:4000",
  apiKey: process.env.LYNX_API_KEY,
});

await lynx.run("SupportAgent", async () => {
  lynx.userInput("환불하고 싶어요");
  lynx.decision("refund workflow selected");
});
```

SDK 기본값은 프로덕션 서비스가 Lynx 서버 장애에 끌려가지 않도록 잡혀 있습니다.

- `delivery.mode`: `"BACKGROUND"`
- `delivery.flushOnRunEnd`: `false`
- `delivery.timeoutMs`: `1000`
- `circuitBreaker.enabled`: `true`

자세한 내용은 [SDK README](sdks/lynx-sdk/README.md)를 보세요.

## 검증

```bash
pnpm check-types
pnpm lint
pnpm test
```

SDK만 검증하려면:

```bash
pnpm --filter @repo/sdk build
pnpm --filter @repo/sdk test
```

## 현재 개발 메모

아직 배포 전 단계이므로 이전 SDK 옵션과의 호환성은 유지하지 않습니다. 문서와 코드는 현재 API인 `endpoint`, `delivery`, `circuitBreaker` 구조를 기준으로 맞춥니다.
