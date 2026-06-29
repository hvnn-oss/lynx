import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdminManagementTables1760200000000
  implements MigrationInterface
{
  name = "AddAdminManagementTables1760200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_user" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "role" varchar NOT NULL DEFAULT 'ADMIN',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        CONSTRAINT "PK_admin_user_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_admin_user_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_admin_user_user"
          FOREIGN KEY ("userId") REFERENCES "user"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actorUserId" varchar NOT NULL,
        "action" varchar NOT NULL,
        "targetType" varchar NOT NULL,
        "targetId" varchar NOT NULL,
        "before" jsonb,
        "after" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_audit_log_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_log_actor_created"
      ON "admin_audit_log" ("actorUserId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_log_target"
      ON "admin_audit_log" ("targetType", "targetId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_audit_log_target"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_admin_audit_log_actor_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_user"`);
  }
}
