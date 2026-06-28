# Lynx Dashboard

Lynx Dashboard는 AI 에이전트 실행 결과를 확인하고 디버깅하기 위한 Next.js 콘솔입니다.

대시보드는 백엔드의 관측 API를 호출해 세션, 이벤트, 비용, 지연 시간, 정책 이벤트를 보여줍니다. 현재 앱 이름은 `lynx-dashboard`입니다.

## 실행

레포 루트에서 실행합니다.

```bash
pnpm install
pnpm --filter lynx-dashboard dev
```

기본 주소:

```text
http://localhost:3000
```

빌드:

```bash
pnpm --filter lynx-dashboard build
```

## 주요 화면

- 대시보드 홈: 전체 지표, 상태, 비용, 사용량, 인사이트
- 에이전트/세션 관측: 에이전트별 성능과 세션 흐름 확인
- 디버깅 화면: 이벤트 타임라인, 로그, 병목, 루트 원인 분석 흐름
- 설정 화면: 조직/SSO/API 연동 설정

## 백엔드 연동

대시보드는 백엔드 API를 기준으로 동작합니다. 로컬 개발에서는 백엔드를 먼저 실행하세요.

```bash
pnpm --filter backend dev
pnpm --filter lynx-dashboard dev
```

백엔드 기본 주소는 `http://localhost:4000`을 사용합니다. 프록시나 환경 변수 설정은 Next.js 설정과 앱 내부 API 클라이언트 구성을 기준으로 맞춥니다.

## 관련 패키지

- `@repo/dto`: 대시보드 API 응답 타입
- `@repo/ui`: 공통 UI 컴포넌트
- `@repo/constants`: 공통 상수
