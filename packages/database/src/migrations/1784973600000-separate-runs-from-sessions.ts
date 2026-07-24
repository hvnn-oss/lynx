import type { MigrationInterface, QueryRunner } from "typeorm";

/** Run을 Session에서 분리하면서 기존 Event 데이터를 호환 backfill합니다. */
export class SeparateRunsFromSessions1784973600000 implements MigrationInterface {
  name = "SeparateRunsFromSessions1784973600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agent"
      ADD COLUMN "clientAgentId" varchar(255)
    `);
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "workspaceId", "name"
            ORDER BY "id"
          ) AS row_number
        FROM "agent"
      )
      UPDATE "agent" agent
      SET "clientAgentId" = agent."name"
      FROM ranked
      WHERE ranked."id" = agent."id" AND ranked.row_number = 1
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_agent_workspace_client_agent"
      ON "agent" ("workspaceId", "clientAgentId")
      WHERE "clientAgentId" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "session"
      ADD COLUMN "clientId" varchar(120),
      ADD COLUMN "clientSessionId" varchar(255)
    `);
    await queryRunner.query(`
      WITH source AS (
        SELECT "sessionId", MIN("clientId") AS "clientId"
        FROM "event"
        GROUP BY "sessionId"
      ),
      ranked AS (
        SELECT
          s."id",
          source."clientId",
          ROW_NUMBER() OVER (
            PARTITION BY s."workspaceId", source."clientId", s."name"
            ORDER BY s."id"
          ) AS row_number
        FROM "session" s
        JOIN source ON source."sessionId" = s."id"
      )
      UPDATE "session" s
      SET
        "clientId" = ranked."clientId",
        "clientSessionId" = s."name"
      FROM ranked
      WHERE ranked."id" = s."id" AND ranked.row_number = 1
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_session_workspace_client_session"
      ON "session" ("workspaceId", "clientId", "clientSessionId")
      WHERE "clientId" IS NOT NULL AND "clientSessionId" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "run" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "agentId" uuid NOT NULL,
        "clientId" varchar(120) NOT NULL,
        "clientRunId" varchar(255) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'RUNNING',
        "startedAt" timestamptz NOT NULL,
        "endedAt" timestamptz,
        "totalPromptTokens" integer NOT NULL DEFAULT 0,
        "totalCompletionTokens" integer NOT NULL DEFAULT 0,
        "totalTokens" integer NOT NULL DEFAULT 0,
        "totalCost" numeric(16, 6) NOT NULL DEFAULT 0,
        CONSTRAINT "PK_run" PRIMARY KEY ("id"),
        CONSTRAINT "FK_run_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_run_session"
          FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_run_agent"
          FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_run_workspace_client_run"
      ON "run" ("workspaceId", "clientId", "clientRunId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_run_workspace_started"
      ON "run" ("workspaceId", "startedAt" DESC, "id" DESC)
    `);

    await queryRunner.query(`
      INSERT INTO "run" (
        "workspaceId", "sessionId", "agentId", "clientId", "clientRunId",
        "status", "startedAt", "endedAt", "totalPromptTokens",
        "totalCompletionTokens", "totalTokens", "totalCost"
      )
      SELECT
        s."workspaceId",
        s."id",
        s."agentId",
        COALESCE(e."clientId", s."clientId", 'legacy'),
        COALESCE(e."clientRunId", s."name"),
        s."status",
        e."startedAt",
        CASE WHEN s."status" = 'RUNNING' THEN NULL ELSE e."endedAt" END,
        e."totalPromptTokens",
        e."totalCompletionTokens",
        e."totalTokens",
        e."totalCost"
      FROM "session" s
      JOIN (
        SELECT
          "sessionId",
          "clientId",
          COALESCE("payload"->>'runId', "payload"->>'sessionId') AS "clientRunId",
          MIN("timestamp") AS "startedAt",
          MAX("timestamp") AS "endedAt",
          SUM(
            CASE
              WHEN COALESCE("payload"->'usage'->>'promptTokens', '') ~ '^[0-9]+$'
              THEN ("payload"->'usage'->>'promptTokens')::integer
              ELSE 0
            END
          )::integer AS "totalPromptTokens",
          SUM(
            CASE
              WHEN COALESCE("payload"->'usage'->>'completionTokens', '') ~ '^[0-9]+$'
              THEN ("payload"->'usage'->>'completionTokens')::integer
              ELSE 0
            END
          )::integer AS "totalCompletionTokens",
          SUM(
            CASE
              WHEN COALESCE("payload"->'usage'->>'totalTokens', '') ~ '^[0-9]+$'
              THEN ("payload"->'usage'->>'totalTokens')::integer
              ELSE 0
            END
          )::integer AS "totalTokens",
          COALESCE(SUM("cost"), 0) AS "totalCost"
        FROM "event"
        GROUP BY
          "sessionId",
          "clientId",
          COALESCE("payload"->>'runId', "payload"->>'sessionId')
      ) e ON e."sessionId" = s."id"
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE "event" ADD COLUMN "runId" uuid
    `);
    await queryRunner.query(`
      UPDATE "event" e
      SET "runId" = r."id"
      FROM "session" s, "run" r
      WHERE
        e."sessionId" = s."id"
        AND r."sessionId" = s."id"
        AND r."clientId" = COALESCE(e."clientId", s."clientId", 'legacy')
        AND r."clientRunId" = COALESCE(e."payload"->>'runId', s."name")
    `);
    await queryRunner.query(`
      ALTER TABLE "event"
      ADD CONSTRAINT "FK_event_run"
      FOREIGN KEY ("runId") REFERENCES "run"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_event_run_client_event"
      ON "event" ("runId", "clientId", "clientEventId")
      WHERE "runId" IS NOT NULL AND "clientEventId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_event_run_timestamp"
      ON "event" ("runId", "timestamp", "createdAt", "id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_event_run_timestamp"`);
    await queryRunner.query(`DROP INDEX "UQ_event_run_client_event"`);
    await queryRunner.query(
      `ALTER TABLE "event" DROP CONSTRAINT "FK_event_run"`,
    );
    await queryRunner.query(`ALTER TABLE "event" DROP COLUMN "runId"`);
    await queryRunner.query(`DROP TABLE "run"`);
    await queryRunner.query(`DROP INDEX "UQ_session_workspace_client_session"`);
    await queryRunner.query(
      `ALTER TABLE "session" DROP COLUMN "clientSessionId", DROP COLUMN "clientId"`,
    );
    await queryRunner.query(`DROP INDEX "UQ_agent_workspace_client_agent"`);
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "clientAgentId"`);
  }
}
