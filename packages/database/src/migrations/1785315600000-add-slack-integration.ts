import type { MigrationInterface, QueryRunner } from "typeorm";

/** Slack 설정과 provider별 Webhook Outbox 구분을 추가합니다. */
export class AddSlackIntegration1785315600000 implements MigrationInterface {
  name = "AddSlackIntegration1785315600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "webhook_delivery"
      ADD COLUMN "provider" character varying(24) NOT NULL DEFAULT 'GENERIC'
    `);
    await queryRunner.query(`
      ALTER TABLE "webhook_delivery"
      ALTER COLUMN "destinationUrl" TYPE text
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_delivery_workspace_provider_created"
      ON "webhook_delivery" ("workspaceId", "provider", "createdAt")
    `);
    await queryRunner.query(`
      CREATE TABLE "slack_integration" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "webhookUrlCiphertext" text NOT NULL,
        "displayName" character varying(80),
        "isEnabled" boolean NOT NULL DEFAULT true,
        "eventTypes" jsonb NOT NULL,
        "updatedByUserId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_slack_integration" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_slack_integration_workspace" UNIQUE ("workspaceId"),
        CONSTRAINT "FK_slack_integration_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "slack_integration"`);
    await queryRunner.query(
      `DROP INDEX "IDX_webhook_delivery_workspace_provider_created"`,
    );
    await queryRunner.query(
      `DELETE FROM "webhook_delivery" WHERE "provider" = 'SLACK'`,
    );
    await queryRunner.query(`
      ALTER TABLE "webhook_delivery"
      ALTER COLUMN "destinationUrl" TYPE character varying(2048)
    `);
    await queryRunner.query(
      `ALTER TABLE "webhook_delivery" DROP COLUMN "provider"`,
    );
  }
}
