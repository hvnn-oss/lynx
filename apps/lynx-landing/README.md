# Lynx Landing

Lynx Landing은 제품 소개와 개발자 온보딩을 위한 Next.js 앱입니다.

주요 목적:

- Lynx가 해결하는 문제를 설명합니다.
- SDK 설치와 기본 사용 흐름을 보여줍니다.
- 대시보드와 회원가입 진입점을 제공합니다.

## 실행

레포 루트에서 실행합니다.

```bash
pnpm install
pnpm --filter lynx-landing dev
```

기본 주소:

```text
http://localhost:3001
```

빌드:

```bash
pnpm --filter lynx-landing build
```

## SDK 예시 기준

랜딩 페이지에서 SDK 예시를 보여줄 때는 현재 API를 기준으로 작성합니다.

```ts
const lynx = new LynxTracer({
  clientId: "support-api",
  endpoint: "https://lynx.example.com",
  apiKey: process.env.LYNX_API_KEY,
});
```

문서와 예시는 현재 SDK API인 `endpoint`, `delivery`, `circuitBreaker` 구조를 기준으로 작성합니다.

## 관련 패키지

- `@repo/ui`: 공통 UI 컴포넌트
- `@repo/tailwind-config`: 공통 Tailwind 설정
- `@repo/typescript-config`: 공통 TypeScript 설정
