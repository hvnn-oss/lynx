import { DataSource, type LoggerOptions } from "typeorm";
import { AdminAuditLogEntity } from "./entities/admin/admin-audit-log.entity";
import { AdminUserEntity } from "./entities/admin/admin-user.entity";
import { AgentEntity } from "./entities/agent/agent.entity";
import { OidcAccountEntity } from "./entities/auth/oidc-account.entity";
import { UserAccountEntity } from "./entities/auth/user-account.entity";
import { EventEntity } from "./entities/event/event.entity";
import { GuardrailPolicyEntity } from "./entities/guardrail/policy.entity";
import { GuardrailViolationEntity } from "./entities/guardrail/violation.entity";
import { FilterPolicyEntity } from "./entities/organization/filter-policy.entity";
import { OrganizationDomainEntity } from "./entities/organization/domain.entity";
import { OrganizationUserEntity } from "./entities/organization/organization-user.entity";
import { OrganizationEntity } from "./entities/organization/organization.entity";
import { UserEntity } from "./entities/organization/user.entity";
import { WorkspaceEntity } from "./entities/organization/workspace.entity";
import { PromptBlockEntity } from "./entities/prompt/prompt-block.entity";
import { PromptVersionEntity } from "./entities/prompt/prompt-version.entity";
import { PromptEntity } from "./entities/prompt/prompt.entity";
import { SessionEntity } from "./entities/session/session.entity";
import { WorkspaceApiKeyEntity } from "./entities/workspace/workspace-api-key.entity";
import { WorkspacePlanEntity } from "./entities/workspace/workspace-plan.entity";
import { loadDatabaseEnv } from "./load-env";

loadDatabaseEnv();

const dbUrl = process.env.DATABASE_URL;

function parseTypeOrmLogging(value: string | undefined): LoggerOptions {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (
    !normalizedValue ||
    ["false", "0", "off", "none"].includes(normalizedValue)
  ) {
    return false;
  }

  if (["true", "1", "on"].includes(normalizedValue)) {
    return ["error", "warn", "schema"];
  }

  if (normalizedValue === "all") {
    return true;
  }

  const allowedValues = new Set([
    "query",
    "error",
    "schema",
    "warn",
    "info",
    "log",
    "migration",
  ]);
  const selectedValues = normalizedValue
    .split(",")
    .map((item) => item.trim())
    .filter((item) => allowedValues.has(item));

  return selectedValues.length > 0 ? (selectedValues as LoggerOptions) : false;
}

export const AppDataSource = new DataSource({
  type: "postgres",
  url: dbUrl,
  host: !dbUrl ? process.env.DB_HOST : undefined,
  port: !dbUrl ? Number(process.env.DB_PORT ?? 5432) : undefined,
  username: !dbUrl ? process.env.DB_USERNAME : undefined,
  password: !dbUrl ? process.env.DB_PASSWORD : undefined,
  database: !dbUrl ? process.env.DB_DATABASE : undefined,
  // 운영 안정성을 위해 마이그레이션으로만 스키마를 변경합니다.
  synchronize: false,
  logging: parseTypeOrmLogging(process.env.DB_LOGGING),
  entities: [
    AdminAuditLogEntity,
    AdminUserEntity,
    AgentEntity,
    OidcAccountEntity,
    UserAccountEntity,
    EventEntity,
    GuardrailPolicyEntity,
    GuardrailViolationEntity,
    OrganizationDomainEntity,
    OrganizationUserEntity,
    OrganizationEntity,
    UserEntity,
    WorkspaceEntity,
    WorkspaceApiKeyEntity,
    WorkspacePlanEntity,
    PromptBlockEntity,
    PromptVersionEntity,
    PromptEntity,
    SessionEntity,
    FilterPolicyEntity,
  ],
  migrations: [__dirname + "/migrations/*.ts"],
  subscribers: [],
});
