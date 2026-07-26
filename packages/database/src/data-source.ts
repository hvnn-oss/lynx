import { DataSource, type LoggerOptions } from "typeorm";
import { AdminAuditLogEntity } from "./entities/admin/admin-audit-log.entity";
import { AdminUserEntity } from "./entities/admin/admin-user.entity";
import { AgentEntity } from "./entities/agent/agent.entity";
import { OidcAccountEntity } from "./entities/auth/oidc-account.entity";
import { UserAccountEntity } from "./entities/auth/user-account.entity";
import { TrialClaimEntity } from "./entities/auth/trial-claim.entity";
import { EventEntity } from "./entities/event/event.entity";
import { FirewallPolicyEntity } from "./entities/firewall/policy.entity";
import { FirewallPolicyRevisionEntity } from "./entities/firewall/policy-revision.entity";
import { FirewallViolationEntity } from "./entities/firewall/violation.entity";
import { FirewallApprovalRequestEntity } from "./entities/firewall/approval-request.entity";
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
import { AddScopedApiKeyAuthorization1784710800000 } from "./migrations/1784710800000-add-scoped-api-key-authorization";
import { AddEventIngestionIndexes1784797200000 } from "./migrations/1784797200000-add-event-ingestion-indexes";
import { AddOrganizationPlans1784883600000 } from "./migrations/1784883600000-add-organization-plans";
import { AddIssueTracking1784887200000 } from "./migrations/1784887200000-add-issue-tracking";
import { SeparateRunsFromSessions1784973600000 } from "./migrations/1784973600000-separate-runs-from-sessions";
import { AddIssueQueryIndexes1785060000000 } from "./migrations/1785060000000-add-issue-query-indexes";
import { AddProfileImages1785146400000 } from "./migrations/1785146400000-add-profile-images";
import { AddFirewallPolicyManagement1785232800000 } from "./migrations/1785232800000-add-firewall-policy-management";
import { AddFirewallApprovalsAndWebhooks1785319200000 } from "./migrations/1785319200000-add-firewall-approvals-and-webhooks";
import { AddPromptOperations1785405600000 } from "./migrations/1785405600000-add-prompt-operations";
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
    TrialClaimEntity,
    EventEntity,
    FirewallPolicyEntity,
    FirewallPolicyRevisionEntity,
    FirewallViolationEntity,
    FirewallApprovalRequestEntity,
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
    AddScopedApiKeyAuthorization1784710800000,
    AddEventIngestionIndexes1784797200000,
    AddOrganizationPlans1784883600000,
    AddIssueTracking1784887200000,
    SeparateRunsFromSessions1784973600000,
    AddIssueQueryIndexes1785060000000,
    AddProfileImages1785146400000,
    AddFirewallPolicyManagement1785232800000,
    AddFirewallApprovalsAndWebhooks1785319200000,
    AddPromptOperations1785405600000,
  ],
  subscribers: [],
});
