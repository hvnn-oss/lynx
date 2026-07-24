import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrganizationPlans1784883600000
  implements MigrationInterface
{
  name = "AddOrganizationPlans1784883600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_plan" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(40) NOT NULL,
        "name" varchar NOT NULL,
        "maxWorkspaces" integer,
        "maxMembers" integer,
        "retentionDays" integer NOT NULL DEFAULT 3,
        "monthlyEventLimit" integer,
        "includedLogCount" integer,
        "logOverageUnitPrice" numeric(12, 6),
        "features" jsonb NOT NULL DEFAULT '{}',
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_organization_plan" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organization_plan_code" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "organization_plan" (
        "code",
        "name",
        "maxWorkspaces",
        "maxMembers",
        "retentionDays",
        "monthlyEventLimit",
        "includedLogCount",
        "logOverageUnitPrice",
        "features",
        "isActive"
      )
      VALUES
        ('FREE', 'Free', 1, 3, 3, 100000, 100000, 0,
          '{"demo":true,"advancedDebug":false}'::jsonb, true),
        ('PRO', 'Pro', 5, 20, 30, 5000000, 5000000, 0.000001,
          '{"demo":true,"advancedDebug":true}'::jsonb, true),
        ('ENTERPRISE', 'Enterprise', NULL, NULL, 365, NULL, NULL, NULL,
          '{"demo":true,"advancedDebug":true,"sso":true}'::jsonb, true)
      ON CONFLICT ("code") DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE "organization"
      ADD COLUMN IF NOT EXISTS "planId" uuid,
      ADD COLUMN IF NOT EXISTS "ownerUserId" uuid,
      ADD COLUMN IF NOT EXISTS "createdByUserId" uuid,
      ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      UPDATE "organization"
      SET "planId" = (
        SELECT "id"
        FROM "organization_plan"
        WHERE "code" = 'FREE'
      )
      WHERE "planId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "organization" AS organization
      SET
        "ownerUserId" = owner_membership."userId",
        "createdByUserId" = owner_membership."userId"
      FROM (
        SELECT DISTINCT ON ("organizationId")
          "organizationId",
          "userId"
        FROM "organization-user"
        WHERE "role" = 'OWNER'
        ORDER BY "organizationId", "joinedAt"
      ) AS owner_membership
      WHERE organization."id" = owner_membership."organizationId"
    `);

    const organizationsWithoutOwners = await queryRunner.query(`
      SELECT count(*)::int AS "count"
      FROM "organization"
      WHERE "ownerUserId" IS NULL OR "createdByUserId" IS NULL
    `);
    if (Number(organizationsWithoutOwners[0]?.count ?? 0) > 0) {
      throw new Error(
        "Cannot backfill organization owners: an organization has no OWNER membership",
      );
    }

    await queryRunner.query(`
      ALTER TABLE "organization"
      ALTER COLUMN "planId" SET NOT NULL,
      ALTER COLUMN "ownerUserId" SET NOT NULL,
      ALTER COLUMN "createdByUserId" SET NOT NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_organization_plan'
        ) THEN
          ALTER TABLE "organization"
          ADD CONSTRAINT "FK_organization_plan"
          FOREIGN KEY ("planId") REFERENCES "organization_plan"("id")
          ON DELETE RESTRICT;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_organization_owner'
        ) THEN
          ALTER TABLE "organization"
          ADD CONSTRAINT "FK_organization_owner"
          FOREIGN KEY ("ownerUserId") REFERENCES "user"("id")
          ON DELETE RESTRICT;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_organization_created_by'
        ) THEN
          ALTER TABLE "organization"
          ADD CONSTRAINT "FK_organization_created_by"
          FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
          ON DELETE RESTRICT;
        END IF;
      END
      $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization"
      DROP CONSTRAINT "FK_organization_created_by",
      DROP CONSTRAINT "FK_organization_owner",
      DROP CONSTRAINT "FK_organization_plan"
    `);
    await queryRunner.query(`
      ALTER TABLE "organization"
      DROP COLUMN "createdAt",
      DROP COLUMN "createdByUserId",
      DROP COLUMN "ownerUserId",
      DROP COLUMN "planId"
    `);
    await queryRunner.query(`DROP TABLE "organization_plan"`);
  }
}
