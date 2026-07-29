# Lynx database

TypeORM 엔티티와 PostgreSQL 마이그레이션을 관리합니다. 마이그레이션 명령은
컴파일된 `dist/data-source.js`를 사용하므로 먼저 데이터베이스 패키지를
빌드해야 합니다.

```bash
pnpm --filter @repo/database build
pnpm migration:run
```

개발 DB를 완전히 초기화하려면 다음 명령을 사용합니다. 이 명령은 현재
연결된 데이터베이스의 모든 테이블과 데이터를 삭제하고 초기 스키마와
조직 요금제 시드를 다시 적용합니다.

```bash
pnpm --filter @repo/database build
pnpm db:reset
```

운영 배포에서는 애플리케이션 시작과 마이그레이션을 분리합니다. 새 서버
버전을 시작하기 전에 빌드된 데이터베이스 패키지로 `pnpm migration:run`을
한 번 실행합니다.
