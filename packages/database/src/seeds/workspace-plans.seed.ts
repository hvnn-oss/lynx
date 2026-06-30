import { AppDataSource } from "../data-source";
import { WorkspacePlanEntity } from "../entities/workspace/workspace-plan.entity";

const DEFAULT_WORKSPACE_PLANS: WorkspacePlanEntity[] = [
  {
    code: "FREE",
    name: "Free",
    retentionDays: 3,
    monthlyEventLimit: 100_000,
    includedLogCount: 100_000,
    logOverageUnitPrice: 0,
    maxMembers: undefined,
    features: { demo: true, advancedDebug: false },
    isActive: true,
    workspaces: [],
  },
  {
    code: "PRO",
    name: "Pro",
    retentionDays: 30,
    monthlyEventLimit: 5_000_000,
    includedLogCount: 5_000_000,
    logOverageUnitPrice: 0.000001,
    maxMembers: undefined,
    features: { demo: true, advancedDebug: true },
    isActive: true,
    workspaces: [],
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    retentionDays: 365,
    monthlyEventLimit: undefined,
    includedLogCount: undefined,
    logOverageUnitPrice: undefined,
    maxMembers: undefined,
    features: { demo: true, advancedDebug: true, sso: true },
    isActive: true,
    workspaces: [],
  },
];

async function seedWorkspacePlans() {
  await AppDataSource.initialize();

  try {
    await ensureWorkspacePlanTable();

    const planRepository = AppDataSource.getRepository(WorkspacePlanEntity);

    await planRepository.save(
      DEFAULT_WORKSPACE_PLANS.map((plan) =>
        Object.assign(new WorkspacePlanEntity(), plan),
      ),
    );

    if (await tableExists("workspace")) {
      // 플랜 테이블에 존재하지 않는 오래된 코드만 기본 플랜으로 보정합니다.
      await AppDataSource.query(`
        UPDATE "workspace"
        SET "plan" = 'FREE'
        WHERE "plan" IS NULL
           OR NOT EXISTS (
             SELECT 1
             FROM "workspace_plan"
             WHERE "workspace_plan"."code" = "workspace"."plan"
           )
      `);
    }

    console.log(
      `Seeded ${DEFAULT_WORKSPACE_PLANS.length} workspace plans: ${DEFAULT_WORKSPACE_PLANS.map(
        (plan) => plan.code,
      ).join(", ")}`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

async function ensureWorkspacePlanTable() {
  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS "workspace_plan" (
      "code" varchar(40) NOT NULL,
      "name" varchar NOT NULL,
      "retentionDays" integer NOT NULL DEFAULT 3,
      "monthlyEventLimit" integer,
      "includedLogCount" integer,
      "logOverageUnitPrice" numeric(12, 6),
      "maxMembers" integer,
      "features" jsonb NOT NULL DEFAULT '{}',
      "isActive" boolean NOT NULL DEFAULT true,
      CONSTRAINT "PK_workspace_plan_code" PRIMARY KEY ("code")
    )
  `);

  await AppDataSource.query(`
    ALTER TABLE "workspace_plan"
      ADD COLUMN IF NOT EXISTS "includedLogCount" integer,
      ADD COLUMN IF NOT EXISTS "logOverageUnitPrice" numeric(12, 6)
  `);
}

async function tableExists(tableName: string): Promise<boolean> {
  const result = (await AppDataSource.query(
    `SELECT to_regclass($1) AS "tableName"`,
    [tableName],
  )) as Array<{ tableName: string | null }>;

  return Boolean(result[0]?.tableName);
}

seedWorkspacePlans().catch((error: unknown) => {
  console.error("Failed to seed workspace plans.", error);
  process.exitCode = 1;
});
