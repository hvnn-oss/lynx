import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspacePlanTable1760100000000 implements MigrationInterface {
  name = "AddWorkspacePlanTable1760100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_plan" (
        "code" varchar(40) NOT NULL,
        "name" varchar NOT NULL,
        "retentionDays" integer NOT NULL DEFAULT 3,
        "monthlyEventLimit" integer,
        "includedLogCount" integer,
        "logOverageUnitPrice" numeric(12, 6),
        "maxMembers" integer,
        "features" jsonb NOT NULL DEFAULT '{}',
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_workspace_plan_code" PRIMARY KEY ("code")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "workspace_plan"
        ("code", "name", "retentionDays", "monthlyEventLimit", "includedLogCount", "logOverageUnitPrice", "maxMembers", "features", "isActive")
      VALUES
        ('FREE', 'Free', 3, 100000, 100000, 0, NULL, '{"demo": true, "advancedDebug": false}', true),
        ('PRO', 'Pro', 30, 5000000, 5000000, 0.000001, NULL, '{"demo": true, "advancedDebug": true}', true),
        ('ENTERPRISE', 'Enterprise', 365, NULL, NULL, NULL, NULL, '{"demo": true, "advancedDebug": true, "sso": true}', true)
      ON CONFLICT ("code") DO UPDATE SET
        "name" = EXCLUDED."name",
        "retentionDays" = EXCLUDED."retentionDays",
        "monthlyEventLimit" = EXCLUDED."monthlyEventLimit",
        "includedLogCount" = EXCLUDED."includedLogCount",
        "logOverageUnitPrice" = EXCLUDED."logOverageUnitPrice",
        "maxMembers" = EXCLUDED."maxMembers",
        "features" = EXCLUDED."features",
        "isActive" = EXCLUDED."isActive"
    `);

    await queryRunner.query(`
      UPDATE "workspace"
      SET "plan" = 'FREE'
      WHERE "plan" IS NULL
         OR "plan" NOT IN ('FREE', 'PRO', 'ENTERPRISE')
    `);

    await queryRunner.query(`
      ALTER TABLE "workspace" DROP CONSTRAINT IF EXISTS "FK_workspace_plan"
    `);

    await queryRunner.query(`
      ALTER TABLE "workspace"
      ADD CONSTRAINT "FK_workspace_plan"
      FOREIGN KEY ("plan") REFERENCES "workspace_plan"("code")
      ON UPDATE CASCADE
      ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace" DROP CONSTRAINT IF EXISTS "FK_workspace_plan"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_plan"`);
  }
}
