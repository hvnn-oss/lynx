import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddPilotAccessControl1785398400000
  implements MigrationInterface
{
  name = "AddPilotAccessControl1785398400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "product_access_grant" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subjectType" character varying NOT NULL,
        "subjectId" uuid NOT NULL,
        "capability" character varying NOT NULL DEFAULT 'LYNX_CORE',
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "grantedByUserId" uuid,
        "grantedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_access_grant" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_access_grant_subject_capability"
      ON "product_access_grant" ("subjectType", "subjectId", "capability")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_product_access_grant_lookup"
      ON "product_access_grant" ("subjectType", "subjectId", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE "access_invitation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(320) NOT NULL,
        "tokenHash" character(64) NOT NULL,
        "targetType" character varying NOT NULL DEFAULT 'PRODUCT',
        "targetId" uuid,
        "role" character varying,
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "invitedByUserId" uuid NOT NULL,
        "acceptedByUserId" uuid,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "acceptedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_invitation" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_access_invitation_token_hash" UNIQUE ("tokenHash")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_access_invitation_email_status"
      ON "access_invitation" ("email", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_access_invitation_created"
      ON "access_invitation" ("createdAt", "id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_access_invitation_pending_email"
      ON "access_invitation" (LOWER("email"))
      WHERE "status" = 'PENDING'
    `);

    // 기존 개발 계정과 Workspace는 배포 직후 접근이 끊기지 않도록 승인 상태로 승계합니다.
    await queryRunner.query(`
      INSERT INTO "product_access_grant"
        ("subjectType", "subjectId", "capability", "status", "grantedAt", "metadata")
      SELECT 'USER', "id", 'LYNX_CORE', 'ACTIVE', now(), '{"source":"migration"}'::jsonb
      FROM "user"
      ON CONFLICT ("subjectType", "subjectId", "capability") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "product_access_grant"
        ("subjectType", "subjectId", "capability", "status", "grantedAt", "metadata")
      SELECT 'WORKSPACE', "id", 'LYNX_CORE', 'ACTIVE', now(), '{"source":"migration"}'::jsonb
      FROM "workspace"
      ON CONFLICT ("subjectType", "subjectId", "capability") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_access_invitation_pending_email"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_access_invitation_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_access_invitation_email_status"`,
    );
    await queryRunner.query(`DROP TABLE "access_invitation"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_product_access_grant_lookup"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_product_access_grant_subject_capability"`,
    );
    await queryRunner.query(`DROP TABLE "product_access_grant"`);
  }
}
