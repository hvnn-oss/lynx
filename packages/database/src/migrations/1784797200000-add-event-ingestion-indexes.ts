import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventIngestionIndexes1784797200000
  implements MigrationInterface
{
  name = "AddEventIngestionIndexes1784797200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_event_workspace_client_event"
      ON "event" ("sessionId", "clientId", "clientEventId")
      WHERE "clientEventId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_event_session_timestamp"
      ON "event" ("sessionId", "timestamp", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_session_workspace_started"
      ON "session" ("workspaceId", "startedAt" DESC, "id" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_session_workspace_started"`);
    await queryRunner.query(`DROP INDEX "IDX_event_session_timestamp"`);
    await queryRunner.query(`DROP INDEX "UQ_event_workspace_client_event"`);
  }
}
