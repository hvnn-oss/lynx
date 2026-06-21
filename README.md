# Lynx: Enterprise-Grade LLM & AI Agent Observability Platform

**Lynx**는 대규모 상용 서비스 환경에서 LLM 및 AI 에이전트의 작동 흐름을 디버깅하고 성능 지표를 분석하는 **엔터프라이즈 모니터링/텔레메트리 플랫폼**입니다. 

단순히 "무슨 일이 일어났는가"에 대한 데이터 로깅을 넘어, W3C 분산 추적 규격을 기반으로 여러 LLM과 도구들이 얽혀 돌아가는 복잡한 에이전트의 흐름을 분석하고 **"왜 문제가 일어났는가" (Root Cause Analysis - RCA)**에 대한 명확한 해답을 개발자에게 보여줍니다.

---

## 🏗️ 모노레포 구조 및 에코시스템

이 프로젝트는 **Turborepo** 및 **pnpm workspaces**를 활용해 전체 시스템을 단일 레포지토리로 안전하게 통합 관리합니다.

```bash
lynx/
├── apps/
│   ├── sdk/                 # @repo/sdk: 클라이언트용 텔레메트리 전송 라이브러리
│   ├── backend/             # backend: NestJS 기반 수집 제어반(Control Plane) API 서버
│   ├── lynx-dashboard/      # lynx-dashboard: 통계, 스팬 트리, 위협 탐지 분석용 개발자 대시보드 (Next.js)
│   └── lynx-landing/        # lynx-landing: 제품 가이드 및 회원 가입 온보딩 랜딩 페이지 (Next.js)
└── packages/
    ├── sdk-types/           # SDK 및 백엔드 간 통신을 위한 규격/DTO 통합 인터페이스
    ├── database/            # PostgreSQL, Redis 연동을 위한 TypeORM 공용 엔티티 및 스키마
    ├── dto/                 # 백엔드 API 유효성 검증용 데이터 전송 객체
    ├── eslint-config/       # 프로젝트 공통 린트 룰셋
    └── typescript-config/   # 프로젝트 공통 TypeScript 컴파일 설정
```

---

## ⚡ 핵심 제품 가치 및 해결 영역

1. **에이전트 트래픽 백프레셔 완화**
   * 에이전트의 폭발적인 도구/LLM 호출 트래픽이 모니터링 서버를 마비시키는 DDoS 현상을 막고자, SDK 단에 **메모리 버퍼 배치 큐**를 장착하고 백엔드에 **벌크 삽입 API**를 도입해 가용성을 보장합니다.
2. **500 에러 및 유실 극복**
   * 임시 서버 장애 발생 시 데이터를 손실 없이 복구하기 위해 SDK에 **exponential backoff retry** 및 **오프라인 디스크/메모리 버퍼** 레이어를 두었습니다.
3. **Tail-Based Adaptive Sampling**
   * 정상 호출은 비용 절감을 위해 1% 내외로 필터링 수집하고, **에러가 감지되거나 비정상 상황이 감지되는 즉시 해당 세션의 전체 트랜잭션을 100% 강제 추적**하여 디버깅 효율을 극대화합니다.
4. **로컬 PII 마스킹 (GDPR/ISMS 대비)**
   * 개인정보(주민번호, 전화번호, 이메일) 및 시스템 자격증명(Bearer, API Key, JWT) 정보가 네트워크 경계를 넘기 전, SDK 단에서 자체적으로 안전하게 가리는 마스킹 레이어를 제공합니다.
5. **서버 측 일관된 비용 집계**
   * LLM 요금 정책은 수시로 바뀝니다. 단가 계산을 클라이언트 SDK에서 처리하는 오버헤드를 막고, 수집 서버 측에서 집중 연산하여 일치성을 보장합니다.

---

## 🚀 로컬 빌드 및 구동 가이드

### 1. 사전 요구사항
* Node.js >= 18
* pnpm 설치
* PostgreSQL 데이터베이스 및 Redis 기동

### 2. 의존성 설치 및 빌드
```bash
# 전체 의존성 설치
pnpm install

# 전체 패키지 컴파일 및 빌드
pnpm build
```

### 3. 개발 서버 시작 (일괄 가동)
```bash
pnpm dev
```
* 로컬 개발 서버 기동 시 다음 서비스들이 동시 핫리로딩 모드로 실행됩니다:
  * 백엔드 API 서버: `http://localhost:4000`
  * 개발자 랜딩 페이지: `http://localhost:3000`
  * 메인 통계 대시보드: `http://localhost:3001` (백엔드 프록시 연동)

### 4. 테스트 코드 및 린트 실행
```bash
# 52개의 컨트롤러 및 서비스 모의 테스트 일괄 수행
pnpm test

# 모노레포 린터 검증
pnpm lint
```
