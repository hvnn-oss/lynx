import { AppDataSource } from "../data-source";
import { OrganizationPlanEntity } from "../entities/organization/organization-plan.entity";

const DEFAULT_ORGANIZATION_PLANS: Array<
  Omit<
    OrganizationPlanEntity,
    "id" | "organizations" | "createdAt" | "updatedAt"
  >
> = [
  {
    code: "FREE",
    name: "Free",
    maxWorkspaces: 1,
    maxMembers: 3,
    retentionDays: 3,
    monthlyEventLimit: 100_000,
    includedLogCount: 100_000,
    logOverageUnitPrice: 0,
    features: { demo: true, advancedDebug: false },
    isActive: true,
  },
  {
    code: "PRO",
    name: "Pro",
    maxWorkspaces: 5,
    maxMembers: 20,
    retentionDays: 30,
    monthlyEventLimit: 5_000_000,
    includedLogCount: 5_000_000,
    logOverageUnitPrice: 0.000001,
    features: { demo: true, advancedDebug: true },
    isActive: true,
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    maxWorkspaces: null,
    maxMembers: null,
    retentionDays: 365,
    monthlyEventLimit: null,
    includedLogCount: null,
    logOverageUnitPrice: null,
    features: { demo: true, advancedDebug: true, sso: true },
    isActive: true,
  },
];

async function seedOrganizationPlans() {
  await AppDataSource.initialize();
  try {
    const planRepository = AppDataSource.getRepository(OrganizationPlanEntity);
    for (const plan of DEFAULT_ORGANIZATION_PLANS) {
      const existingPlan = await planRepository.findOneBy({ code: plan.code });
      await planRepository.save(
        Object.assign(existingPlan ?? new OrganizationPlanEntity(), plan),
      );
    }
  } finally {
    await AppDataSource.destroy();
  }
}

seedOrganizationPlans().catch((error: unknown) => {
  console.error("Failed to seed organization plans.", error);
  process.exitCode = 1;
});
