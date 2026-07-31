import type { MigrationInterface, QueryRunner } from "typeorm";

/** Adds exact per-Run prompt experiment exposure records for reliable metrics. */
export class AddPromptExperimentExposure1785484800000 implements MigrationInterface {
  name = "AddPromptExperimentExposure1785484800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "prompt_experiment_exposure" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "experimentId" uuid NOT NULL,
        "promptId" uuid NOT NULL,
        "promptVersionId" uuid NOT NULL,
        "runId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "agentId" uuid NOT NULL,
        "environment" character varying(30) NOT NULL,
        "bucket" smallint NOT NULL,
        "runtimeConfigRevision" character varying(255) NOT NULL,
        "exposedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prompt_experiment_exposure" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_prompt_experiment_exposure_bucket"
          CHECK ("bucket" >= 0 AND "bucket" <= 99)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompt_experiment_exposure_run"
      ON "prompt_experiment_exposure" ("experimentId", "runId", "promptId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_prompt_experiment_exposure_metrics"
      ON "prompt_experiment_exposure" (
        "workspaceId",
        "experimentId",
        "promptVersionId",
        "exposedAt"
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt_experiment_exposure"
      ADD CONSTRAINT "FK_prompt_experiment_exposure_workspace"
      FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt_experiment_exposure"
      ADD CONSTRAINT "FK_prompt_experiment_exposure_experiment"
      FOREIGN KEY ("experimentId") REFERENCES "prompt_experiment"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt_experiment_exposure"
      ADD CONSTRAINT "FK_prompt_experiment_exposure_prompt"
      FOREIGN KEY ("promptId") REFERENCES "prompt"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt_experiment_exposure"
      ADD CONSTRAINT "FK_prompt_experiment_exposure_version"
      FOREIGN KEY ("promptVersionId") REFERENCES "prompt-version"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt_experiment_exposure"
      ADD CONSTRAINT "FK_prompt_experiment_exposure_run"
      FOREIGN KEY ("runId") REFERENCES "run"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt_experiment_exposure"
      ADD CONSTRAINT "FK_prompt_experiment_exposure_session"
      FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "prompt_experiment_exposure"
      ADD CONSTRAINT "FK_prompt_experiment_exposure_agent"
      FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "prompt_experiment_exposure"`);
  }
}
