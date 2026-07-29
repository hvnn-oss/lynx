import type { MigrationInterface, QueryRunner } from "typeorm";

/** 작은 LLM 호출 비용도 반올림으로 유실되지 않도록 비용 컬럼 정밀도를 높입니다. */
export class ImproveCostPrecision1785225600000 implements MigrationInterface {
  name = "ImproveCostPrecision1785225600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event"
      ALTER COLUMN "cost" TYPE numeric(20, 12)
      USING "cost"::numeric
    `);
    await queryRunner.query(`
      ALTER TABLE "run"
      ALTER COLUMN "totalCost" TYPE numeric(20, 12)
      USING "totalCost"::numeric
    `);
    await queryRunner.query(`
      ALTER TABLE "session"
      ALTER COLUMN "totalCost" TYPE numeric(20, 12)
      USING "totalCost"::numeric
    `);
    await queryRunner.query(`
      ALTER TABLE "session"
      ALTER COLUMN "totalCost" SET DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "session"
      ALTER COLUMN "totalCost" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "session"
      ALTER COLUMN "totalCost" TYPE integer
      USING ROUND("totalCost")::integer
    `);
    await queryRunner.query(`
      ALTER TABLE "run"
      ALTER COLUMN "totalCost" TYPE numeric(16, 6)
      USING "totalCost"::numeric(16, 6)
    `);
    await queryRunner.query(`
      ALTER TABLE "event"
      ALTER COLUMN "cost" TYPE numeric(10, 6)
      USING "cost"::numeric(10, 6)
    `);
  }
}
