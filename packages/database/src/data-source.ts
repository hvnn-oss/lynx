import { DataSource, type LoggerOptions } from "typeorm";
import { AdminAuditLogEntity } from "./entities/admin/admin-audit-log.entity";
import { AdminUserEntity } from "./entities/admin/admin-user.entity";
import { AgentEntity } from "./entities/agent/agent.entity";
import { OidcAccountEntity } from "./entities/auth/oidc-account.entity";
import { UserAccountEntity } from "./entities/auth/user-account.entity";
import { TrialClaimEntity } from "./entities/auth/trial-claim.entity";
import { AccessInvitationEntity } from "./entities/auth/access-invitation.entity";
import { ProductAccessGrantEntity } from "./entities/auth/product-access-grant.entity";
import { EventEntity } from "./entities/event/event.entity";
import { FirewallPolicyEntity } from "./entities/firewall/policy.entity";
import { FirewallPolicyRevisionEntity } from "./entities/firewall/policy-revision.entity";
import { FirewallViolationEntity } from "./entities/firewall/violation.entity";
import { FirewallApprovalRequestEntity } from "./entities/firewall/approval-request.entity";
import { WebhookDeliveryEntity } from "./entities/firewall/webhook-delivery.entity";
import { SlackIntegrationEntity } from "./entities/integration/slack-integration.entity";
import { IssueActivityEntity } from "./entities/issues/issue-activity.entity";
import { IssueAssigneeEntity } from "./entities/issues/issue-assignee.entity";
import { IssueOccurrenceEntity } from "./entities/issues/issue-occurrence.entity";
import { IssueEntity } from "./entities/issues/issue.entity";
import { IssueEvaluationEntity } from "./entities/issues/issue-evaluation.entity";
import { IssueRecordProcessingEntity } from "./entities/issues/issue-record-processing.entity";
import { IssueRecordEntity } from "./entities/issues/issue-record.entity";
import { FilterPolicyEntity } from "./entities/organization/filter-policy.entity";
import { OrganizationDomainEntity } from "./entities/organization/domain.entity";
import { OrganizationUserEntity } from "./entities/organization/organization-user.entity";
import { OrganizationEntity } from "./entities/organization/organization.entity";
import { OrganizationPlanEntity } from "./entities/organization/organization-plan.entity";
import { OrganizationCreationEventEntity } from "./entities/organization/organization-creation-event.entity";
import { UserEntitlementEntity } from "./entities/organization/user-entitlement.entity";
import { UserEntity } from "./entities/organization/user.entity";
import { WorkspaceEntity } from "./entities/organization/workspace.entity";
import { PromptBlockEntity } from "./entities/prompt/prompt-block.entity";
import { PromptVersionEntity } from "./entities/prompt/prompt-version.entity";
import { PromptEntity } from "./entities/prompt/prompt.entity";
import { PromptDeploymentEntity } from "./entities/prompt/prompt-deployment.entity";
import { PromptExperimentEntity } from "./entities/prompt/prompt-experiment.entity";
import { SessionEntity } from "./entities/session/session.entity";
import { RunEntity } from "./entities/run/run.entity";
import { WorkspaceApiKeyEntity } from "./entities/workspace/workspace-api-key.entity";
import { WorkspaceMembershipEntity } from "./entities/workspace/workspace-membership.entity";
import { OpenApiApiKeyUsageHourlyEntity } from "./entities/workspace/openapi-api-key-usage-hourly.entity";
import { InitialSchema1785054963677 } from "./migrations/1785054963677-initial-schema";
import { AddOpenApiApiKeyUsage1785312000000 } from "./migrations/1785312000000-add-openapi-api-key-usage";
import { AddAccessInvitationOrganizationPlan1785398400000 } from "./migrations/1785398400000-add-access-invitation-organization-plan";
import { loadDatabaseEnv } from "./load-env";
import { normalizeCertificateBundle } from "./certificate";

loadDatabaseEnv();

const dbUrl = process.env.DATABASE_URL;
const databaseHost = process.env.DATABASE_HOST ?? process.env.DB_HOST;
const databasePort = process.env.DATABASE_PORT ?? process.env.DB_PORT;
const databaseUsername =
  process.env.DATABASE_USERNAME ?? process.env.DB_USERNAME;
const databasePassword =
  process.env.DATABASE_PASSWORD ?? process.env.DB_PASSWORD;
const databaseName = process.env.DATABASE_NAME ?? process.env.DB_DATABASE;
const isDatabaseSslEnabled = parseBooleanEnv(
  process.env.DATABASE_SSL ?? process.env.DB_SSL,
  false,
);
const shouldRejectUnauthorizedDatabaseCertificate = parseBooleanEnv(
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ??
    process.env.DB_SSL_REJECT_UNAUTHORIZED,
  true,
);
const databaseSslCa =
  process.env.DATABASE_SSL_CA ?? process.env.DB_SSL_CA;

/**
 * 환경 변수의 boolean 값을 일관된 규칙으로 변환합니다.
 */
function parseBooleanEnv(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalizedValue)) {
    return false;
  }

  return defaultValue;
}

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
  host: !dbUrl ? databaseHost : undefined,
  port: !dbUrl ? Number(databasePort ?? 5432) : undefined,
  username: !dbUrl ? databaseUsername : undefined,
  password: !dbUrl ? databasePassword : undefined,
  database: !dbUrl ? databaseName : undefined,
  // 운영 안정성을 위해 마이그레이션으로만 스키마를 변경합니다.
  synchronize: false,
  logging: parseTypeOrmLogging(
    process.env.DATABASE_LOGGING ?? process.env.DB_LOGGING,
  ),
  ssl: isDatabaseSslEnabled
    ? {
        rejectUnauthorized: shouldRejectUnauthorizedDatabaseCertificate,
        ...(databaseSslCa
          ? { ca: normalizeCertificateBundle(databaseSslCa) }
          : {}),
      }
    : false,
  entities: [
    AdminAuditLogEntity,
    AdminUserEntity,
    AgentEntity,
    OidcAccountEntity,
    UserAccountEntity,
    TrialClaimEntity,
    AccessInvitationEntity,
    ProductAccessGrantEntity,
    EventEntity,
    FirewallPolicyEntity,
    FirewallPolicyRevisionEntity,
    FirewallViolationEntity,
    FirewallApprovalRequestEntity,
    WebhookDeliveryEntity,
    SlackIntegrationEntity,
    IssueActivityEntity,
    IssueAssigneeEntity,
    IssueOccurrenceEntity,
    IssueEntity,
    IssueEvaluationEntity,
    IssueRecordProcessingEntity,
    IssueRecordEntity,
    OrganizationDomainEntity,
    OrganizationUserEntity,
    OrganizationEntity,
    OrganizationPlanEntity,
    OrganizationCreationEventEntity,
    UserEntitlementEntity,
    UserEntity,
    WorkspaceEntity,
    WorkspaceApiKeyEntity,
    WorkspaceMembershipEntity,
    OpenApiApiKeyUsageHourlyEntity,
    PromptBlockEntity,
    PromptVersionEntity,
    PromptEntity,
    PromptDeploymentEntity,
    PromptExperimentEntity,
    SessionEntity,
    RunEntity,
    FilterPolicyEntity,
  ],
  migrations: [
    InitialSchema1785054963677,
    AddOpenApiApiKeyUsage1785312000000,
    AddAccessInvitationOrganizationPlan1785398400000,
  ],
  subscribers: [],
});
