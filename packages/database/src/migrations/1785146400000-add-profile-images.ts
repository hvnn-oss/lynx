import type { MigrationInterface, QueryRunner } from "typeorm";

/** 사용자와 조직이 객체 저장소의 프로필 이미지 키를 보관할 수 있게 합니다. */
export class AddProfileImages1785146400000 implements MigrationInterface {
  name = "AddProfileImages1785146400000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN "profileImageKey" varchar(500)
    `);
    await queryRunner.query(`
      ALTER TABLE "organization"
      ADD COLUMN "profileImageKey" varchar(500)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organization"
      DROP COLUMN "profileImageKey"
    `);
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN "profileImageKey"
    `);
  }
}
