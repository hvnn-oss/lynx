import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceApiKeyAuditColumns1760500000000
  implements MigrationInterface
{
  name = "AddWorkspaceApiKeyAuditColumns1760500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_api_key"
        ADD COLUMN IF NOT EXISTS "createdByUserId" uuid,
        ADD COLUMN IF NOT EXISTS "createdByName" varchar(120)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_api_key"
        DROP COLUMN IF EXISTS "createdByName",
        DROP COLUMN IF EXISTS "createdByUserId"
    `);
  }
}
