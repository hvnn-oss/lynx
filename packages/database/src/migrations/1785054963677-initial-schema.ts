import { MigrationInterface, QueryRunner } from "typeorm";

/** 현재 Lynx 엔티티와 운영 조회용 인덱스를 빈 PostgreSQL에 생성합니다. */
export class InitialSchema1785054963677 implements MigrationInterface {
  name = "InitialSchema1785054963677";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
            CREATE TABLE "admin_audit_log" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "actorUserId" character varying NOT NULL,
                "action" character varying NOT NULL,
                "targetType" character varying NOT NULL,
                "targetId" character varying NOT NULL,
                "before" jsonb,
                "after" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_9425be48a9c753f5753017c61b2" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "oidc-account" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "issuer" character varying NOT NULL,
                "subject" character varying NOT NULL,
                "accessToken" character varying,
                "refreshToken" character varying,
                "userAccountId" uuid,
                CONSTRAINT "REL_8b391bb81c014f8bdc1056569a" UNIQUE ("userAccountId"),
                CONSTRAINT "PK_d40dc832c4f7be7330268d0fc33" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_1107ab83efb02359d7cdb76329" ON "oidc-account" ("subject", "issuer")
        `);
    await queryRunner.query(`
            CREATE TABLE "user-account" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "provider" character varying NOT NULL DEFAULT 'LOCAL',
                "providerAccountId" character varying,
                "passwordHash" character varying,
                "userId" uuid,
                CONSTRAINT "PK_14441608653111b8292415469fe" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "run" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "sessionId" uuid NOT NULL,
                "agentId" uuid NOT NULL,
                "clientId" character varying(120) NOT NULL,
                "clientRunId" character varying(255) NOT NULL,
                "status" character varying(30) NOT NULL DEFAULT 'RUNNING',
                "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "endedAt" TIMESTAMP WITH TIME ZONE,
                "totalPromptTokens" integer NOT NULL DEFAULT '0',
                "totalCompletionTokens" integer NOT NULL DEFAULT '0',
                "totalTokens" integer NOT NULL DEFAULT '0',
                "totalCost" numeric(16, 6) NOT NULL DEFAULT '0',
                CONSTRAINT "PK_804c38ffba92002c6d2c646dd46" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_run_workspace_started" ON "run" ("workspaceId", "startedAt", "id")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_run_workspace_client_run" ON "run" ("workspaceId", "clientId", "clientRunId")
        `);
    await queryRunner.query(`
            CREATE TABLE "event" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "eventType" character varying(50) NOT NULL,
                "label" character varying(255) NOT NULL,
                "clientId" character varying(120),
                "clientEventId" character varying(120),
                "schemaVersion" character varying(40),
                "payload" jsonb,
                "latency" integer,
                "cost" numeric(10, 6),
                "timestamp" TIMESTAMP NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "sessionId" uuid,
                "runId" uuid,
                CONSTRAINT "PK_30c2f3bbaf6d34a55f8ae6e4614" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "prompt-block" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "type" character varying NOT NULL DEFAULT 'SYSTEM',
                "content" character varying NOT NULL,
                "promptId" uuid,
                CONSTRAINT "PK_0773d77f097b756e963b3e795ae" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "prompt-version" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "version" character varying NOT NULL DEFAULT '0.0',
                "content" text NOT NULL,
                "createdBy" integer,
                "createdAt" TIMESTAMP NOT NULL,
                "promptId" uuid,
                "contentHash" character(64),
                "baseVersionId" uuid,
                "changeReason" text,
                "createdByUserId" uuid,
                "draftRevision" integer,
                "workspaceId" uuid,
                CONSTRAINT "PK_2c7c0023dae383600df5e94fcb1" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "prompt_deployment" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "promptId" uuid NOT NULL,
                "versionId" uuid NOT NULL,
                "environment" character varying(30) NOT NULL,
                "agentId" uuid,
                "active" boolean NOT NULL DEFAULT true,
                "supersedesDeploymentId" uuid,
                "reason" text,
                "deployedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deployedByUserId" uuid,
                "supersededAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_5b42ad379cd43f85954e771f36b" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_prompt_deployment_workspace_created"
            ON "prompt_deployment" ("workspaceId", "deployedAt" DESC, "id" DESC)
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_prompt_deployment_scope_active" ON "prompt_deployment" (
                "workspaceId",
                "promptId",
                "environment",
                "agentId",
                "active"
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "prompt_experiment" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "promptId" uuid NOT NULL,
                "name" character varying(120) NOT NULL,
                "environment" character varying(30) NOT NULL,
                "agentId" uuid,
                "variants" jsonb NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'DRAFT',
                "assignmentSalt" character varying(64) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "createdByUserId" uuid NOT NULL,
                "startedAt" TIMESTAMP WITH TIME ZONE,
                "endedAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_2eb2bc4dea90c6b9322306f09ed" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_prompt_experiment_workspace_created"
            ON "prompt_experiment" ("workspaceId", "createdAt" DESC, "id" DESC)
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_prompt_experiment_scope_status" ON "prompt_experiment" (
                "workspaceId",
                "promptId",
                "environment",
                "agentId",
                "status"
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "prompt" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "description" text NOT NULL,
                "currentVersion" character varying NOT NULL,
                "createdAt" TIMESTAMP NOT NULL,
                "updatedAt" TIMESTAMP NOT NULL,
                "workspaceId" uuid,
                "draftContent" text,
                "draftRevision" integer NOT NULL DEFAULT '1',
                "draftUpdatedByUserId" uuid,
                "deletedAt" TIMESTAMP WITH TIME ZONE,
                "versionId" uuid,
                CONSTRAINT "PK_d8e3aa07a95560a445ad50fb931" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_prompt_workspace_updated"
            ON "prompt" ("workspaceId", "updatedAt" DESC, "id" DESC)
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_prompt_version_prompt_created"
            ON "prompt-version" ("promptId", "createdAt" DESC, "id" DESC)
        `);
    await queryRunner.query(`
            CREATE TABLE "session" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "clientId" character varying(120),
                "clientSessionId" character varying(255),
                "status" character varying(30) NOT NULL DEFAULT 'RUNNING',
                "startedAt" TIMESTAMP NOT NULL,
                "endedAt" TIMESTAMP,
                "totalPromptTokens" integer NOT NULL,
                "totalCompletionTokens" integer NOT NULL,
                "totalTokens" integer NOT NULL,
                "totalCost" integer NOT NULL,
                "workspaceId" uuid,
                "agentId" uuid,
                "usedPromptId" uuid,
                CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "firewall_policy_revision" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "policyId" bigint NOT NULL,
                "revision" integer NOT NULL,
                "version" character varying(40) NOT NULL,
                "name" character varying(120) NOT NULL,
                "description" text,
                "condition" text NOT NULL,
                "severity" character varying NOT NULL DEFAULT 'MEDIUM',
                "action" character varying NOT NULL DEFAULT 'WARN',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deployedAt" TIMESTAMP WITH TIME ZONE,
                "webhookUrl" character varying(2048),
                "environments" text array NOT NULL DEFAULT '{}',
                "agentIds" uuid array NOT NULL DEFAULT '{}',
                CONSTRAINT "PK_bbc62f73248046505b62206e695" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_firewall_policy_revision" ON "firewall_policy_revision" ("policyId", "revision")
        `);
    await queryRunner.query(`
            CREATE TABLE "firewall-policy" (
                "id" BIGSERIAL NOT NULL,
                "name" character varying NOT NULL,
                "description" character varying,
                "condition" character varying NOT NULL,
                "severity" character varying NOT NULL DEFAULT 'MEDIUM',
                "action" character varying NOT NULL DEFAULT 'WARN',
                "version" character varying NOT NULL DEFAULT '0.0',
                "createdAt" TIMESTAMP NOT NULL,
                "updatedAt" TIMESTAMP NOT NULL,
                "activated" boolean NOT NULL DEFAULT false,
                "draftRevision" integer NOT NULL DEFAULT '1',
                "deployedRevision" integer,
                "deletedAt" TIMESTAMP WITH TIME ZONE,
                "webhookUrl" character varying(2048),
                "environments" text array NOT NULL DEFAULT '{}',
                "agentIds" uuid array NOT NULL DEFAULT '{}',
                "workspaceId" uuid,
                CONSTRAINT "PK_d5a427b055117e047ee28aef3c9" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "firewall-violation" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "action" character varying NOT NULL,
                "createdAt" TIMESTAMP NOT NULL,
                "workspaceId" uuid NOT NULL,
                "eventId" uuid,
                "reportedPolicyId" character varying(255),
                "toolName" character varying(255),
                "severity" character varying(20),
                "message" text,
                "evidence" jsonb,
                "reasonId" bigint,
                "sessionId" uuid,
                "agentId" uuid,
                CONSTRAINT "PK_c263f934e4dbad6d846635a53e5" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_firewall_violation_event" ON "firewall-violation" ("eventId")
            WHERE "eventId" IS NOT NULL
        `);
    await queryRunner.query(`
            CREATE TABLE "agent" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "clientAgentId" character varying(255),
                "description" character varying,
                "defaultModel" character varying NOT NULL,
                "workspaceId" uuid,
                CONSTRAINT "PK_1000e989398c5d4ed585cf9a46f" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "workspace_api_key" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "prefix" character varying(24) NOT NULL,
                "keyHash" character varying(64) NOT NULL,
                "name" character varying(120) NOT NULL,
                "kind" character varying(20) NOT NULL DEFAULT 'INGEST',
                "createdByUserId" uuid,
                "createdByName" character varying(120),
                "scopes" text array NOT NULL DEFAULT '{events:write}',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "lastUsedAt" TIMESTAMP,
                "revokedAt" TIMESTAMP,
                "expiresAt" TIMESTAMP,
                CONSTRAINT "CHK_workspace_api_key_kind" CHECK ("kind" IN ('INGEST', 'SDK', 'AUTOMATION')),
                CONSTRAINT "PK_d99202870de696c23016aa9d062" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_workspace_api_key_workspace_active" ON "workspace_api_key" ("workspaceId", "revokedAt")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_workspace_api_key_hash" ON "workspace_api_key" ("keyHash")
        `);
    await queryRunner.query(`
            CREATE TABLE "organization-user" (
                "id" SERIAL NOT NULL,
                "role" character varying NOT NULL DEFAULT 'MEMBER',
                "joinedAt" TIMESTAMP NOT NULL,
                "organizationId" uuid,
                "userId" uuid,
                CONSTRAINT "PK_cc1b05b02e8034ff4afcfb13769" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_organization_user_membership" ON "organization-user" ("organizationId", "userId")
        `);
    await queryRunner.query(`
            CREATE TABLE "organization-domain" (
                "id" SERIAL NOT NULL,
                "domain" character varying NOT NULL,
                "organizationId" uuid,
                CONSTRAINT "PK_723ea843d4231840e115fdf0150" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "organization_plan" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "code" character varying(40) NOT NULL,
                "name" character varying NOT NULL,
                "maxWorkspaces" integer,
                "maxMembers" integer,
                "retentionDays" integer NOT NULL DEFAULT '3',
                "monthlyEventLimit" integer,
                "includedLogCount" integer,
                "logOverageUnitPrice" numeric(12, 6),
                "features" jsonb NOT NULL DEFAULT '{}',
                "isActive" boolean NOT NULL DEFAULT true,
                CONSTRAINT "UQ_441b87555a7991f077892278a35" UNIQUE ("code"),
                CONSTRAINT "PK_5057d4c67d87c89f2fa8d70196b" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "organization" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "profileImageKey" character varying(500),
                "planId" uuid NOT NULL,
                "ownerUserId" uuid NOT NULL,
                "createdByUserId" uuid NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "useSso" boolean NOT NULL DEFAULT false,
                "forceSSO" boolean NOT NULL DEFAULT false,
                "oidcClientId" character varying,
                "oidcClientSecret" character varying,
                "oidcIssuer" character varying,
                "samlEntryPoint" character varying,
                "samlIssuer" character varying,
                "samlCert" text,
                CONSTRAINT "PK_472c1f99a32def1b0abb219cd67" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "workspace" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "organizationId" uuid,
                CONSTRAINT "PK_ca86b6f9b3be5fe26d307d09b49" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "workspace_membership" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "userId" uuid NOT NULL,
                "role" character varying(20) NOT NULL DEFAULT 'MEMBER',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "createdByUserId" uuid,
                CONSTRAINT "CHK_workspace_membership_role" CHECK ("role" IN ('ADMIN', 'MEMBER', 'VIEWER')),
                CONSTRAINT "PK_6641ba762220c1f1a86c9379e80" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_workspace_membership_workspace_user" ON "workspace_membership" ("workspaceId", "userId")
        `);
    await queryRunner.query(`
            CREATE TABLE "user_entitlement" (
                "userId" uuid NOT NULL,
                "tier" character varying NOT NULL DEFAULT 'FREE',
                "maxOwnedOrganizations" integer DEFAULT '1',
                "dailyOrganizationCreateLimit" integer NOT NULL DEFAULT '3',
                "source" character varying NOT NULL DEFAULT 'DEFAULT',
                "expiresAt" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_6e7b2983958f6d3c6e202e833db" PRIMARY KEY ("userId")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "user" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying NOT NULL,
                "name" character varying NOT NULL,
                "profileImageKey" character varying(500),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"),
                CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "admin_user" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "role" character varying NOT NULL DEFAULT 'ADMIN',
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "userId" uuid NOT NULL,
                CONSTRAINT "PK_a28028ba709cd7e5053a86857b4" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "trial_claim" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "organizationId" uuid,
                "companyDomainHash" character varying,
                "paymentFingerprintHash" character varying,
                "status" character varying NOT NULL DEFAULT 'ACTIVE',
                "riskDecision" character varying NOT NULL DEFAULT 'ALLOW',
                "decisionReasons" jsonb NOT NULL DEFAULT '[]',
                "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_9909da0376e1db96fcc965aea36" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_trial_claim_payment" ON "trial_claim" ("paymentFingerprintHash")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_trial_claim_domain" ON "trial_claim" ("companyDomainHash")
        `);
    await queryRunner.query(`
            CREATE TABLE "firewall_approval_request" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "policyId" bigint,
                "reportedPolicyId" character varying(255),
                "sdkInstanceId" character varying(120) NOT NULL,
                "clientRequestId" character varying(160) NOT NULL,
                "runId" character varying(255) NOT NULL,
                "sessionId" character varying(255) NOT NULL,
                "agentId" character varying(255) NOT NULL,
                "toolName" character varying(255) NOT NULL,
                "inputHash" character varying(64) NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'PENDING',
                "requestReason" text,
                "requestedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "decidedAt" TIMESTAMP WITH TIME ZONE,
                "decidedByUserId" uuid,
                "decisionReason" text,
                CONSTRAINT "PK_2c0b43df3c89a4634398f46e0dc" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_firewall_approval_workspace_status" ON "firewall_approval_request" ("workspaceId", "status", "requestedAt")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_firewall_approval_client_request" ON "firewall_approval_request" (
                "workspaceId",
                "sdkInstanceId",
                "clientRequestId"
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "issue_record" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "sdkInstanceId" character varying(120) NOT NULL,
                "clientRecordId" character varying(160) NOT NULL,
                "recordKind" character varying(20) NOT NULL,
                "detectionType" character varying(50) NOT NULL,
                "clientRunId" character varying(255),
                "clientSessionId" character varying(255),
                "clientEventId" character varying(160),
                "clientAgentId" character varying(255) NOT NULL,
                "reportedPolicyId" character varying(255),
                "reportedPromptVersionId" character varying(255),
                "environment" character varying(30) NOT NULL,
                "detectedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "payload" jsonb NOT NULL,
                "evidence" jsonb,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_issue_record_kind" CHECK ("recordKind" IN ('DETECTION', 'RECOVERY')),
                CONSTRAINT "PK_59e7f36715254cb3eb9986d98f2" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_record_workspace_detected" ON "issue_record" ("workspaceId", "detectedAt", "id")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_issue_record_client_identity" ON "issue_record" ("workspaceId", "sdkInstanceId", "clientRecordId")
        `);
    await queryRunner.query(`
            CREATE TABLE "issue_evaluation" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "recordId" uuid NOT NULL,
                "evaluationNumber" integer NOT NULL,
                "pipeline" character varying(20) NOT NULL,
                "action" character varying(40) NOT NULL,
                "reasonCode" character varying(80) NOT NULL,
                "summary" text NOT NULL,
                "confidence" real,
                "stableFingerprint" character(64),
                "stableFingerprintVersion" character varying(20),
                "exactFingerprint" character(64),
                "exactFingerprintVersion" character varying(20),
                "matchedIssueId" uuid,
                "verifiedPromptVersionId" uuid,
                "evidence" jsonb NOT NULL,
                "reevaluateWhen" jsonb,
                "evaluatorName" character varying(80) NOT NULL,
                "evaluatorVersion" character varying(40) NOT NULL,
                "ruleSetVersion" character varying(40) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_issue_evaluation_confidence" CHECK (
                    "confidence" IS NULL
                    OR (
                        "confidence" >= 0
                        AND "confidence" <= 1
                    )
                ),
                CONSTRAINT "CHK_issue_evaluation_pipeline" CHECK ("pipeline" IN ('DETECTION', 'RESOLUTION')),
                CONSTRAINT "PK_d50ee55db7a2f7fbc2055a93f58" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_evaluation_matched_issue_created" ON "issue_evaluation" (
                "workspaceId",
                "matchedIssueId",
                "createdAt",
                "id"
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_evaluation_stable_fingerprint" ON "issue_evaluation" (
                "workspaceId",
                "stableFingerprintVersion",
                "stableFingerprint"
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_issue_evaluation_record_number" ON "issue_evaluation" ("recordId", "evaluationNumber")
        `);
    await queryRunner.query(`
            CREATE TABLE "issue_occurrence" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "issueId" uuid NOT NULL,
                "sessionId" uuid NOT NULL,
                "eventId" uuid,
                "firewallViolationId" uuid,
                "agentId" uuid,
                "policyId" bigint,
                "promptVersionId" uuid,
                "recordId" uuid,
                "evaluationId" uuid,
                "environment" character varying(30) NOT NULL,
                "isBlocked" boolean NOT NULL DEFAULT false,
                "detectedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "evidence" jsonb,
                "detectorVersion" character varying(40) NOT NULL,
                "clientOccurrenceId" character varying(120),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_4c094819da964d3337615e04354" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_occurrence_session_detected" ON "issue_occurrence" ("sessionId", "detectedAt")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_occurrence_workspace_detected" ON "issue_occurrence" ("workspaceId", "detectedAt", "id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_occurrence_issue_detected" ON "issue_occurrence" ("issueId", "detectedAt", "id")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_issue_occurrence_workspace_client_id" ON "issue_occurrence" ("workspaceId", "clientOccurrenceId")
        `);
    await queryRunner.query(`
            CREATE TABLE "issue" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "stableFingerprint" character(64) NOT NULL,
                "stableFingerprintVersion" character varying(20) NOT NULL DEFAULT 'v1',
                "exactFingerprint" character(64) NOT NULL,
                "exactFingerprintVersion" character varying(20) NOT NULL DEFAULT 'v1',
                "title" character varying(255) NOT NULL,
                "summary" text NOT NULL,
                "titleKey" character varying(120),
                "summaryKey" character varying(120),
                "messageParams" jsonb,
                "category" character varying(40) NOT NULL,
                "severity" character varying(20) NOT NULL DEFAULT 'WARNING',
                "status" character varying(20) NOT NULL DEFAULT 'OPEN',
                "source" character varying(20) NOT NULL,
                "environment" character varying(30) NOT NULL,
                "agentId" uuid,
                "policyId" bigint,
                "representativePromptVersionId" uuid,
                "representativeOccurrenceId" uuid,
                "reporterType" character varying(30) NOT NULL,
                "reporterUserId" uuid,
                "reporterName" character varying(120) NOT NULL,
                "firstSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "lastSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "occurrenceCount" integer NOT NULL DEFAULT '0',
                "affectedSessionCount" integer NOT NULL DEFAULT '0',
                "blockedOccurrenceCount" integer NOT NULL DEFAULT '0',
                "riskSignals" jsonb NOT NULL DEFAULT '[]',
                "reproductionSteps" jsonb NOT NULL DEFAULT '[]',
                "tags" text array NOT NULL DEFAULT '{}',
                "resolvedAt" TIMESTAMP WITH TIME ZONE,
                "resolvedByUserId" uuid,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_issue_counts" CHECK (
                    "occurrenceCount" >= 0
                    AND "affectedSessionCount" >= 0
                    AND "blockedOccurrenceCount" >= 0
                ),
                CONSTRAINT "CHK_issue_reporter_type" CHECK ("reporterType" IN ('USER', 'SDK', 'SYSTEM')),
                CONSTRAINT "CHK_issue_category" CHECK (
                    "category" IN (
                        'TOOL_RISK',
                        'FIREWALL',
                        'LOOP',
                        'MODEL_ERROR',
                        'PROMPT_REGRESSION',
                        'LATENCY',
                        'COST',
                        'DATA_EXPOSURE'
                    )
                ),
                CONSTRAINT "CHK_issue_source" CHECK (
                    "source" IN ('SDK', 'POLICY', 'DETECTOR', 'USER')
                ),
                CONSTRAINT "CHK_issue_status" CHECK (
                    "status" IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED')
                ),
                CONSTRAINT "CHK_issue_severity" CHECK ("severity" IN ('CRITICAL', 'WARNING', 'INFO')),
                CONSTRAINT "CHK_issue_exact_fingerprint_sha256" CHECK ("exactFingerprint" ~ '^[0-9a-f]{64}$'),
                CONSTRAINT "CHK_issue_stable_fingerprint_sha256" CHECK ("stableFingerprint" ~ '^[0-9a-f]{64}$'),
                CONSTRAINT "PK_f80e086c249b9f3f3ff2fd321b7" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_workspace_blocked_last_seen" ON "issue" ("workspaceId", "lastSeenAt")
            WHERE "blockedOccurrenceCount" > 0
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_workspace_agent_last_seen" ON "issue" ("workspaceId", "agentId", "lastSeenAt")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_workspace_severity_last_seen" ON "issue" ("workspaceId", "severity", "lastSeenAt")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_workspace_status_last_seen" ON "issue" ("workspaceId", "status", "lastSeenAt", "id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_workspace_stable_fingerprint" ON "issue" (
                "workspaceId",
                "stableFingerprintVersion",
                "stableFingerprint"
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_issue_workspace_exact_fingerprint" ON "issue" (
                "workspaceId",
                "exactFingerprintVersion",
                "exactFingerprint"
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "issue_activity" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "issueId" uuid NOT NULL,
                "type" character varying(30) NOT NULL,
                "actorType" character varying(20) NOT NULL DEFAULT 'SYSTEM',
                "actorUserId" uuid,
                "actorName" character varying(120) NOT NULL,
                "body" text,
                "editedAt" TIMESTAMP WITH TIME ZONE,
                "deletedAt" TIMESTAMP WITH TIME ZONE,
                "metadata" jsonb,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_issue_activity_actor_type" CHECK ("actorType" IN ('USER', 'SDK', 'SYSTEM')),
                CONSTRAINT "CHK_issue_activity_type" CHECK (
                    "type" IN (
                        'CREATED',
                        'REOPENED',
                        'STATUS_CHANGED',
                        'SEVERITY_CHANGED',
                        'ASSIGNED',
                        'UNASSIGNED',
                        'LABEL_ADDED',
                        'LABEL_REMOVED',
                        'TAG_ADDED',
                        'COMMENTED'
                    )
                ),
                CONSTRAINT "PK_26d84c944cae6f3491dc2ade374" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_activity_issue_created" ON "issue_activity" ("issueId", "createdAt", "id")
        `);
    await queryRunner.query(`
            CREATE TABLE "issue_assignee" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "workspaceId" uuid NOT NULL,
                "issueId" uuid NOT NULL,
                "userId" uuid NOT NULL,
                "assignedByUserId" uuid,
                "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_441aa138f6eff35a6835c4b0101" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_assignee_workspace_user" ON "issue_assignee" ("workspaceId", "userId")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_issue_assignee_issue_user" ON "issue_assignee" ("issueId", "userId")
        `);
    await queryRunner.query(`
            CREATE TABLE "issue_record_processing" (
                "recordId" uuid NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'RECEIVED',
                "attemptCount" integer NOT NULL DEFAULT '0',
                "lastErrorCode" character varying(80),
                "evaluationStartedAt" TIMESTAMP WITH TIME ZONE,
                "decidedAt" TIMESTAMP WITH TIME ZONE,
                "nextEvaluationAt" TIMESTAMP WITH TIME ZONE,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_issue_record_processing_status" CHECK (
                    "status" IN ('RECEIVED', 'EVALUATING', 'DECIDED', 'FAILED')
                ),
                CONSTRAINT "PK_03d37059627915a1de319b09e74" PRIMARY KEY ("recordId")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_issue_record_processing_status_next" ON "issue_record_processing" ("status", "nextEvaluationAt", "updatedAt")
        `);
    await queryRunner.query(`
            CREATE TABLE "filter-policy" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "type" character varying NOT NULL,
                "name" character varying NOT NULL,
                "pattern" character varying NOT NULL,
                "flags" character varying NOT NULL DEFAULT 'g',
                "replacement" character varying,
                "riskLevel" character varying,
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "organizationId" uuid,
                CONSTRAINT "PK_781b85ac2821f6b3758fbedabe3" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "organization_creation_event" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "organizationId" uuid,
                "requestId" uuid NOT NULL,
                "source" character varying NOT NULL DEFAULT 'API',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_7a63aec7233bceee4614bba7abd" UNIQUE ("requestId"),
                CONSTRAINT "PK_122b254b4c233967b1e760a455a" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_org_creation_event_user_created" ON "organization_creation_event" ("userId", "createdAt")
        `);
    await queryRunner.query(`
            ALTER TABLE "oidc-account"
            ADD CONSTRAINT "FK_8b391bb81c014f8bdc1056569ad" FOREIGN KEY ("userAccountId") REFERENCES "user-account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "user-account"
            ADD CONSTRAINT "FK_1c196249b607900c435af82aa1d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "run"
            ADD CONSTRAINT "FK_54de6d1f27748635cd60462d2fc" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "run"
            ADD CONSTRAINT "FK_c710956466f81363b21d4dc137a" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "run"
            ADD CONSTRAINT "FK_b028f8a3df5d3746f65b225b118" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "event"
            ADD CONSTRAINT "FK_095e9a5da8755583ff4b0fb621d" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "event"
            ADD CONSTRAINT "FK_02ce06057245ae1c05126f4bc15" FOREIGN KEY ("runId") REFERENCES "run"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt-block"
            ADD CONSTRAINT "FK_16944692dfd18d85a3883473dba" FOREIGN KEY ("promptId") REFERENCES "prompt"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt-version"
            ADD CONSTRAINT "FK_98940201e8a3e41131da42fe60d" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt-version"
            ADD CONSTRAINT "FK_db3101b92fd8580dfe94413a06b" FOREIGN KEY ("promptId") REFERENCES "prompt"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt-version"
            ADD CONSTRAINT "FK_c6e44f5f6231f55a6ed9f89362a" FOREIGN KEY ("baseVersionId") REFERENCES "prompt-version"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_deployment"
            ADD CONSTRAINT "FK_e10475928673116fb83496ca8c9" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_deployment"
            ADD CONSTRAINT "FK_87fee33783dbaab778fac5db5b9" FOREIGN KEY ("promptId") REFERENCES "prompt"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_deployment"
            ADD CONSTRAINT "FK_38fb637533b0d9b6c1f8ca16c31" FOREIGN KEY ("versionId") REFERENCES "prompt-version"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_deployment"
            ADD CONSTRAINT "FK_1f0738f56c5ee4279b1f24e3ddb" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_experiment"
            ADD CONSTRAINT "FK_e2193eedcbeb27aa391bfcf4e2c" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_experiment"
            ADD CONSTRAINT "FK_c5abba3ed07075f6fb1fbfefa38" FOREIGN KEY ("promptId") REFERENCES "prompt"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_experiment"
            ADD CONSTRAINT "FK_9ccaa3afef5d890cdb11648fbb8" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt"
            ADD CONSTRAINT "FK_742c2c1e31a74b2d6b8c4a26e64" FOREIGN KEY ("versionId") REFERENCES "prompt-version"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt"
            ADD CONSTRAINT "FK_56f5ecac2ba5e723d8ddc86339f" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD CONSTRAINT "FK_dca03a1a5ca84cccac1f95447ae" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD CONSTRAINT "FK_b65df9549ee0645b7ce9bec481b" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD CONSTRAINT "FK_827fb93f4fa463a3b3ddeeb2dc9" FOREIGN KEY ("usedPromptId") REFERENCES "prompt"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall_policy_revision"
            ADD CONSTRAINT "FK_996139ea00f42ca56491fbeb9a9" FOREIGN KEY ("policyId") REFERENCES "firewall-policy"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-policy"
            ADD CONSTRAINT "FK_5b3b1e71d7bc4cbb3ab3a8f4552" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-violation"
            ADD CONSTRAINT "FK_76d70ff29f39326f69cdaa13658" FOREIGN KEY ("reasonId") REFERENCES "firewall-policy"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-violation"
            ADD CONSTRAINT "FK_efbd2b923e9d2d615af85dbd7a1" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-violation"
            ADD CONSTRAINT "FK_57f79ec892de884ddf0953dca6d" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-violation"
            ADD CONSTRAINT "FK_7e4b0c0f16b20de1f89f2c7f07e" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-violation"
            ADD CONSTRAINT "FK_8284c05a878ea1bcb03346525fc" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "agent"
            ADD CONSTRAINT "FK_c4cb56621768a4a325dd772bbe1" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "workspace_api_key"
            ADD CONSTRAINT "FK_d194bb242edf65c91703b862e16" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "workspace_api_key"
            ADD CONSTRAINT "FK_workspace_api_key_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "organization-user"
            ADD CONSTRAINT "FK_85bedf51b43dcfd3c80cdc01c2f" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "organization-user"
            ADD CONSTRAINT "FK_e3b273beb729efd4ea57ef92bfd" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "organization-domain"
            ADD CONSTRAINT "FK_6d997fe9de5e84bbed317ae1741" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "organization"
            ADD CONSTRAINT "FK_9838b0567dc51c15e3679b2a6e3" FOREIGN KEY ("planId") REFERENCES "organization_plan"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "organization"
            ADD CONSTRAINT "FK_a250b4517774f73d0fcb5cb8e26" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "organization"
            ADD CONSTRAINT "FK_c9b171391d920c279fae8a1bf26" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "workspace"
            ADD CONSTRAINT "FK_a700527eb11f812d79f55907d33" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "workspace_membership"
            ADD CONSTRAINT "FK_workspace_membership_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "workspace_membership"
            ADD CONSTRAINT "FK_workspace_membership_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "user_entitlement"
            ADD CONSTRAINT "FK_6e7b2983958f6d3c6e202e833db" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "admin_user"
            ADD CONSTRAINT "FK_a93ad905a72b85605fb28b26198" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "trial_claim"
            ADD CONSTRAINT "FK_129a7b3dd869318ea0c188cc947" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "trial_claim"
            ADD CONSTRAINT "FK_2b66e9295535d908943974d9974" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall_approval_request"
            ADD CONSTRAINT "FK_b4c154e9aa2fb22c01b4f3fc65f" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall_approval_request"
            ADD CONSTRAINT "FK_438c6470dfbf174adf001f213db" FOREIGN KEY ("policyId") REFERENCES "firewall-policy"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall_approval_request"
            ADD CONSTRAINT "FK_6c6489b5b8393b338b3b66d915a" FOREIGN KEY ("decidedByUserId") REFERENCES "user"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_record"
            ADD CONSTRAINT "FK_issue_record_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_evaluation"
            ADD CONSTRAINT "FK_issue_evaluation_record" FOREIGN KEY ("recordId") REFERENCES "issue_record"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_evaluation"
            ADD CONSTRAINT "FK_issue_evaluation_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_evaluation"
            ADD CONSTRAINT "FK_issue_evaluation_matched_issue" FOREIGN KEY ("matchedIssueId") REFERENCES "issue"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_evaluation"
            ADD CONSTRAINT "FK_issue_evaluation_prompt_version" FOREIGN KEY ("verifiedPromptVersionId") REFERENCES "prompt-version"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence"
            ADD CONSTRAINT "FK_issue_occurrence_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence"
            ADD CONSTRAINT "FK_issue_occurrence_issue" FOREIGN KEY ("issueId") REFERENCES "issue"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence"
            ADD CONSTRAINT "FK_issue_occurrence_session" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence"
            ADD CONSTRAINT "FK_issue_occurrence_event" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence"
            ADD CONSTRAINT "FK_issue_occurrence_firewall_violation" FOREIGN KEY ("firewallViolationId") REFERENCES "firewall-violation"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence"
            ADD CONSTRAINT "FK_issue_occurrence_agent" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence"
            ADD CONSTRAINT "FK_issue_occurrence_policy" FOREIGN KEY ("policyId") REFERENCES "firewall-policy"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence"
            ADD CONSTRAINT "FK_issue_occurrence_prompt_version" FOREIGN KEY ("promptVersionId") REFERENCES "prompt-version"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence"
            ADD CONSTRAINT "FK_issue_occurrence_record" FOREIGN KEY ("recordId") REFERENCES "issue_record"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence"
            ADD CONSTRAINT "FK_issue_occurrence_evaluation" FOREIGN KEY ("evaluationId") REFERENCES "issue_evaluation"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue"
            ADD CONSTRAINT "FK_issue_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue"
            ADD CONSTRAINT "FK_issue_agent" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue"
            ADD CONSTRAINT "FK_issue_policy" FOREIGN KEY ("policyId") REFERENCES "firewall-policy"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue"
            ADD CONSTRAINT "FK_issue_prompt_version" FOREIGN KEY ("representativePromptVersionId") REFERENCES "prompt-version"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue"
            ADD CONSTRAINT "FK_issue_reporter_user" FOREIGN KEY ("reporterUserId") REFERENCES "user"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue"
            ADD CONSTRAINT "FK_issue_resolved_by_user" FOREIGN KEY ("resolvedByUserId") REFERENCES "user"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue"
            ADD CONSTRAINT "FK_issue_representative_occurrence" FOREIGN KEY ("representativeOccurrenceId") REFERENCES "issue_occurrence"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_activity"
            ADD CONSTRAINT "FK_issue_activity_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_activity"
            ADD CONSTRAINT "FK_issue_activity_issue" FOREIGN KEY ("issueId") REFERENCES "issue"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_activity"
            ADD CONSTRAINT "FK_issue_activity_actor_user" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_assignee"
            ADD CONSTRAINT "FK_issue_assignee_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_assignee"
            ADD CONSTRAINT "FK_issue_assignee_issue" FOREIGN KEY ("issueId") REFERENCES "issue"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_assignee"
            ADD CONSTRAINT "FK_issue_assignee_membership" FOREIGN KEY ("workspaceId", "userId") REFERENCES "workspace_membership"("workspaceId", "userId") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_assignee"
            ADD CONSTRAINT "FK_issue_assignee_assigned_by" FOREIGN KEY ("assignedByUserId") REFERENCES "user"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_record_processing"
            ADD CONSTRAINT "FK_issue_record_processing_record" FOREIGN KEY ("recordId") REFERENCES "issue_record"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "filter-policy"
            ADD CONSTRAINT "FK_00b6474e2d0fcf7bc80ec53df7c" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "organization_creation_event"
            ADD CONSTRAINT "FK_d05a3ef80e7de3efdfa5fb8df79" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "organization_creation_event"
            ADD CONSTRAINT "FK_4c12babdf78af426323cbfda348" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    // 엔티티 메타데이터로 표현하기 어려운 부분 인덱스와 JSON 인덱스를 명시적으로 유지합니다.
    await queryRunner.query(`
            CREATE INDEX "IDX_admin_audit_log_actor_created"
            ON "admin_audit_log" ("actorUserId", "createdAt" DESC)
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_admin_audit_log_target"
            ON "admin_audit_log" ("targetType", "targetId")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_agent_workspace_name"
            ON "agent" ("workspaceId", "name")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_session_workspace_name"
            ON "session" ("workspaceId", "name")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_session_workspace_status_started_at"
            ON "session" ("workspaceId", "status", "startedAt" DESC)
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_session_agent_started_at"
            ON "session" ("agentId", "startedAt" DESC)
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_event_run_client_event"
            ON "event" ("runId", "clientId", "clientEventId")
            WHERE "runId" IS NOT NULL AND "clientEventId" IS NOT NULL
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_event_run_timestamp"
            ON "event" ("runId", "timestamp", "createdAt", "id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_event_session_timestamp"
            ON "event" ("sessionId", "timestamp", "createdAt")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_event_type_timestamp"
            ON "event" ("eventType", "timestamp" DESC)
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_event_timestamp"
            ON "event" ("timestamp" DESC)
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_event_created_at"
            ON "event" ("createdAt" DESC)
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_event_payload_span_id"
            ON "event" (("payload"->>'spanId'))
            WHERE "payload" ? 'spanId'
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_event_payload_parent_span_id"
            ON "event" (("payload"->>'parentSpanId'))
            WHERE "payload" ? 'parentSpanId'
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_event_prompt_version_ids"
            ON "event" USING GIN (("payload"->'promptVersionIds'))
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_firewall_violation_workspace_created"
            ON "firewall-violation" ("workspaceId", "createdAt" DESC)
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_prompt_workspace_name_active"
            ON "prompt" ("workspaceId", lower("name"))
            WHERE "deletedAt" IS NULL
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_prompt_version_label"
            ON "prompt-version" ("promptId", "version")
            WHERE "promptId" IS NOT NULL
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_prompt_version_draft_revision"
            ON "prompt-version" ("promptId", "draftRevision")
            WHERE "promptId" IS NOT NULL AND "draftRevision" IS NOT NULL
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_prompt_deployment_default_active"
            ON "prompt_deployment" ("workspaceId", "promptId", "environment")
            WHERE "active" = true AND "agentId" IS NULL
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_prompt_deployment_agent_active"
            ON "prompt_deployment" (
                "workspaceId",
                "promptId",
                "environment",
                "agentId"
            )
            WHERE "active" = true AND "agentId" IS NOT NULL
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_prompt_experiment_default_active"
            ON "prompt_experiment" ("workspaceId", "promptId", "environment")
            WHERE "status" = 'ACTIVE' AND "agentId" IS NULL
        `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompt_experiment_agent_active"
            ON "prompt_experiment" (
                "workspaceId",
                "promptId",
                "environment",
                "agentId"
            )
      WHERE "status" = 'ACTIVE' AND "agentId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "organization_creation_event" DROP CONSTRAINT "FK_4c12babdf78af426323cbfda348"
        `);
    await queryRunner.query(`
            ALTER TABLE "organization_creation_event" DROP CONSTRAINT "FK_d05a3ef80e7de3efdfa5fb8df79"
        `);
    await queryRunner.query(`
            ALTER TABLE "filter-policy" DROP CONSTRAINT "FK_00b6474e2d0fcf7bc80ec53df7c"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_record_processing" DROP CONSTRAINT "FK_issue_record_processing_record"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_assignee" DROP CONSTRAINT "FK_issue_assignee_assigned_by"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_assignee" DROP CONSTRAINT "FK_issue_assignee_membership"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_assignee" DROP CONSTRAINT "FK_issue_assignee_issue"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_assignee" DROP CONSTRAINT "FK_issue_assignee_workspace"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_activity" DROP CONSTRAINT "FK_issue_activity_actor_user"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_activity" DROP CONSTRAINT "FK_issue_activity_issue"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_activity" DROP CONSTRAINT "FK_issue_activity_workspace"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue" DROP CONSTRAINT "FK_issue_representative_occurrence"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue" DROP CONSTRAINT "FK_issue_resolved_by_user"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue" DROP CONSTRAINT "FK_issue_reporter_user"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue" DROP CONSTRAINT "FK_issue_prompt_version"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue" DROP CONSTRAINT "FK_issue_policy"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue" DROP CONSTRAINT "FK_issue_agent"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue" DROP CONSTRAINT "FK_issue_workspace"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence" DROP CONSTRAINT "FK_issue_occurrence_evaluation"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence" DROP CONSTRAINT "FK_issue_occurrence_record"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence" DROP CONSTRAINT "FK_issue_occurrence_prompt_version"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence" DROP CONSTRAINT "FK_issue_occurrence_policy"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence" DROP CONSTRAINT "FK_issue_occurrence_agent"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence" DROP CONSTRAINT "FK_issue_occurrence_firewall_violation"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence" DROP CONSTRAINT "FK_issue_occurrence_event"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence" DROP CONSTRAINT "FK_issue_occurrence_session"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence" DROP CONSTRAINT "FK_issue_occurrence_issue"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_occurrence" DROP CONSTRAINT "FK_issue_occurrence_workspace"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_evaluation" DROP CONSTRAINT "FK_issue_evaluation_prompt_version"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_evaluation" DROP CONSTRAINT "FK_issue_evaluation_matched_issue"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_evaluation" DROP CONSTRAINT "FK_issue_evaluation_workspace"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_evaluation" DROP CONSTRAINT "FK_issue_evaluation_record"
        `);
    await queryRunner.query(`
            ALTER TABLE "issue_record" DROP CONSTRAINT "FK_issue_record_workspace"
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall_approval_request" DROP CONSTRAINT "FK_6c6489b5b8393b338b3b66d915a"
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall_approval_request" DROP CONSTRAINT "FK_438c6470dfbf174adf001f213db"
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall_approval_request" DROP CONSTRAINT "FK_b4c154e9aa2fb22c01b4f3fc65f"
        `);
    await queryRunner.query(`
            ALTER TABLE "trial_claim" DROP CONSTRAINT "FK_2b66e9295535d908943974d9974"
        `);
    await queryRunner.query(`
            ALTER TABLE "trial_claim" DROP CONSTRAINT "FK_129a7b3dd869318ea0c188cc947"
        `);
    await queryRunner.query(`
            ALTER TABLE "admin_user" DROP CONSTRAINT "FK_a93ad905a72b85605fb28b26198"
        `);
    await queryRunner.query(`
            ALTER TABLE "user_entitlement" DROP CONSTRAINT "FK_6e7b2983958f6d3c6e202e833db"
        `);
    await queryRunner.query(`
            ALTER TABLE "workspace_membership" DROP CONSTRAINT "FK_workspace_membership_user"
        `);
    await queryRunner.query(`
            ALTER TABLE "workspace_membership" DROP CONSTRAINT "FK_workspace_membership_workspace"
        `);
    await queryRunner.query(`
            ALTER TABLE "workspace" DROP CONSTRAINT "FK_a700527eb11f812d79f55907d33"
        `);
    await queryRunner.query(`
            ALTER TABLE "organization" DROP CONSTRAINT "FK_c9b171391d920c279fae8a1bf26"
        `);
    await queryRunner.query(`
            ALTER TABLE "organization" DROP CONSTRAINT "FK_a250b4517774f73d0fcb5cb8e26"
        `);
    await queryRunner.query(`
            ALTER TABLE "organization" DROP CONSTRAINT "FK_9838b0567dc51c15e3679b2a6e3"
        `);
    await queryRunner.query(`
            ALTER TABLE "organization-domain" DROP CONSTRAINT "FK_6d997fe9de5e84bbed317ae1741"
        `);
    await queryRunner.query(`
            ALTER TABLE "organization-user" DROP CONSTRAINT "FK_e3b273beb729efd4ea57ef92bfd"
        `);
    await queryRunner.query(`
            ALTER TABLE "organization-user" DROP CONSTRAINT "FK_85bedf51b43dcfd3c80cdc01c2f"
        `);
    await queryRunner.query(`
            ALTER TABLE "workspace_api_key" DROP CONSTRAINT "FK_workspace_api_key_created_by"
        `);
    await queryRunner.query(`
            ALTER TABLE "workspace_api_key" DROP CONSTRAINT "FK_d194bb242edf65c91703b862e16"
        `);
    await queryRunner.query(`
            ALTER TABLE "agent" DROP CONSTRAINT "FK_c4cb56621768a4a325dd772bbe1"
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-violation" DROP CONSTRAINT "FK_8284c05a878ea1bcb03346525fc"
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-violation" DROP CONSTRAINT "FK_7e4b0c0f16b20de1f89f2c7f07e"
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-violation" DROP CONSTRAINT "FK_57f79ec892de884ddf0953dca6d"
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-violation" DROP CONSTRAINT "FK_efbd2b923e9d2d615af85dbd7a1"
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-violation" DROP CONSTRAINT "FK_76d70ff29f39326f69cdaa13658"
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall-policy" DROP CONSTRAINT "FK_5b3b1e71d7bc4cbb3ab3a8f4552"
        `);
    await queryRunner.query(`
            ALTER TABLE "firewall_policy_revision" DROP CONSTRAINT "FK_996139ea00f42ca56491fbeb9a9"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP CONSTRAINT "FK_827fb93f4fa463a3b3ddeeb2dc9"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP CONSTRAINT "FK_b65df9549ee0645b7ce9bec481b"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP CONSTRAINT "FK_dca03a1a5ca84cccac1f95447ae"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt" DROP CONSTRAINT "FK_56f5ecac2ba5e723d8ddc86339f"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt" DROP CONSTRAINT "FK_742c2c1e31a74b2d6b8c4a26e64"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_experiment" DROP CONSTRAINT "FK_9ccaa3afef5d890cdb11648fbb8"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_experiment" DROP CONSTRAINT "FK_c5abba3ed07075f6fb1fbfefa38"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_experiment" DROP CONSTRAINT "FK_e2193eedcbeb27aa391bfcf4e2c"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_deployment" DROP CONSTRAINT "FK_1f0738f56c5ee4279b1f24e3ddb"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_deployment" DROP CONSTRAINT "FK_38fb637533b0d9b6c1f8ca16c31"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_deployment" DROP CONSTRAINT "FK_87fee33783dbaab778fac5db5b9"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt_deployment" DROP CONSTRAINT "FK_e10475928673116fb83496ca8c9"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt-version" DROP CONSTRAINT "FK_c6e44f5f6231f55a6ed9f89362a"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt-version" DROP CONSTRAINT "FK_db3101b92fd8580dfe94413a06b"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt-version" DROP CONSTRAINT "FK_98940201e8a3e41131da42fe60d"
        `);
    await queryRunner.query(`
            ALTER TABLE "prompt-block" DROP CONSTRAINT "FK_16944692dfd18d85a3883473dba"
        `);
    await queryRunner.query(`
            ALTER TABLE "event" DROP CONSTRAINT "FK_02ce06057245ae1c05126f4bc15"
        `);
    await queryRunner.query(`
            ALTER TABLE "event" DROP CONSTRAINT "FK_095e9a5da8755583ff4b0fb621d"
        `);
    await queryRunner.query(`
            ALTER TABLE "run" DROP CONSTRAINT "FK_b028f8a3df5d3746f65b225b118"
        `);
    await queryRunner.query(`
            ALTER TABLE "run" DROP CONSTRAINT "FK_c710956466f81363b21d4dc137a"
        `);
    await queryRunner.query(`
            ALTER TABLE "run" DROP CONSTRAINT "FK_54de6d1f27748635cd60462d2fc"
        `);
    await queryRunner.query(`
            ALTER TABLE "user-account" DROP CONSTRAINT "FK_1c196249b607900c435af82aa1d"
        `);
    await queryRunner.query(`
            ALTER TABLE "oidc-account" DROP CONSTRAINT "FK_8b391bb81c014f8bdc1056569ad"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_org_creation_event_user_created"
        `);
    await queryRunner.query(`
            DROP TABLE "organization_creation_event"
        `);
    await queryRunner.query(`
            DROP TABLE "filter-policy"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_record_processing_status_next"
        `);
    await queryRunner.query(`
            DROP TABLE "issue_record_processing"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_issue_assignee_issue_user"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_assignee_workspace_user"
        `);
    await queryRunner.query(`
            DROP TABLE "issue_assignee"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_activity_issue_created"
        `);
    await queryRunner.query(`
            DROP TABLE "issue_activity"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_issue_workspace_exact_fingerprint"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_workspace_stable_fingerprint"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_workspace_status_last_seen"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_workspace_severity_last_seen"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_workspace_agent_last_seen"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_workspace_blocked_last_seen"
        `);
    await queryRunner.query(`
            DROP TABLE "issue"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_issue_occurrence_workspace_client_id"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_occurrence_issue_detected"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_occurrence_workspace_detected"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_occurrence_session_detected"
        `);
    await queryRunner.query(`
            DROP TABLE "issue_occurrence"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_issue_evaluation_record_number"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_evaluation_stable_fingerprint"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_evaluation_matched_issue_created"
        `);
    await queryRunner.query(`
            DROP TABLE "issue_evaluation"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_issue_record_client_identity"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_issue_record_workspace_detected"
        `);
    await queryRunner.query(`
            DROP TABLE "issue_record"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_firewall_approval_client_request"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_firewall_approval_workspace_status"
        `);
    await queryRunner.query(`
            DROP TABLE "firewall_approval_request"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_trial_claim_domain"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_trial_claim_payment"
        `);
    await queryRunner.query(`
            DROP TABLE "trial_claim"
        `);
    await queryRunner.query(`
            DROP TABLE "admin_user"
        `);
    await queryRunner.query(`
            DROP TABLE "user"
        `);
    await queryRunner.query(`
            DROP TABLE "user_entitlement"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_workspace_membership_workspace_user"
        `);
    await queryRunner.query(`
            DROP TABLE "workspace_membership"
        `);
    await queryRunner.query(`
            DROP TABLE "workspace"
        `);
    await queryRunner.query(`
            DROP TABLE "organization"
        `);
    await queryRunner.query(`
            DROP TABLE "organization_plan"
        `);
    await queryRunner.query(`
            DROP TABLE "organization-domain"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_organization_user_membership"
        `);
    await queryRunner.query(`
            DROP TABLE "organization-user"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_workspace_api_key_hash"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_workspace_api_key_workspace_active"
        `);
    await queryRunner.query(`
            DROP TABLE "workspace_api_key"
        `);
    await queryRunner.query(`
            DROP TABLE "agent"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_firewall_violation_event"
        `);
    await queryRunner.query(`
            DROP TABLE "firewall-violation"
        `);
    await queryRunner.query(`
            DROP TABLE "firewall-policy"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_firewall_policy_revision"
        `);
    await queryRunner.query(`
            DROP TABLE "firewall_policy_revision"
        `);
    await queryRunner.query(`
            DROP TABLE "session"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_prompt_workspace_updated"
        `);
    await queryRunner.query(`
            DROP TABLE "prompt"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_prompt_experiment_workspace_created"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_prompt_experiment_scope_status"
        `);
    await queryRunner.query(`
            DROP TABLE "prompt_experiment"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_prompt_deployment_workspace_created"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_prompt_deployment_scope_active"
        `);
    await queryRunner.query(`
            DROP TABLE "prompt_deployment"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_prompt_version_prompt_created"
        `);
    await queryRunner.query(`
            DROP TABLE "prompt-version"
        `);
    await queryRunner.query(`
            DROP TABLE "prompt-block"
        `);
    await queryRunner.query(`
            DROP TABLE "event"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_run_workspace_client_run"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_run_workspace_started"
        `);
    await queryRunner.query(`
            DROP TABLE "run"
        `);
    await queryRunner.query(`
            DROP TABLE "user-account"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_1107ab83efb02359d7cdb76329"
        `);
    await queryRunner.query(`
            DROP TABLE "oidc-account"
        `);
    await queryRunner.query(`
            DROP TABLE "admin_audit_log"
        `);
  }
}
