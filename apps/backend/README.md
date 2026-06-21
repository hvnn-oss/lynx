# NestJS API Backend (Control Plane & Ingestion Node)

이 서비스는 Lynx 모니터링 플랫폼의 핵심 **컨트롤 플레인(Control Plane)**이자 **배치 텔레메트리 수집 노드**입니다.

TypeScript SDK(`@repo/sdk`)가 메모리 버퍼 큐에서 내보내는 배치 로그 데이터를 수집하고, 실시간 스트림 분석, 서버 사이드 LLM 단가 비용 집계, 요금제별 데이터 보존(Retention) 라이프사이클 관리 및 대시보드 통계용 Observe API 서빙을 전담합니다.

---

## ⚙️ 실행 및 배포 환경 설정 (.env)

프로젝트 루트 또는 `apps/backend/` 아래에 `.env.local` 혹은 `.env` 파일을 복사하여 다음과 같이 환경을 구축합니다:

```env
# ==============================================================================
# APP CONFIGURATION
# ==============================================================================
NODE_ENV=development
PORT=3000
APP_VERSION=1.0.0
BACKEND_URL=http://example.com/
FRONTEND_URL=http://api.example.com/

# ==============================================================================
# JWT CONFIGURATION
# ==============================================================================
# Access Token
JWT_ACCESS_SECRET=your_access_token_secret_very_long_string_123!
JWT_ACCESS_EXPIRES_IN=15m

# Refresh Token
JWT_REFRESH_SECRET=your_refresh_token_secret_another_long_string_456@
JWT_REFRESH_EXPIRES_IN=7d

# ==============================================================================
# POSTGRESQL DATABASE CONFIGURATION (RDBMS)
# ==============================================================================
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password_here
DB_DATABASE=your_database_name
DB_SYNCHRONIZE=true
DB_LOGGING=true

# ==============================================================================
# REDIS CONFIGURATION (Cache & Session)
# ==============================================================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here_if_applicable
REDIS_TTL=3600


# ==============================================================================
# SMTP CONFIGURATION (MAILING)
# ==============================================================================
SMTP_HOST=your-smtp-host.example.com
SMTP_PORT=123
SMTP_USERNAME=your_smtp_username
SMTP_PASSWORD=your_smtp_password_here
SMTP_SECURE=false
SMTP_FROM_EMAIL=noreply@yourdomain.com

# ==============================================================================
# TELEMETRY EVENT RETENTION CONFIGURATION (DAYS)
# ==============================================================================
RETENTION_DAYS_FREE=3
RETENTION_DAYS_PRO=30
RETENTION_DAYS_ENTERPRISE=365
```

### 실행 명령어

```bash
# 의존성 설치 (모노레포 루트에서)
pnpm install

# 백엔드 단독 시작 (개발 핫리로딩 모드)
pnpm --filter backend dev

# 프로덕션 빌드 및 가동
pnpm --filter backend build
pnpm --filter backend start:prod
```
