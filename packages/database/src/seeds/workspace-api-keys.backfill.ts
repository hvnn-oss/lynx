import { createHash } from "crypto";
import { AppDataSource } from "../data-source";

interface WorkspaceApiKeyRow {
  id: string;
  apiKey: string;
}

async function backfillWorkspaceApiKeys() {
  await AppDataSource.initialize();

  try {
    await ensureWorkspaceApiKeyTable();

    const rows = (await AppDataSource.query(`
      SELECT "id", "apiKey"
      FROM "workspace"
      WHERE "apiKey" IS NOT NULL
        AND "apiKey" <> ''
    `)) as WorkspaceApiKeyRow[];

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const keyHash = hashApiKey(row.apiKey);
      const result = (await AppDataSource.query(
        `
          INSERT INTO "workspace_api_key"
            ("prefix", "keyHash", "name", "scopes", "workspaceId")
          VALUES
            ($1, $2, $3, ARRAY['events:write'], $4)
          ON CONFLICT ("keyHash") DO NOTHING
          RETURNING "id"
        `,
        [row.apiKey.slice(0, 16), keyHash, "Backfilled ingest key", row.id],
      )) as Array<{ id: string }>;

      if (result.length > 0) {
        inserted += 1;
      } else {
        skipped += 1;
      }
    }

    console.log(
      `Backfilled workspace API keys. inserted=${inserted}, skipped=${skipped}, scanned=${rows.length}`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

async function ensureWorkspaceApiKeyTable() {
  await AppDataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await AppDataSource.query(`
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

  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS "IDX_workspace_api_key_workspace_active"
    ON "workspace_api_key" ("workspaceId", "revokedAt")
  `);
}

function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

backfillWorkspaceApiKeys().catch((error: unknown) => {
  console.error("Failed to backfill workspace API keys.", error);
  process.exitCode = 1;
});
