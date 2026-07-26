import type { AccessControlService } from "../../common/access-control/access-control.service.js";
import type { DashboardRepository } from "./dashboard.repository.js";
import { DashboardService } from "./dashboard.service.js";

function createService(input?: {
  runCount?: string;
  completedRunCount?: string;
  issueCount?: string;
}) {
  const repository = {
    getKpis: jest.fn().mockResolvedValue({
      runCount: input?.runCount ?? "10",
      completedRunCount: input?.completedRunCount ?? "9",
      issueCount: input?.issueCount ?? "3",
      criticalIssues: "1",
      warningIssues: "2",
      firewallBlocked: "4",
    }),
    getIssueTrend: jest
      .fn()
      .mockResolvedValue([{ date: "2026-07-25", count: "3" }]),
    getImportantIssues: jest.fn().mockResolvedValue([
      {
        id: "7ac20620-a9e6-40a2-9e32-2af7fe32e553",
        title: "Firewall blocked a risky action",
        severity: "CRITICAL",
      },
    ]),
  } as unknown as DashboardRepository;
  const accessControl = {
    assertWorkspaceCapability: jest.fn().mockResolvedValue({}),
  } as unknown as AccessControlService;

  return {
    service: new DashboardService(repository, accessControl),
    repository,
    accessControl,
  };
}

describe("DashboardService", () => {
  it("returns a bounded overview and computes the completion rate", async () => {
    const { service, accessControl } = createService();

    const result = await service.getOverview("user-1", "workspace-1");

    expect(result).toEqual({
      hasData: true,
      kpis: {
        criticalIssues: 1,
        warningIssues: 2,
        firewallBlocked: 4,
        normalThroughputRate: 90,
      },
      issueTrend: [{ date: "2026-07-25", count: 3 }],
      importantIssues: [
        {
          id: "7ac20620-a9e6-40a2-9e32-2af7fe32e553",
          title: "Firewall blocked a risky action",
          severity: "CRITICAL",
        },
      ],
    });
    expect(accessControl.assertWorkspaceCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        workspaceId: "workspace-1",
      }),
    );
  });

  it("marks the response empty when the workspace has no runs or issues", async () => {
    const { service } = createService({
      runCount: "0",
      completedRunCount: "0",
      issueCount: "0",
    });

    const result = await service.getOverview("user-1", "workspace-1");

    expect(result.hasData).toBe(false);
    expect(result.kpis.normalThroughputRate).toBe(0);
  });
});
