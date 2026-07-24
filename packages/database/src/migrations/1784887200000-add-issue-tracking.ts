import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddIssueTracking1784887200000 implements MigrationInterface {
  name = "AddIssueTracking1784887200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "issue_record" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL,
        "sdkInstanceId" varchar(120) NOT NULL,
        "clientRecordId" varchar(160) NOT NULL,
        "recordKind" varchar(20) NOT NULL,
        "detectionType" varchar(50) NOT NULL,
        "clientRunId" varchar(255),
        "clientSessionId" varchar(255),
        "clientEventId" varchar(160),
        "clientAgentId" varchar(255) NOT NULL,
        "reportedPolicyId" varchar(255),
        "reportedPromptVersionId" varchar(255),
        "environment" varchar(30) NOT NULL,
        "detectedAt" timestamptz NOT NULL,
        "payload" jsonb NOT NULL,
        "evidence" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_record" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_issue_record_kind"
          CHECK ("recordKind" IN ('DETECTION', 'RECOVERY')),
        CONSTRAINT "UQ_issue_record_client_identity"
          UNIQUE ("workspaceId", "sdkInstanceId", "clientRecordId"),
        CONSTRAINT "FK_issue_record_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_record_workspace_detected"
      ON "issue_record" ("workspaceId", "detectedAt" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE "issue_record_processing" (
        "recordId" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'RECEIVED',
        "attemptCount" integer NOT NULL DEFAULT 0,
        "lastErrorCode" varchar(80),
        "evaluationStartedAt" timestamptz,
        "decidedAt" timestamptz,
        "nextEvaluationAt" timestamptz,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_record_processing" PRIMARY KEY ("recordId"),
        CONSTRAINT "CHK_issue_record_processing_status"
          CHECK ("status" IN ('RECEIVED', 'EVALUATING', 'DECIDED', 'FAILED')),
        CONSTRAINT "FK_issue_record_processing_record"
          FOREIGN KEY ("recordId") REFERENCES "issue_record"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_record_processing_status_next"
      ON "issue_record_processing" ("status", "nextEvaluationAt", "updatedAt")
    `);

    await queryRunner.query(`
      CREATE TABLE "issue" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL,
        "stableFingerprint" char(64) NOT NULL,
        "stableFingerprintVersion" varchar(20) NOT NULL DEFAULT 'v1',
        "exactFingerprint" char(64) NOT NULL,
        "exactFingerprintVersion" varchar(20) NOT NULL DEFAULT 'v1',
        "title" varchar(255) NOT NULL,
        "summary" text NOT NULL,
        "category" varchar(40) NOT NULL,
        "severity" varchar(20) NOT NULL DEFAULT 'WARNING',
        "status" varchar(20) NOT NULL DEFAULT 'OPEN',
        "source" varchar(20) NOT NULL,
        "environment" varchar(30) NOT NULL,
        "agentId" uuid,
        "policyId" bigint,
        "representativePromptVersionId" uuid,
        "representativeOccurrenceId" uuid,
        "reporterType" varchar(30) NOT NULL,
        "reporterUserId" uuid,
        "reporterName" varchar(120) NOT NULL,
        "firstSeenAt" timestamptz NOT NULL,
        "lastSeenAt" timestamptz NOT NULL,
        "occurrenceCount" integer NOT NULL DEFAULT 0,
        "affectedSessionCount" integer NOT NULL DEFAULT 0,
        "blockedOccurrenceCount" integer NOT NULL DEFAULT 0,
        "riskSignals" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "reproductionSteps" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "tags" text[] NOT NULL DEFAULT '{}',
        "resolvedAt" timestamptz,
        "resolvedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_issue_stable_fingerprint_sha256"
          CHECK ("stableFingerprint" ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "CHK_issue_exact_fingerprint_sha256"
          CHECK ("exactFingerprint" ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "CHK_issue_severity"
          CHECK ("severity" IN ('CRITICAL', 'WARNING', 'INFO')),
        CONSTRAINT "CHK_issue_status"
          CHECK ("status" IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED')),
        CONSTRAINT "CHK_issue_source"
          CHECK ("source" IN ('SDK', 'POLICY', 'DETECTOR', 'USER')),
        CONSTRAINT "CHK_issue_category"
          CHECK ("category" IN (
            'TOOL_RISK',
            'GUARDRAIL',
            'LOOP',
            'MODEL_ERROR',
            'PROMPT_REGRESSION',
            'LATENCY',
            'COST',
            'DATA_EXPOSURE'
          )),
        CONSTRAINT "CHK_issue_reporter_type"
          CHECK ("reporterType" IN ('USER', 'SDK', 'SYSTEM')),
        CONSTRAINT "CHK_issue_counts"
          CHECK (
            "occurrenceCount" >= 0
            AND "affectedSessionCount" >= 0
            AND "blockedOccurrenceCount" >= 0
          ),
        CONSTRAINT "UQ_issue_workspace_exact_fingerprint"
          UNIQUE (
            "workspaceId",
            "exactFingerprintVersion",
            "exactFingerprint"
          ),
        CONSTRAINT "FK_issue_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_issue_agent"
          FOREIGN KEY ("agentId") REFERENCES "agent"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_issue_policy"
          FOREIGN KEY ("policyId") REFERENCES "guardrail-policy"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_issue_prompt_version"
          FOREIGN KEY ("representativePromptVersionId")
          REFERENCES "prompt-version"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_issue_reporter_user"
          FOREIGN KEY ("reporterUserId") REFERENCES "user"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_issue_resolved_by_user"
          FOREIGN KEY ("resolvedByUserId") REFERENCES "user"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_workspace_stable_fingerprint"
      ON "issue" (
        "workspaceId",
        "stableFingerprintVersion",
        "stableFingerprint"
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_workspace_status_last_seen"
      ON "issue" ("workspaceId", "status", "lastSeenAt" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_workspace_severity_last_seen"
      ON "issue" ("workspaceId", "severity", "lastSeenAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_workspace_agent_last_seen"
      ON "issue" ("workspaceId", "agentId", "lastSeenAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_workspace_blocked_last_seen"
      ON "issue" ("workspaceId", "lastSeenAt" DESC)
      WHERE "blockedOccurrenceCount" > 0
    `);

    await queryRunner.query(`
      CREATE TABLE "issue_occurrence" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL,
        "issueId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "eventId" uuid,
        "guardrailViolationId" uuid,
        "agentId" uuid,
        "policyId" bigint,
        "promptVersionId" uuid,
        "recordId" uuid,
        "evaluationId" uuid,
        "environment" varchar(30) NOT NULL,
        "isBlocked" boolean NOT NULL DEFAULT false,
        "detectedAt" timestamptz NOT NULL,
        "evidence" jsonb,
        "detectorVersion" varchar(40) NOT NULL,
        "clientOccurrenceId" varchar(120),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_occurrence" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_issue_occurrence_workspace_client_id"
          UNIQUE ("workspaceId", "clientOccurrenceId"),
        CONSTRAINT "FK_issue_occurrence_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_issue_occurrence_issue"
          FOREIGN KEY ("issueId") REFERENCES "issue"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_issue_occurrence_session"
          FOREIGN KEY ("sessionId") REFERENCES "session"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_issue_occurrence_event"
          FOREIGN KEY ("eventId") REFERENCES "event"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_issue_occurrence_guardrail_violation"
          FOREIGN KEY ("guardrailViolationId") REFERENCES "guardrail-violation"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_issue_occurrence_agent"
          FOREIGN KEY ("agentId") REFERENCES "agent"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_issue_occurrence_policy"
          FOREIGN KEY ("policyId") REFERENCES "guardrail-policy"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_issue_occurrence_prompt_version"
          FOREIGN KEY ("promptVersionId") REFERENCES "prompt-version"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_occurrence_issue_detected"
      ON "issue_occurrence" ("issueId", "detectedAt" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_occurrence_workspace_detected"
      ON "issue_occurrence" ("workspaceId", "detectedAt" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_occurrence_session_detected"
      ON "issue_occurrence" ("sessionId", "detectedAt" DESC)
    `);
    await queryRunner.query(`
      ALTER TABLE "issue"
      ADD CONSTRAINT "FK_issue_representative_occurrence"
      FOREIGN KEY ("representativeOccurrenceId") REFERENCES "issue_occurrence"("id")
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "issue_evaluation" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL,
        "recordId" uuid NOT NULL,
        "evaluationNumber" integer NOT NULL,
        "pipeline" varchar(20) NOT NULL,
        "action" varchar(40) NOT NULL,
        "reasonCode" varchar(80) NOT NULL,
        "summary" text NOT NULL,
        "confidence" real,
        "stableFingerprint" char(64),
        "stableFingerprintVersion" varchar(20),
        "exactFingerprint" char(64),
        "exactFingerprintVersion" varchar(20),
        "matchedIssueId" uuid,
        "verifiedPromptVersionId" uuid,
        "evidence" jsonb NOT NULL,
        "reevaluateWhen" jsonb,
        "evaluatorName" varchar(80) NOT NULL,
        "evaluatorVersion" varchar(40) NOT NULL,
        "ruleSetVersion" varchar(40) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_evaluation" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_issue_evaluation_pipeline"
          CHECK ("pipeline" IN ('DETECTION', 'RESOLUTION')),
        CONSTRAINT "CHK_issue_evaluation_confidence"
          CHECK (
            "confidence" IS NULL
            OR ("confidence" >= 0 AND "confidence" <= 1)
          ),
        CONSTRAINT "UQ_issue_evaluation_record_number"
          UNIQUE ("recordId", "evaluationNumber"),
        CONSTRAINT "FK_issue_evaluation_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_issue_evaluation_record"
          FOREIGN KEY ("recordId") REFERENCES "issue_record"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_issue_evaluation_matched_issue"
          FOREIGN KEY ("matchedIssueId") REFERENCES "issue"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_issue_evaluation_prompt_version"
          FOREIGN KEY ("verifiedPromptVersionId") REFERENCES "prompt-version"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_evaluation_stable_fingerprint"
      ON "issue_evaluation" (
        "workspaceId",
        "stableFingerprintVersion",
        "stableFingerprint"
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "issue_occurrence"
      ADD CONSTRAINT "FK_issue_occurrence_record"
        FOREIGN KEY ("recordId") REFERENCES "issue_record"("id")
        ON DELETE SET NULL,
      ADD CONSTRAINT "FK_issue_occurrence_evaluation"
        FOREIGN KEY ("evaluationId") REFERENCES "issue_evaluation"("id")
        ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "issue_activity" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL,
        "issueId" uuid NOT NULL,
        "type" varchar(30) NOT NULL,
        "actorType" varchar(20) NOT NULL DEFAULT 'SYSTEM',
        "actorUserId" uuid,
        "actorName" varchar(120) NOT NULL,
        "body" text,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_activity" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_issue_activity_type"
          CHECK ("type" IN (
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
          )),
        CONSTRAINT "CHK_issue_activity_actor_type"
          CHECK ("actorType" IN ('USER', 'SDK', 'SYSTEM')),
        CONSTRAINT "FK_issue_activity_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_issue_activity_issue"
          FOREIGN KEY ("issueId") REFERENCES "issue"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_issue_activity_actor_user"
          FOREIGN KEY ("actorUserId") REFERENCES "user"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_activity_issue_created"
      ON "issue_activity" ("issueId", "createdAt", "id")
    `);

    await queryRunner.query(`
      CREATE TABLE "issue_assignee" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL,
        "issueId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "assignedByUserId" uuid,
        "assignedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issue_assignee" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_issue_assignee_issue_user" UNIQUE ("issueId", "userId"),
        CONSTRAINT "FK_issue_assignee_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_issue_assignee_issue"
          FOREIGN KEY ("issueId") REFERENCES "issue"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_issue_assignee_membership"
          FOREIGN KEY ("workspaceId", "userId")
          REFERENCES "workspace_membership"("workspaceId", "userId")
          ON DELETE CASCADE,
        CONSTRAINT "FK_issue_assignee_assigned_by"
          FOREIGN KEY ("assignedByUserId") REFERENCES "user"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_issue_assignee_workspace_user"
      ON "issue_assignee" ("workspaceId", "userId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_issue_assignee_workspace_user"`);
    await queryRunner.query(`DROP TABLE "issue_assignee"`);
    await queryRunner.query(`DROP INDEX "IDX_issue_activity_issue_created"`);
    await queryRunner.query(`DROP TABLE "issue_activity"`);
    await queryRunner.query(`
      ALTER TABLE "issue_occurrence"
      DROP CONSTRAINT "FK_issue_occurrence_evaluation",
      DROP CONSTRAINT "FK_issue_occurrence_record"
    `);
    await queryRunner.query(
      `DROP INDEX "IDX_issue_evaluation_stable_fingerprint"`,
    );
    await queryRunner.query(`DROP TABLE "issue_evaluation"`);
    await queryRunner.query(`
      ALTER TABLE "issue"
      DROP CONSTRAINT "FK_issue_representative_occurrence"
    `);
    await queryRunner.query(
      `DROP INDEX "IDX_issue_occurrence_session_detected"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_issue_occurrence_workspace_detected"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_issue_occurrence_issue_detected"`);
    await queryRunner.query(`DROP TABLE "issue_occurrence"`);
    await queryRunner.query(`DROP INDEX "IDX_issue_workspace_blocked_last_seen"`);
    await queryRunner.query(`DROP INDEX "IDX_issue_workspace_agent_last_seen"`);
    await queryRunner.query(
      `DROP INDEX "IDX_issue_workspace_severity_last_seen"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_issue_workspace_status_last_seen"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_issue_workspace_stable_fingerprint"`,
    );
    await queryRunner.query(`DROP TABLE "issue"`);
    await queryRunner.query(
      `DROP INDEX "IDX_issue_record_processing_status_next"`,
    );
    await queryRunner.query(`DROP TABLE "issue_record_processing"`);
    await queryRunner.query(
      `DROP INDEX "IDX_issue_record_workspace_detected"`,
    );
    await queryRunner.query(`DROP TABLE "issue_record"`);
  }
}
