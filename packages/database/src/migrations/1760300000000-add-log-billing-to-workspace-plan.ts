import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLogBillingToWorkspacePlan1760300000000 implements MigrationInterface {
  name = "AddLogBillingToWorkspacePlan1760300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_plan"
        ADD COLUMN IF NOT EXISTS "includedLogCount" integer,
        ADD COLUMN IF NOT EXISTS "logOverageUnitPrice" numeric(12, 6)
    `);

    await queryRunner.query(`
      UPDATE "workspace_plan"
      SET "includedLogCount" = COALESCE("includedLogCount", "monthlyEventLimit")
    `);

    await queryRunner.query(`
      UPDATE "workspace_plan"
      SET "maxMembers" = NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_plan"
        DROP COLUMN IF EXISTS "logOverageUnitPrice",
        DROP COLUMN IF EXISTS "includedLogCount"
    `);
  }
}
