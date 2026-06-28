import { MigrationInterface, QueryRunner } from "typeorm";

export class AddObservabilityIndexes1760000000000 implements MigrationInterface {
  name = "AddObservabilityIndexes1760000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_workspace_api_key" ON "workspace" ("apiKey") WHERE "apiKey" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_workspace_name" ON "agent" ("workspaceId", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_session_workspace_name" ON "session" ("workspaceId", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_session_workspace_started_at" ON "session" ("workspaceId", "startedAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_session_workspace_status_started_at" ON "session" ("workspaceId", "status", "startedAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_session_agent_started_at" ON "session" ("agentId", "startedAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_event_session_timestamp" ON "event" ("sessionId", "timestamp" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_event_type_timestamp" ON "event" ("eventType", "timestamp" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_event_timestamp" ON "event" ("timestamp" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_event_created_at" ON "event" ("createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_event_payload_span_id" ON "event" ((payload->>'spanId')) WHERE payload ? 'spanId'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_event_payload_parent_span_id" ON "event" ((payload->>'parentSpanId')) WHERE payload ? 'parentSpanId'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_event_payload_parent_span_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_payload_span_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_timestamp"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_type_timestamp"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_event_session_timestamp"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_session_agent_started_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_session_workspace_status_started_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_session_workspace_started_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_session_workspace_name"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agent_workspace_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workspace_api_key"`);
  }
}
