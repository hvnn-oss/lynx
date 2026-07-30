import type { MigrationInterface, QueryRunner } from "typeorm";

/** 제품 초대에 첫 조직에 적용할 요금제를 저장합니다. */
export class AddAccessInvitationOrganizationPlan1785398400000
  implements MigrationInterface
{
  name = "AddAccessInvitationOrganizationPlan1785398400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "access_invitation"
      ADD COLUMN "organizationPlanId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "access_invitation"
      ADD CONSTRAINT "FK_access_invitation_organization_plan"
      FOREIGN KEY ("organizationPlanId")
      REFERENCES "organization_plan"("id")
      ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "access_invitation"
      DROP CONSTRAINT "FK_access_invitation_organization_plan"
    `);
    await queryRunner.query(`
      ALTER TABLE "access_invitation"
      DROP COLUMN "organizationPlanId"
    `);
  }
}
