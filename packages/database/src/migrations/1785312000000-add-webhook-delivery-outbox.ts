import type { MigrationInterface, QueryRunner } from "typeorm";

/** Webhook 재시도와 전송 이력을 위한 영속 Outbox를 추가합니다. */
export class AddWebhookDeliveryOutbox1785312000000 implements MigrationInterface {
  name = "AddWebhookDeliveryOutbox1785312000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "webhook_delivery" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventId" uuid NOT NULL,
        "deduplicationKey" character varying(255) NOT NULL,
        "workspaceId" uuid NOT NULL,
        "policyId" bigint,
        "policyRevision" integer,
        "destinationUrl" character varying(2048) NOT NULL,
        "eventType" character varying(80) NOT NULL,
        "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "data" jsonb NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'PENDING',
        "attemptCount" integer NOT NULL DEFAULT 0,
        "maxAttempts" integer NOT NULL DEFAULT 8,
        "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lockedAt" TIMESTAMP WITH TIME ZONE,
        "lockedBy" character varying(120),
        "lastAttemptAt" TIMESTAMP WITH TIME ZONE,
        "responseStatus" integer,
        "lastError" character varying(1000),
        "deliveredAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_delivery" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_webhook_delivery_event_id" UNIQUE ("eventId"),
        CONSTRAINT "UQ_webhook_delivery_deduplication_key" UNIQUE ("deduplicationKey"),
        CONSTRAINT "FK_webhook_delivery_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_webhook_delivery_policy"
          FOREIGN KEY ("policyId") REFERENCES "firewall-policy"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_delivery_dispatch"
      ON "webhook_delivery" ("status", "nextAttemptAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_delivery_workspace_created"
      ON "webhook_delivery" ("workspaceId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_delivery_policy_created"
      ON "webhook_delivery" ("policyId", "createdAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "webhook_delivery"`);
  }
}
