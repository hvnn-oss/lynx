import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceApiKeyAndEventIdempotency1760400000000 implements MigrationInterface {
  name = "AddWorkspaceApiKeyAndEventIdempotency1760400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_api_key" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "prefix" varchar(24) NOT NULL,
        "keyHash" varchar(64) NOT NULL,
        "name" varchar(120),
        "scopes" text[] NOT NULL DEFAULT ARRAY['events:write'],
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "lastUsedAt" timestamp,
        "revokedAt" timestamp,
        "expiresAt" timestamp,
        "workspaceId" uuid,
        CONSTRAINT "PK_workspace_api_key_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_workspace_api_key_hash" UNIQUE ("keyHash"),
        CONSTRAINT "FK_workspace_api_key_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workspace_api_key_workspace_active"
      ON "workspace_api_key" ("workspaceId", "revokedAt")
    `);

    await queryRunner.query(`
      ALTER TABLE "event"
        ADD COLUMN IF NOT EXISTS "clientId" varchar(120),
        ADD COLUMN IF NOT EXISTS "clientEventId" varchar(120),
        ADD COLUMN IF NOT EXISTS "schemaVersion" varchar(40)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_event_client_event"
      ON "event" ("clientId", "clientEventId")
      WHERE "clientEventId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_event_client_event"`);
    await queryRunner.query(`
      ALTER TABLE "event"
        DROP COLUMN IF EXISTS "schemaVersion",
        DROP COLUMN IF EXISTS "clientEventId",
        DROP COLUMN IF EXISTS "clientId"
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_workspace_api_key_workspace_active"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_api_key"`);
  }
}
