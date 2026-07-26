import type { DashboardOverviewResponseDto } from "@repo/dto";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import {
  AccessControlService,
  accessControlService,
} from "../../common/access-control/access-control.service.js";
import {
  DashboardRepository,
  dashboardRepository,
} from "./dashboard.repository.js";

/** Builds the bounded operational summary used by the dashboard first screen. */
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository = dashboardRepository,
    private readonly accessControl: AccessControlService = accessControlService,
  ) {}

  async getOverview(
    userId: string,
    workspaceId: string,
  ): Promise<DashboardOverviewResponseDto> {
    await this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_READ,
    });

    const [kpis, issueTrend, importantIssues] = await Promise.all([
      this.repository.getKpis(workspaceId),
      this.repository.getIssueTrend(workspaceId),
      this.repository.getImportantIssues(workspaceId),
    ]);
    const runCount = Number(kpis.runCount);
    const issueCount = Number(kpis.issueCount);

    return {
      hasData: runCount > 0 || issueCount > 0,
      kpis: {
        criticalIssues: Number(kpis.criticalIssues),
        warningIssues: Number(kpis.warningIssues),
        firewallBlocked: Number(kpis.firewallBlocked),
        normalThroughputRate:
          runCount === 0
            ? 0
            : Math.round((Number(kpis.completedRunCount) / runCount) * 1_000) /
              10,
      },
      issueTrend: issueTrend.map((bucket) => ({
        date: bucket.date,
        count: Number(bucket.count),
      })),
      importantIssues,
    };
  }
}

export const dashboardService = new DashboardService();
