import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddScopedApiKeyAuthorization1784710800000
  implements MigrationInterface
{
  name = "AddScopedApiKeyAuthorization1784710800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_api_key"
      ADD COLUMN "kind" varchar(20) NOT NULL DEFAULT 'INGEST'
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_api_key"
      ADD CONSTRAINT "CHK_workspace_api_key_kind"
      CHECK ("kind" IN ('INGEST', 'SDK', 'AUTOMATION'))
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_api_key"
      ADD CONSTRAINT "FK_workspace_api_key_created_by"
      FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "workspace_membership" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" varchar(20) NOT NULL DEFAULT 'MEMBER',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "createdByUserId" uuid,
        CONSTRAINT "PK_workspace_membership" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_workspace_membership_workspace_user"
          UNIQUE ("workspaceId", "userId"),
        CONSTRAINT "CHK_workspace_membership_role"
          CHECK ("role" IN ('ADMIN', 'MEMBER', 'VIEWER')),
        CONSTRAINT "FK_workspace_membership_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_workspace_membership_user"
          FOREIGN KEY ("userId") REFERENCES "user"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_workspace_membership_created_by"
          FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_workspace_membership_user"
      ON "workspace_membership" ("userId")
    `);

  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_workspace_membership_user"`);
    await queryRunner.query(`DROP TABLE "workspace_membership"`);
    await queryRunner.query(`
      ALTER TABLE "workspace_api_key"
      DROP CONSTRAINT "FK_workspace_api_key_created_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_api_key"
      DROP CONSTRAINT "CHK_workspace_api_key_kind"
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_api_key"
      DROP COLUMN "kind"
    `);
  }
}
