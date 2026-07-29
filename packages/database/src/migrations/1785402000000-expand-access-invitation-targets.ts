import type { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandAccessInvitationTargets1785402000000
  implements MigrationInterface
{
  name = "ExpandAccessInvitationTargets1785402000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_access_invitation_pending_email"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_access_invitation_pending_target"
      ON "access_invitation" (
        LOWER("email"),
        "targetType",
        COALESCE("targetId", '00000000-0000-0000-0000-000000000000'::uuid)
      )
      WHERE "status" = 'PENDING'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_access_invitation_pending_target"`,
    );
    // 이전 스키마는 이메일당 대기 초대를 하나만 허용하므로 최신 초대만 남깁니다.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT "id",
          ROW_NUMBER() OVER (
            PARTITION BY LOWER("email")
            ORDER BY "createdAt" DESC, "id" DESC
          ) AS row_number
        FROM "access_invitation"
        WHERE "status" = 'PENDING'
      )
      UPDATE "access_invitation" AS invitation
      SET "status" = 'REVOKED', "updatedAt" = now()
      FROM ranked
      WHERE invitation."id" = ranked."id"
        AND ranked.row_number > 1
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_access_invitation_pending_email"
      ON "access_invitation" (LOWER("email"))
      WHERE "status" = 'PENDING'
    `);
  }
}
