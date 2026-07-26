import { createHash } from "node:crypto";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddPromptOperations1785405600000 implements MigrationInterface {
  name = "AddPromptOperations1785405600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prompt"
      ALTER COLUMN "description" TYPE text,
      ADD COLUMN "workspaceId" uuid,
      ADD COLUMN "draftContent" text,
      ADD COLUMN "draftRevision" integer NOT NULL DEFAULT 1,
      ADD COLUMN "draftUpdatedByUserId" uuid,
      ADD COLUMN "deletedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt-version"
      ALTER COLUMN "createdBy" DROP NOT NULL,
      ALTER COLUMN "content" TYPE text,
      ADD COLUMN "promptId" uuid,
      ADD COLUMN "contentHash" char(64),
      ADD COLUMN "baseVersionId" uuid,
      ADD COLUMN "changeReason" text,
      ADD COLUMN "createdByUserId" uuid,
      ADD COLUMN "draftRevision" integer
    `);
    await queryRunner.query(`
      UPDATE "prompt-version" version
      SET "promptId" = source."promptId"
      FROM (
        SELECT MIN("id"::text)::uuid AS "promptId", "versionId"
        FROM "prompt"
        GROUP BY "versionId"
      ) source
      WHERE source."versionId" = version."id"
    `);
    const legacyVersions = (await queryRunner.query(
      `SELECT "id", "content" FROM "prompt-version"`,
    )) as Array<{ id: string; content: string }>;
    // DB 확장 모듈에 의존하지 않도록 기존 본문의 SHA-256을 애플리케이션에서 계산합니다.
    for (const version of legacyVersions) {
      const contentHash = createHash("sha256")
        .update(version.content, "utf8")
        .digest("hex");
      await queryRunner.query(
        `UPDATE "prompt-version" SET "contentHash" = $1 WHERE "id" = $2`,
        [contentHash, version.id],
      );
    }
    await queryRunner.query(`
      UPDATE "prompt" prompt
      SET
        "workspaceId" = version."workspaceId",
        "draftContent" = version."content"
      FROM "prompt-version" version
      WHERE prompt."versionId" = version."id"
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt"
      ADD CONSTRAINT "FK_prompt_workspace"
        FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
        ON DELETE CASCADE,
      ADD CONSTRAINT "FK_prompt_draft_updated_by"
        FOREIGN KEY ("draftUpdatedByUserId") REFERENCES "user"("id")
        ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt-version"
      ADD CONSTRAINT "FK_prompt_version_prompt"
        FOREIGN KEY ("promptId") REFERENCES "prompt"("id")
        ON DELETE CASCADE,
      ADD CONSTRAINT "FK_prompt_version_base"
        FOREIGN KEY ("baseVersionId") REFERENCES "prompt-version"("id")
        ON DELETE SET NULL,
      ADD CONSTRAINT "FK_prompt_version_created_by_user"
        FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
        ON DELETE SET NULL
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
      CREATE TABLE "prompt_deployment" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL,
        "promptId" uuid NOT NULL,
        "versionId" uuid NOT NULL,
        "environment" varchar(30) NOT NULL,
        "agentId" uuid,
        "active" boolean NOT NULL DEFAULT true,
        "supersedesDeploymentId" uuid,
        "reason" text,
        "deployedAt" timestamptz NOT NULL DEFAULT now(),
        "deployedByUserId" uuid,
        "supersededAt" timestamptz,
        CONSTRAINT "PK_prompt_deployment" PRIMARY KEY ("id"),
        CONSTRAINT "FK_prompt_deployment_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_prompt_deployment_prompt"
          FOREIGN KEY ("promptId") REFERENCES "prompt"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_prompt_deployment_version"
          FOREIGN KEY ("versionId") REFERENCES "prompt-version"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_prompt_deployment_agent"
          FOREIGN KEY ("agentId") REFERENCES "agent"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_prompt_deployment_supersedes"
          FOREIGN KEY ("supersedesDeploymentId") REFERENCES "prompt_deployment"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_prompt_deployment_user"
          FOREIGN KEY ("deployedByUserId") REFERENCES "user"("id")
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompt_deployment_default_active"
      ON "prompt_deployment" ("workspaceId", "promptId", "environment")
      WHERE "active" = true AND "agentId" IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO "prompt_deployment" (
        "workspaceId",
        "promptId",
        "versionId",
        "environment",
        "active",
        "reason",
        "deployedAt",
        "deployedByUserId"
      )
      SELECT
        prompt."workspaceId",
        prompt."id",
        prompt."versionId",
        'production',
        true,
        'Migrated current prompt version',
        prompt."updatedAt",
        NULL
      FROM "prompt" prompt
      WHERE prompt."workspaceId" IS NOT NULL
        AND prompt."versionId" IS NOT NULL
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
      CREATE TABLE "prompt_experiment" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL,
        "promptId" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "environment" varchar(30) NOT NULL,
        "agentId" uuid,
        "variants" jsonb NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
        "assignmentSalt" varchar(64) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "createdByUserId" uuid NOT NULL,
        "startedAt" timestamptz,
        "endedAt" timestamptz,
        CONSTRAINT "PK_prompt_experiment" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_prompt_experiment_status"
          CHECK ("status" IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED')),
        CONSTRAINT "FK_prompt_experiment_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_prompt_experiment_prompt"
          FOREIGN KEY ("promptId") REFERENCES "prompt"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_prompt_experiment_agent"
          FOREIGN KEY ("agentId") REFERENCES "agent"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_prompt_experiment_user"
          FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
          ON DELETE RESTRICT
      )
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
    await queryRunner.query(`
      CREATE INDEX "IDX_event_prompt_version_ids"
      ON "event" USING GIN (("payload"->'promptVersionIds'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_event_prompt_version_ids"`);
    await queryRunner.query(`DROP TABLE "prompt_experiment"`);
    await queryRunner.query(`DROP TABLE "prompt_deployment"`);
    await queryRunner.query(`DROP INDEX "UQ_prompt_version_label"`);
    await queryRunner.query(`DROP INDEX "UQ_prompt_version_draft_revision"`);
    await queryRunner.query(`DROP INDEX "UQ_prompt_workspace_name_active"`);
    await queryRunner.query(`
      ALTER TABLE "prompt-version"
      DROP CONSTRAINT "FK_prompt_version_created_by_user",
      DROP CONSTRAINT "FK_prompt_version_base",
      DROP CONSTRAINT "FK_prompt_version_prompt",
      DROP COLUMN "createdByUserId",
      DROP COLUMN "draftRevision",
      DROP COLUMN "changeReason",
      DROP COLUMN "baseVersionId",
      DROP COLUMN "contentHash",
      DROP COLUMN "promptId"
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt"
      DROP CONSTRAINT "FK_prompt_draft_updated_by",
      DROP CONSTRAINT "FK_prompt_workspace",
      DROP COLUMN "deletedAt",
      DROP COLUMN "draftUpdatedByUserId",
      DROP COLUMN "draftRevision",
      DROP COLUMN "draftContent",
      DROP COLUMN "workspaceId"
    `);
  }
}
