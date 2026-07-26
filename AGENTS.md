# Lynx Agent Guide

## 제품 방향

Lynx는 AI 에이전트의 실행을 기록하고, 문제 원인을 추적하며, 위험한 행동을 실행 직전에 차단하는 런타임 운영 플랫폼이다.

단순한 LLM 호출 로그 도구가 아니라, 한 번의 사용자 요청이 어떤 판단, LLM 호출, 도구 실행, 재시도, 정책 판단, 최종 결과로 이어졌는지 하나의 실행 단위로 복원하는 제품이다.

핵심 흐름은 다음 네 단계다.

```text
Observe
실행을 기록한다.

Understand
문제의 원인을 찾는다.

Control
위험한 행동을 차단한다.

Improve
프롬프트와 정책을 개선한다.
```

Lynx의 현재 제품 정의는 "AI 에이전트용 실행 디버깅 및 런타임 거버넌스 플랫폼"이다. 옵저버빌리티는 진입점이고, 가드레일과 프롬프트 운영은 제품 확장 축이다.

## 지금 집중할 범위

현재 범위는 실행 추적, 디버깅, 기본 가드레일, 프롬프트 버저닝까지다.

우선순위는 다음 순서로 판단한다.

1. TypeScript SDK가 고객 서비스에 안전하게 들어갈 수 있는가.
2. Run, Session, Span, Event 흐름이 안정적으로 수집되는가.
3. 대시보드가 실행 타임라인과 원인 후보를 명확하게 보여주는가.
4. 기본 정책으로 비용 폭주, 무한 반복, 위험한 도구 실행을 막을 수 있는가.
5. 프롬프트 버전과 실행 데이터를 연결할 수 있는가.

지금 하지 않을 일은 범용 AI 평가 플랫폼, 완전 자동 자가치유, 모든 언어 SDK, 복잡한 의미 기반 정책, 대규모 데이터 인프라 선구축, 범용 APM 전체 기능이다.

## 저장소 구조

```text
apps/backend
NestJS API, 이벤트 수집, 인증, 관측 API, 디버깅 API를 담당한다.

apps/lynx-dashboard
Next.js 대시보드다. 운영자가 실행 상태, 비용, 오류, 정책 이벤트를 확인한다.

apps/lynx-landing
제품 소개와 개발자 진입점을 담당한다.

apps/sdk-docs
SDK 문서 사이트다. 문서는 실제 SDK API와 항상 맞아야 한다.

sdks/lynx-sdk
고객 서비스에 설치되는 TypeScript SDK다.

packages/database
TypeORM 엔티티, 마이그레이션, DB 설정을 담당한다.

packages/dto
백엔드와 프론트엔드가 공유하는 요청과 응답 계약이다.

packages/sdk-types
SDK와 서버가 공유하는 이벤트 타입이다.

packages/constants
공통 상수, 권한, 에러 코드, 정책 값을 둔다.

packages/ui
공통 UI 컴포넌트다.
```

## 제품 모델

개별 API 호출보다 Run 중심으로 생각한다.

```text
Run
  Agent Span
  LLM Span
  Tool Span
  Retriever Span
  Memory Span
  Firewall Span
  Human Approval Span
```

주요 식별자는 `runId`, `traceId`, `spanId`, `parentSpanId`, `sessionId`, `workspaceId`, `agentId`, `environment`, `agentVersion`, `promptVersion`이다.

새 기능을 만들 때는 먼저 이 질문에 답한다.

- 이 데이터가 어떤 Run 또는 Session에 붙는가.
- 테넌트 경계는 `workspaceId`, `projectId`, `environment`, `agentId` 중 어디까지 필요한가.
- 원본 이벤트, 세션 요약, 집계 데이터, 사용량 데이터 중 어디에 저장해야 하는가.
- 고객 서비스가 Lynx 서버 장애에 끌려가지 않는가.

## SDK 원칙

SDK는 고객 서비스 안에서 동작한다. 그래서 기능보다 안전성이 먼저다.

- 기본 전송은 백그라운드로 처리한다.
- 이벤트 전송 실패가 고객 요청 실패로 이어지면 안 된다.
- 짧은 timeout, retry, batch, circuit breaker, queue overflow 처리를 유지한다.
- 프로세스 종료 시 `flush()`와 `shutdown()`이 안전하게 동작해야 한다.
- 기본 API는 작고 명확하게 유지한다.
- SDK에서 관리 기능이나 내부 BFF에 접근하지 않는다.
- `events:write`, `config:read`, `policies:read`처럼 최소 권한만 전제한다.

가드레일은 로컬 우선으로 설계한다.

- 중앙 서버는 정책을 만들고 배포한다.
- SDK는 정책을 캐시하고 실행 직전에 로컬에서 평가한다.
- 고위험 행동은 `FAIL_CLOSED` 또는 `REQUIRE_APPROVAL`을 사용할 수 있어야 한다.
- 일반 관측 데이터 전송은 기본적으로 `FAIL_OPEN` 성격으로 다룬다.

## 백엔드 원칙

백엔드는 수집 계약과 조회 계약을 안정적으로 유지한다.

- 컨트롤러는 요청 검증과 라우팅에 집중한다.
- 서비스는 유스케이스 단위로 읽히게 작성한다.
- DTO는 외부 계약이다. 필드 이름을 바꿀 때는 SDK, 대시보드, 문서를 함께 확인한다.
- 엔티티는 저장 모델이다. 화면 편의를 위해 엔티티를 무리하게 바꾸지 않는다.
- 테넌트 경계와 API key 검증을 우회하지 않는다.
- 이벤트 수집은 일부 이벤트 실패가 전체 배치를 불필요하게 망치지 않도록 다룬다.
- 보존 정책, 집계, 사용량 계산은 원본 이벤트 조회와 분리하는 방향을 유지한다.

초기 인프라는 PostgreSQL과 Redis 중심으로 둔다. Kafka, ClickHouse, OpenSearch 같은 대규모 구성은 실제 사용량이 필요해질 때 도입한다.

## 대시보드 원칙

대시보드는 로그 검색기가 아니라 AI 운영 상태를 판단하는 화면이다.

- 운영자가 가장 먼저 봐야 할 것은 실행 수, 성공률, 에러율, 지연 시간, 비용, 활성 에이전트, 정책 차단 수다.
- 개별 실행 화면은 입력, 출력, Span, 오류, 재시도, Tool 인자, 비용, 관련 프롬프트 버전을 한 흐름으로 보여준다.
- Debugging 화면은 Root Cause 후보, 비정상 반복, 병목, 실패 직전 컨텍스트 변화에 집중한다.
- UI는 조용하고 작업 중심이어야 한다. 과한 장식보다 스캔하기 쉬운 정보 구조를 우선한다.
- 기존 공통 컴포넌트와 `@repo/ui`를 먼저 사용한다.
- 아이콘이 필요한 버튼은 `lucide-react`를 우선 사용한다.
- 카드 안에 카드를 중첩하지 않는다.
- 대시보드 본문은 `section`, 명확한 제목, 작고 안정적인 패널 단위로 구성한다.
- 텍스트는 `next-intl` 메시지 파일로 분리한다.

## 문서 원칙

문서는 구현된 API와 다르면 안 된다.

- SDK 문서는 현재 코드의 `endpoint`, `delivery`, `circuitBreaker`, `flush()`, `shutdown()` 기준으로 작성한다.
- 예시는 복사해서 실행 가능한 형태를 우선한다.
- 제품 설명은 "Run 중심", "TypeScript-first", "로컬 우선 가드레일", "프롬프트 버전과 실행 데이터 연결"을 반복해서 일관되게 말한다.
- 문서에서 아직 구현되지 않은 기능은 로드맵이나 예정 기능으로 명확히 구분한다.
- 공개 문서는 영어와 한국어를 함께 수정한다. 영어는 루트 경로, 한국어는 `/ko` 경로를 기준으로 한다.
- 공개 SDK 예시는 OSS 패키지명인 `@lynxops/sdk`를 사용한다.
- 한국어 문서는 `합니다` 톤으로 작성하고, "SDK 연결", "실행 추적", "세션", "도구 호출", "가드레일", "정책", "원인 후보"를 우선 사용한다.
- 한국어 문서에서는 "계측", "텔레메트리", "관측성", "런타임 거버넌스" 같은 무거운 표현을 피한다. 필요한 경우 짧게 설명하고 사용한다.
- 영어 문서는 `connect`, `record`, `track`, `inspect`, `debug`, `session`, `trace`, `event`, `tool call`, `LLM call`, `firewall`, `policy`처럼 짧고 실제적인 단어를 우선한다.
- 원인 분석 기능은 과장하지 않는다. "정확한 원인"이나 "완전 자동 분석" 대신 "원인 후보", "의심되는 지점", "관련 근거", `root cause candidate`, `evidence`를 사용한다.
- 프롬프트, 도구 인자, 모델 응답, 로그, payload를 다루는 문서에는 민감정보 전송과 마스킹에 대한 짧은 보안 메모를 포함한다.

## 코드 스타일

누구나 쉽게 읽을 수 있는 코드를 우선한다.

- 파일은 역할이 바로 드러나는 이름으로 만든다.
- 함수 이름은 동사로 시작하고, 하는 일을 그대로 말한다.
- 큰 함수보다 작은 private helper를 선호한다.
- 중첩 조건이 깊어지면 early return을 사용한다.
- 임시 변수 이름도 의미 있게 짓는다.
- boolean 이름은 `is`, `has`, `can`, `should`로 시작한다.
- 매직 넘버는 상수로 올린다.
- 타입은 가능한 한 DTO, Entity, 공유 타입을 재사용한다.
- `any`는 외부 payload나 점진적 마이그레이션처럼 이유가 있을 때만 쓴다.
- 주석은 복잡한 정책, 장애 처리, 보안 경계처럼 이유가 필요한 곳에만 단다.
- 오래된 깨진 주석이나 인코딩이 깨진 주석은 발견하면 정리한다.

TypeScript 스타일은 현재 코드베이스를 따른다.

- SDK는 ESM 기준 import에 `.js` 확장자를 유지한다.
- 앱과 패키지는 기존 import alias를 따른다.
- Prettier 포맷을 기준으로 한다.
- 백엔드 코드는 NestJS의 module, controller, service 구조를 따른다.
- 프론트엔드 컴포넌트는 props 타입을 가까이에 두고, 화면 전용 helper는 같은 파일 하단에 둔다.
- 공유 가능한 타입과 상수는 `packages`로 올리되, 성급하게 추상화하지 않는다.

## 데이터 수집 정책

Lynx는 모든 데이터를 무조건 원문으로 저장하는 제품이 아니다.

지원해야 하는 수집 모드는 다음 세 가지다.

- `full`: 입력과 출력을 포함한 전체 데이터를 수집한다.
- `metadata-only`: 본문 없이 모델, 토큰, 비용, 지연 시간, 상태, 에러 타입, Tool 이름, Trace 구조만 수집한다.
- `smart`: 정상 실행은 메타데이터 중심으로 저장하고, 오류, 정책 위반, 비정상 지연이 있을 때 상세 데이터를 보존한다.

새 수집 필드를 추가할 때는 다음을 확인한다.

- 민감정보 마스킹 대상인가.
- `metadata-only`에서도 남아야 하는가.
- `maxPayloadBytes`에 걸렸을 때 어떻게 축약되는가.
- 대시보드, 디버깅, 과금 중 어느 목적에 쓰이는가.

## 테스트와 검증

변경 범위에 맞춰 가장 가까운 검증을 먼저 실행한다.

```bash
pnpm check-types
pnpm lint
pnpm test
```

SDK 변경은 다음을 우선 확인한다.

```bash
pnpm --filter @repo/sdk build
pnpm --filter @repo/sdk test
```

백엔드 API 변경은 관련 service, controller spec을 함께 확인한다.

대시보드 변경은 타입 체크와 화면 상태를 확인한다. 로딩, 에러, 빈 데이터, 데모 데이터 상태를 놓치지 않는다.

## 기능 추가 판단 기준

새 기능은 다음 조건을 만족할 때만 추가한다.

1. 여러 고객에게 반복될 가능성이 높다.
2. Lynx의 핵심인 추적, 분석, 통제와 직접 연결된다.
3. 현재 제품 안정화를 크게 지연시키지 않는다.
4. 실제 고객이 사용하거나 비용을 지불할 이유가 있다.

한 고객만을 위한 예외 기능은 기본값으로 넣지 않는다. 필요한 경우 설정, 정책, integration 레이어로 격리한다.

## 작업 시작 전

코드를 수정하기 전에 다음을 확인한다.

1. 요청과 관련된 기존 구현, DTO, Entity, 공유 타입을 먼저 찾는다.
2. 동일한 기능이나 유사한 패턴이 이미 있는지 검색한다.
3. 변경이 SDK, 백엔드, 대시보드, 문서 중 어디까지 영향을 주는지 판단한다.
4. DB 스키마 또는 외부 계약이 바뀌는 경우 마이그레이션과 하위 호환성을 확인한다.
5. 요청 범위를 넘어서는 리팩터링은 하지 않는다.

## 작업 완료 기준

작업은 다음 조건을 만족해야 완료된 것으로 본다.

- 변경된 코드가 타입 체크를 통과한다.
- 관련 테스트가 통과하거나 필요한 테스트가 추가된다.
- 로딩, 오류, 빈 상태 같은 실패 경로가 처리된다.
- 외부 계약을 변경했다면 관련 DTO, SDK, 대시보드, 문서가 함께 반영된다.
- 사용하지 않는 코드, import, 임시 로그를 남기지 않는다.
- 요청과 무관한 파일을 수정하지 않는다.

## Dashboard page templates

Dashboard pages are operational summary screens, not raw data explorers. Build
them from repeatable templates so different AI agents and human developers
produce the same information structure.

- Use reusable dashboard primitives from `@repo/ui/components/dashboard/panel`
  before creating app-local panels.
- Summary pages render top signals only. Do not render an unbounded array
  directly in a dashboard page.
- If an API can return many rows, cap the first screen and show a small
  remaining-items row. Detailed exploration belongs in a detail page with cursor
  pagination, infinite loading, or virtualization.
- Chart panels must have a stable height and an explicit empty state.
- Do not nest cards inside cards. Page sections use a heading plus one panel,
  chart, or bounded list.
- Text shown in dashboard services must come from `next-intl` message files.
- Demo data may be large, but the UI still shows the same capped summary shape
  as production data.

Recommended caps for dashboard summaries:

- Overview
  - KPI cards: exactly 5 cards: runs, failure rate, latency, cost, risk events.
  - Incident insight: show only when there is meaningful run or issue data.
  - Run volume chart: up to the latest 72 hourly buckets.
  - Failure trend chart: up to the latest 72 hourly buckets.
  - Agent health list: top 8 agents by risk, activity, or score priority.
  - Recent issues: top 5 issues sorted by severity and recency.
- Metrics
  - Realtime performance cards: 3 to 5 cards.
  - Latency, token, and error charts: bounded chart buckets only.
  - Agent comparison: top 6 agents by traffic, cost, or risk.
- Usage
  - Top agents: top 6 agents.
  - Environment usage: top 5 environments.
  - Tool usage chart: top 8 tools.
  - Model usage list: top 6 models.
  - Heatmap: fixed 7 by 24 grid.
- Status
  - Agent status: bounded status counts and top failing components.
  - Recent outages: top 5 outages sorted by recency and severity.
  - Model status: top 5 models by traffic or degraded status.
  - Tool status: top 5 tools by traffic or degraded status.
- Cost
  - Total cost: today, this week, this month.
  - Cost by agent chart: top 8 agents.
  - Cost anomalies: top 5 anomalies sorted by severity and recency.
- Insights
  - Insight list: top 6 insights sorted by severity, recency, and impact.
  - Each item should show cause, impact, affected agents/sessions, and an RCA
    link when available.

When a page needs free exploration across thousands of runs, spans, events,
tools, agents, or issues, create a separate detail route instead of expanding
the summary page. The detail route should request data with server-side
pagination parameters and avoid client-side filtering over a full dataset.

## Lynx UI style guide

Follow `docs/lynx-ui-style-guide.md` for dashboard, session, and debugging UI.
The short version:

- Build a quiet Vercel-like B2B SaaS debugging interface: white or subtle gray
  surfaces, thin borders, small radius, minimal shadow, no decorative gradients.
- Pages should follow header, summary cards, diagnosis box, filter bar, main
  content, and detail panel where appropriate.
- Show cause, evidence, next action, and related session/trace links before raw
  logs or payloads.
- Use badges and compact rows for status and issues. Keep raw JSON collapsed by
  default.
- Prefer reusable primitives from `packages/ui`; add shared components there
  before duplicating app-local UI.

## Dependency and module safety

이 저장소에서는 일반적인 코드 수정과 검증 과정에서 의존성 설치 상태를 변경하지 않는다.

- 사용자가 명시적으로 요청하고 승인하지 않는 한 `pnpm install`, `pnpm add`, `pnpm remove`, `pnpm update`, `pnpm prune` 및 `--force`가 포함된 의존성 명령을 실행하지 않는다.
- 사용자가 명시적으로 요청하고 승인하지 않는 한 `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`의 의존성 및 패키지 매니저 설정을 변경하지 않는다.
- 사용자가 명시적으로 요청하고 승인하지 않는 한 `node_modules`, pnpm store, workspace symlink 및 패키지 빌드 산출물을 삭제하거나 재생성하지 않는다.
- 의존성 변경이 필요하다고 판단되면 먼저 원인, 변경할 파일과 패키지, 예상 영향을 사용자에게 설명하고 승인을 받은 뒤 진행한다.
- 코드 변경 후에는 현재 설치된 의존성을 그대로 사용하여 가장 가까운 패키지의 타입 검사와 테스트부터 하나씩 실행한다. 검증 실패를 의존성 재설치로 자동 해결하지 않는다.
- `Cannot find module`, 타입 정의 누락, workspace 패키지 해석 오류가 발생하면 먼저 `tsconfig`, package export, workspace alias, 빌드 산출물 의존 여부를 읽기 전용으로 조사한다.
- 여러 빌드, 타입 검사, 테스트 또는 패키지 매니저 작업을 동시에 실행하여 시스템 부하를 높이지 않는다.
- `.npmrc`, 환경 변수, 레지스트리 인증 정보 등 비밀값이 포함될 수 있는 파일이나 출력은 불필요하게 읽거나 노출하지 않는다.
