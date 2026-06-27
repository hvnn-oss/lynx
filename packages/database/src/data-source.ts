import { DataSource } from "typeorm";
import { UserEntity } from "./entities/organization/user.entity";
import { AgentEntity } from "./entities/agent/agent.entity";
import { OidcAccountEntity } from "./entities/auth/oidc-account.entity";
import { UserAccountEntity } from "./entities/auth/user-account.entity";
import { EventEntity } from "./entities/event/event.entity";
import { GuardrailPolicyEntity } from "./entities/guardrail/policy.entity";
import { GuardrailViolationEntity } from "./entities/guardrail/violation.entity";
import { OrganizationEntity } from "./entities/organization/organization.entity";
import { WorkspaceEntity } from "./entities/organization/workspace.entity";
import { PromptBlockEntity } from "./entities/prompt/prompt-block.entity";
import { PromptVersionEntity } from "./entities/prompt/prompt-version.entity";
import { PromptEntity } from "./entities/prompt/prompt.entity";
import { SessionEntity } from "./entities/session/session.entity";
import { OrganizationUserEntity } from "./entities/organization/organization-user.entity";
import { OrganizationDomainEntity } from "./entities/organization/domain.entity";
import { FilterPolicyEntity } from "./entities/organization/filter-policy.entity";


export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: false, // 안정성을 위해 false 권장 (마이그레이션 필수)
  logging: process.env.NODE_ENV !== "production",
  entities: [
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
    PromptBlockEntity,
    PromptVersionEntity,
    PromptEntity,
    SessionEntity,
    FilterPolicyEntity,
  ],
  migrations: [__dirname + "/migrations/*.ts"],
  subscribers: [],
});
