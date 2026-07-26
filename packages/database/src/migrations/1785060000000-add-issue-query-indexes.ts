import type { MigrationInterface, QueryRunner } from "typeorm";

/** 이슈 평가 내역의 워크스페이스별 커서 조회를 위한 인덱스를 추가합니다. */
export class AddIssueQueryIndexes1785060000000 implements MigrationInterface {
  name = "AddIssueQueryIndexes1785060000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_issue_evaluation_matched_issue_created"
      ON "issue_evaluation" (
        "workspaceId",
        "matchedIssueId",
        "createdAt" DESC,
        "id" DESC
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_issue_evaluation_matched_issue_created"`,
    );
  }
}
