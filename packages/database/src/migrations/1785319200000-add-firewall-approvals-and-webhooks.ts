import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddFirewallApprovalsAndWebhooks1785319200000 implements MigrationInterface {
  name = "AddFirewallApprovalsAndWebhooks1785319200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "firewall-policy"
      ADD COLUMN "webhookUrl" varchar(2048)
    `);
    await queryRunner.query(`
      ALTER TABLE "firewall_policy_revision"
      ADD COLUMN "webhookUrl" varchar(2048)
    `);
    await queryRunner.query(`
      CREATE TABLE "firewall_approval_request" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" uuid NOT NULL,
        "policyId" bigint,
        "reportedPolicyId" varchar(255),
        "sdkInstanceId" varchar(120) NOT NULL,
        "clientRequestId" varchar(160) NOT NULL,
        "runId" varchar(255) NOT NULL,
        "sessionId" varchar(255) NOT NULL,
        "agentId" varchar(255) NOT NULL,
        "toolName" varchar(255) NOT NULL,
        "inputHash" varchar(64) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "requestReason" text,
        "requestedAt" timestamptz NOT NULL DEFAULT now(),
        "expiresAt" timestamptz NOT NULL,
        "decidedAt" timestamptz,
        "decidedByUserId" uuid,
        "decisionReason" text,
        CONSTRAINT "PK_firewall_approval_request" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_firewall_approval_client_request"
          UNIQUE ("workspaceId", "sdkInstanceId", "clientRequestId"),
        CONSTRAINT "CHK_firewall_approval_status"
          CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
        CONSTRAINT "FK_firewall_approval_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_firewall_approval_policy"
          FOREIGN KEY ("policyId") REFERENCES "firewall-policy"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_firewall_approval_decided_by"
          FOREIGN KEY ("decidedByUserId") REFERENCES "user"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_firewall_approval_workspace_status"
      ON "firewall_approval_request"
      ("workspaceId", "status", "requestedAt" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "firewall_approval_request"`);
    await queryRunner.query(`
      ALTER TABLE "firewall_policy_revision" DROP COLUMN "webhookUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "firewall-policy" DROP COLUMN "webhookUrl"
    `);
  }
}
