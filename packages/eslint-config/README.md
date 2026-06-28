# @repo/eslint-config

Lynx 모노레포에서 공유하는 ESLint 설정 패키지입니다.

앱과 패키지는 이 설정을 기반으로 lint 규칙을 맞춥니다.

## 사용 위치

- `apps/backend`
- `apps/lynx-dashboard`
- `apps/lynx-landing`
- 공통 패키지들

## 실행

레포 루트에서 전체 lint를 실행합니다.

```bash
pnpm lint
```

개별 앱이나 패키지만 확인하려면:

```bash
pnpm --filter lynx-dashboard lint
pnpm --filter backend lint
```
