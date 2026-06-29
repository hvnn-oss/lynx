# Lynx

Lynx는 AI 에이전트의 실행을 기록하고, 문제 원인을 추적하며, 위험한 행동을 실행 직전에 차단하기 위한 런타임 운영 플랫폼이다.

단순한 LLM 호출 로그 도구가 아니라, 한 번의 사용자 요청이 어떤 판단, LLM 호출, 도구 실행, 재시도, 정책 판단, 최종 결과로 이어졌는지 하나의 실행 단위로 복원하는 것을 목표로 한다.

## 저장소 구성

- `apps/backend`: NestJS API, 이벤트 수집, 인증, 관측 API, 디버깅 API를 담당한다.
- `apps/lynx-dashboard`: 운영자가 실행 상태, 비용, 오류, 정책 이벤트를 확인하는 Next.js 대시보드다.
- `apps/lynx-landing`: 제품 소개와 개발자 진입점을 담당한다.
- `apps/sdk-docs`: 외부 사용자를 위한 SDK 문서 사이트다.
- `sdks/lynx-sdk`: 고객 서비스에 설치되는 TypeScript SDK다.
- `packages/database`: TypeORM 엔티티, 마이그레이션, DB 설정을 담당한다.
- `packages/dto`: 백엔드와 프론트엔드가 공유하는 요청과 응답 계약이다.
- `packages/sdk-types`: SDK와 서버가 공유하는 이벤트 타입이다.
- `packages/constants`: 공통 상수, 권한, 에러 코드, 정책 값을 둔다.
- `packages/ui`: 공통 UI 컴포넌트다.

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
  apiKey: process.env.LYNX_API_KEY,
});

await lynx.run("SupportAgent", async () => {
  lynx.userInput("환불하고 싶어요");
  lynx.decision("refund workflow selected");
});
```

SDK의 기본 수집 서버는 `https://api.lynxops.co`다. 자체 서버나 로컬 백엔드를 사용할 때만 `endpoint`를 명시한다.

SDK 기본값은 프로덕션 서비스가 Lynx 서버 장애에 끌려가지 않도록 안전하게 맞춰져 있다.

- `delivery.mode`: `"BACKGROUND"`
- `delivery.flushOnRunEnd`: `false`
- `delivery.timeoutMs`: `1000`
- `circuitBreaker.enabled`: `true`

자세한 내용은 [SDK README](sdks/lynx-sdk/README.md)를 참고한다.

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

아직 배포 전 단계이므로 이전 SDK 옵션과의 호환성은 유지하지 않는다. 문서는 코드의 현재 API인 `endpoint`, `delivery`, `circuitBreaker`, `flush()`, `shutdown()` 구조를 기준으로 맞춘다.

## 운영 리스크 TODO

이번 점검에서 바로 손댄 범위와 별개로, 아직 충분히 검증하지 못했거나 제품이 커질수록 위험해질 수 있는 부분을 따로 기록한다.

### 아직 검사하지 못한 부분

- [ ] 결제/사용량 집계가 실제 과금 기준과 정확히 맞는지 검증하기
- [ ] 마이그레이션 실행, 롤백, 시드 순서가 빈 DB와 기존 DB 모두에서 안전한지 검증하기
- [ ] 어드민 변경 작업이 모두 감사 로그로 남는지 확인하기
- [ ] 대시보드 전체 문구가 `next-intl` 메시지 파일만 사용하도록 점검하기
- [ ] SDK README와 `apps/sdk-docs` 문서가 실제 SDK 옵션, DTO, 엔드포인트와 일치하는지 다시 맞추기
- [ ] 프론트엔드 인증 만료, 새로고침, 워크스페이스 전환, 권한 없음 상태를 E2E로 검증하기
- [ ] 백엔드 API별 요청 추적 ID, 구조화 로그, 장애 알림 기준을 정리하기
- [ ] 데이터 보존 기간 만료, 삭제, 백업 복구 정책을 실제 운영 절차로 검증하기
- [ ] SSO/OIDC, 조직 도메인, 초대 흐름의 권한 상승 가능성을 별도 보안 점검하기
- [ ] 원본 payload 마스킹, `metadata-only`, `smart` 수집 모드가 모든 화면과 API에서 일관되게 동작하는지 확인하기

### 앞으로 위험해질 수 있는 부분

- [x] 인메모리 rate limit을 Redis 기반 rate limit으로 교체하기
- [ ] 원본 이벤트 직접 조회가 느려지기 전에 세션 요약, 에이전트 요약, 사용량 집계 테이블을 분리하기
- [x] 이벤트 payload 원문 기본 노출을 끄고 명시 설정(`LYNX_EXPOSE_RAW_PAYLOADS=true`)에서만 내려주기
- [ ] API key scope, 만료, 폐기, 최근 사용 시각을 관리할 수 있는 화면과 API를 추가하기
- [x] 기존 평문 workspace API key를 해시 기반 key 테이블로 백필하는 스크립트 추가하기
- [ ] 백필 실행 후 기존 평문 workspace API key 컬럼 제거하기
- [ ] refresh token과 세션을 디바이스 단위로 관리하고, 강제 로그아웃/폐기 기능 추가하기
- [x] demo API가 운영 환경에서 기본 노출되지 않도록 모듈 등록 조건을 환경별로 고정하기
- [x] 요청 단위 requestId를 백엔드 응답 헤더에 일관되게 연결하기
- [ ] requestId를 구조화 로그와 에러 리포팅에도 연결하기
- [ ] 로그 수 기반 과금 정책을 DB의 plan 설정과 usage 집계에 연결하기
- [ ] 이벤트 수집을 동기 DB 저장에서 큐 기반 비동기 처리로 확장할 수 있게 경계 정리하기
- [ ] PostgreSQL 단일 테이블이 커지기 전에 파티셔닝, 보존 삭제, 인덱스 전략을 실제 데이터로 검증하기
