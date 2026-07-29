# 파일럿 운영 준비 런북

이 문서는 배포 자동화와 별개로, Lynx 파일럿 환경이 데이터 유실·비밀값 노출·Worker
정지 상태를 감지하고 복구할 수 있는지 확인하는 운영 기준입니다.

## 1. ECS 애플리케이션 인증

### S3 이미지 저장소

- ECS Task Definition의 `taskRoleArn`에 애플리케이션 전용 Role을 지정합니다.
- 운영 환경에는 `IMAGE_S3_ACCESS_KEY_ID`, `IMAGE_S3_SECRET_ACCESS_KEY`를 넣지 않습니다.
- ECS가 주입하는 `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI`를 Lynx가 자동으로 사용합니다.
- Task execution role과 애플리케이션 Task Role을 분리합니다.

Task Role에는 프로필 이미지 경로만 허용합니다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::REPLACE_BUCKET/profile-images/*"
    }
  ]
}
```

CloudFront Origin Access Control 권한은 CloudFront용 Bucket Policy에 따로 둡니다. API
Task Role에 `s3:*`, Bucket 전체 삭제, ACL 변경 권한을 주지 않습니다.

참고: [Amazon ECS Task IAM Role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html),
[Container credential provider](https://docs.aws.amazon.com/sdkref/latest/guide/feature-container-credentials.html)

### ElastiCache

Serverless Valkey는 RBAC가 필수입니다. 다음 값을 Secrets Manager에서 ECS secret으로
주입합니다.

```text
CORE_REDIS_HOST=<serverless endpoint>
CORE_REDIS_PORT=6379
CORE_REDIS_USERNAME=<RBAC user name>
CORE_REDIS_PASSWORD=<RBAC password>
CORE_REDIS_TLS=true
```

사용자 access string은 Lynx가 사용하는 key prefix와 명령으로 제한합니다. 초기
파일럿에서 세밀한 key pattern을 적용하기 어렵다면 최소한 별도 User Group과 별도
사용자를 사용합니다.

참고: [ElastiCache RBAC](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Clusters.RBAC.html)

## 2. 운영 비밀값 시작 전 검증

`NODE_ENV=production`에서는 다음 조건이 하나라도 맞지 않으면 서버가 시작되지 않습니다.

- PostgreSQL과 Redis TLS 활성화
- DB·Redis·JWT·SMTP·Webhook 비밀값에서 로컬 placeholder 제거
- `FRONTEND_URL`, `IMAGE_CDN_BASE_URL` HTTPS 사용
- TypeORM synchronize 비활성화
- AWS 기본 S3에서 정적 액세스 키 제거
- 사용자 지정 S3 endpoint는 access key와 secret key를 쌍으로 제공
- 사설 네트워크 Custom Webhook 비활성화

비밀값은 ECS Task Definition의 평문 `environment`가 아니라 Secrets Manager를 참조하는
`secrets`에 둡니다.

## 3. RDS 백업과 PITR

파일럿 기본 기준:

- 자동 백업 보존: 최소 7일, 권장 14일
- storage encryption 활성화
- deletion protection 활성화
- 운영 변경 전 수동 snapshot 생성
- 삭제 시 final snapshot 생성과 automated backup 유지
- 백업 window와 maintenance window가 겹치지 않도록 설정

`BackupRetentionPeriod=0`은 자동 백업과 PITR을 끄므로 허용하지 않습니다. RDS 자동
백업은 보존 기간 안의 시점으로 복원할 수 있습니다.

참고: [RDS 자동 백업](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html),
[백업 보존 기간](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.BackupRetention.html)

### 배포 전 확인

```bash
aws rds describe-db-instances \
  --db-instance-identifier "$LYNX_RDS_INSTANCE_ID" \
  --query "DBInstances[0].{Status:DBInstanceStatus,Retention:BackupRetentionPeriod,Encrypted:StorageEncrypted,DeletionProtection:DeletionProtection,LatestRestorableTime:LatestRestorableTime}"
```

합격 조건:

- `Status=available`
- `Retention >= 7`
- `Encrypted=true`
- `DeletionProtection=true`
- `LatestRestorableTime`이 현재 시각에서 정상적으로 갱신됨

### 복원 드릴

매월 또는 주요 스키마 변경 전에 전용 복원 인스턴스로 PITR을 수행합니다.

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier "$LYNX_RDS_INSTANCE_ID" \
  --target-db-instance-identifier "$LYNX_RDS_RESTORE_ID" \
  --use-latest-restorable-time \
  --db-subnet-group-name "$LYNX_RDS_SUBNET_GROUP" \
  --vpc-security-group-ids "$LYNX_RDS_RESTORE_SECURITY_GROUP"
```

복원 인스턴스는 외부와 운영 ECS에서 접근하지 못하는 별도 Security Group을 사용합니다.
복원 후 다음을 확인합니다.

1. migration table과 최신 migration 상태
2. Organization, Workspace, Session, Event, Issue의 표본 row 수
3. 무작위 Session 하나의 Run·Event 관계
4. 최근 API Key 사용 집계와 감사 기록
5. 검증 완료 후 복원 인스턴스 삭제

합격 기준은 `RPO <= 5분`, 파일럿 목표 `RTO <= 60분`입니다. 실제 시작·복원·검증·삭제
시각을 감사 티켓에 기록합니다.

## 4. CloudWatch 운영 알림

백엔드는 JSON 구조화 로그의 `event` 필드를 제공합니다. CloudWatch Logs metric filter
또는 Log Alarm에서 다음 이벤트를 감시합니다.

| 대상                | 로그 조건                                     | 권장 초기 경보  |
| ------------------- | --------------------------------------------- | --------------- |
| API 5xx             | `http.request.completed`, `statusCode >= 500` | 5분간 5건 이상  |
| 처리되지 않은 예외  | `http.request.unhandled_error`                | 5분간 1건 이상  |
| readiness 실패      | `system.readiness.unavailable`                | 2회 연속        |
| Worker 상태         | `operational.health.degraded`                 | 2회 연속        |
| 상태 점검 자체 실패 | `operational.health.check_failed`             | 1회             |
| Webhook 영구 실패   | `webhook.delivery.failed`                     | 10분간 5건 이상 |
| Webhook Worker 실패 | `webhook.worker.failed`                       | 1회             |
| 보존 Worker 실패    | `data_retention.worker.failed`                | 1회             |
| Issue Worker 실패   | `issue_record.worker.failed`                  | 1회             |

`operational.health.degraded`에는 다음 경고 코드와 실제 집계가 포함됩니다.

- `WORKER_HEARTBEAT_MISSING`
- `ISSUE_RECORD_BACKLOG_HIGH`
- `ISSUE_RECORD_STALE`
- `WEBHOOK_FAILURES_HIGH`
- `WEBHOOK_DELIVERY_STALE`
- `OPENAPI_EVENT_REJECTION_HIGH`
- `OPENAPI_SERVER_ERRORS_HIGH`

Threshold는 다음 환경 변수로 조정합니다.

```text
OPERATIONAL_HEALTH_POLL_INTERVAL_MS=60000
WORKER_HEARTBEAT_REQUIRED=true
ISSUE_RECORD_BACKLOG_WARN_COUNT=100
ISSUE_RECORD_STALE_WARN_COUNT=1
WEBHOOK_FAILED_WARN_COUNT=5
OPENAPI_REJECTION_WARN_MIN_EVENTS=20
OPENAPI_REJECTION_WARN_PERCENT=10
OPENAPI_SERVER_ERROR_WARN_COUNT=5
```

참고: [CloudWatch Logs metric filter](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/MonitoringLogData.html),
[CloudWatch Log Alarm](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarm-log.html)

## 5. 데이터 보존

Worker가 다음 데이터를 작은 배치로 삭제합니다.

- Session과 연결된 Run·Event: 조직 Plan의 `retentionDays`
- Issue Record: 조직 Plan의 `retentionDays`
- Admin 감사 기록: `AUDIT_LOG_RETENTION_DAYS`, 기본 365일
- OpenAPI 시간별 사용량: `OPENAPI_USAGE_RETENTION_DAYS`, 기본 400일
- 완료된 Webhook delivery: `FIREWALL_WEBHOOK_RETENTION_DAYS`, 기본 30일

보존 Worker를 운영에서 끄지 않습니다.

```text
DATA_RETENTION_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=365
OPENAPI_USAGE_RETENTION_DAYS=400
FIREWALL_WEBHOOK_RETENTION_DAYS=30
```

사용자에게 안내하는 보존 기간과 실제 Plan·환경 변수 값이 일치해야 합니다.

## 6. 파일럿 E2E와 UI smoke

테스트는 전용 DB·Redis·SMTP 수신함을 사용하는 실행 중인 환경에서만 켭니다. 운영
환경이나 공유 개발 DB에 실행하지 않습니다.

```text
LYNX_E2E_ENABLED=true
LYNX_E2E_BASE_URL=http://127.0.0.1:8000
LYNX_E2E_MAILBOX_URL=http://127.0.0.1:8025
LYNX_E2E_BOOTSTRAP_ADMIN_EMAIL=pilot-admin@localhost.test
LYNX_E2E_PASSWORD=PilotPass123!
```

```bash
node --test apps/hono-backend/test/*.e2e.mjs
```

검증 범위:

```text
Bootstrap Admin → 파일럿 초대 → 이메일 확인 → 회원가입 → 로그인
→ 조직/워크스페이스 → API Key → Event/Issue Record
→ Worker 결정 → Issue/Dashboard 조회 → 테넌트 간 접근 차단
```

Admin과 acme-ai 컨테이너를 실행한 뒤 UI smoke도 실행합니다.

```text
LYNX_UI_SMOKE_ENABLED=true
LYNX_ADMIN_SMOKE_URL=http://127.0.0.1:3001
ACME_AI_SMOKE_URL=http://127.0.0.1:3200
```

```bash
node --test apps/lynx-admin/test/*.test.mjs
node --test apps/acme-ai/test/*.test.mjs
```
