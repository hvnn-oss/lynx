import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddFirewallPolicyManagement1785232800000 implements MigrationInterface {
  name = "AddFirewallPolicyManagement1785232800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "firewall-policy"
      ADD COLUMN "draftRevision" integer NOT NULL DEFAULT 1,
      ADD COLUMN "deployedRevision" integer,
      ADD COLUMN "deletedAt" timestamptz
    `);
    await queryRunner.query(`
      CREATE TABLE "firewall_policy_revision" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "policyId" bigint NOT NULL,
        "revision" integer NOT NULL,
        "version" varchar(40) NOT NULL,
        "name" varchar(120) NOT NULL,
        "description" text,
        "condition" text NOT NULL,
        "severity" varchar NOT NULL,
        "action" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "deployedAt" timestamptz,
        CONSTRAINT "PK_firewall_policy_revision" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_firewall_policy_revision"
          UNIQUE ("policyId", "revision"),
        CONSTRAINT "FK_firewall_policy_revision_policy"
          FOREIGN KEY ("policyId") REFERENCES "firewall-policy"("id")
          ON DELETE CASCADE
      )
    `);

    // 기존 활성 정책은 첫 번째 배포 리비전으로 승격해 동작을 유지합니다.
    await queryRunner.query(`
      INSERT INTO "firewall_policy_revision" (
        "policyId",
        "revision",
        "version",
        "name",
        "description",
        "condition",
        "severity",
        "action",
        "createdAt",
        "deployedAt"
      )
      SELECT
        "id",
        1,
        "version",
        "name",
        "description",
        "condition",
        "severity",
        "action",
        "updatedAt",
        CASE WHEN "activated" THEN now() ELSE NULL END
      FROM "firewall-policy"
    `);
    await queryRunner.query(`
      UPDATE "firewall-policy"
      SET "deployedRevision" = 1
      WHERE "activated" = true
    `);

    await queryRunner.query(`
      ALTER TABLE "firewall-violation"
      ALTER COLUMN "reasonId" DROP NOT NULL,
      ADD COLUMN "workspaceId" uuid,
      ADD COLUMN "eventId" uuid,
      ADD COLUMN "reportedPolicyId" varchar(255),
      ADD COLUMN "toolName" varchar(255),
      ADD COLUMN "severity" varchar(20),
      ADD COLUMN "message" text,
      ADD COLUMN "evidence" jsonb
    `);
    await queryRunner.query(`
      UPDATE "firewall-violation" violation
      SET "workspaceId" = policy."workspaceId"
      FROM "firewall-policy" policy
      WHERE violation."reasonId" = policy."id"
    `);
    await queryRunner.query(`
      ALTER TABLE "firewall-violation"
      ALTER COLUMN "workspaceId" SET NOT NULL,
      ADD CONSTRAINT "FK_firewall_violation_workspace"
        FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
        ON DELETE CASCADE,
      ADD CONSTRAINT "FK_firewall_violation_event"
        FOREIGN KEY ("eventId") REFERENCES "event"("id")
        ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_firewall_violation_event"
      ON "firewall-violation" ("eventId")
      WHERE "eventId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_firewall_violation_workspace_created"
      ON "firewall-violation" ("workspaceId", "createdAt" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_firewall_violation_workspace_created"`,
    );
    await queryRunner.query(`DROP INDEX "UQ_firewall_violation_event"`);
    await queryRunner.query(`
      ALTER TABLE "firewall-violation"
      DROP CONSTRAINT "FK_firewall_violation_event",
      DROP CONSTRAINT "FK_firewall_violation_workspace",
      DROP COLUMN "evidence",
      DROP COLUMN "message",
      DROP COLUMN "severity",
      DROP COLUMN "toolName",
      DROP COLUMN "reportedPolicyId",
      DROP COLUMN "eventId",
      DROP COLUMN "workspaceId"
    `);
    await queryRunner.query(`DROP TABLE "firewall_policy_revision"`);
    await queryRunner.query(`
      ALTER TABLE "firewall-policy"
      DROP COLUMN "deletedAt",
      DROP COLUMN "deployedRevision",
      DROP COLUMN "draftRevision"
    `);
  }
}
