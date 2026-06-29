import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DashboardService } from '../dashboard/dashboard.service';
import { DemoController } from './demo.controller';

describe('DemoController', () => {
  const dashboardService = {
    getDemoCostMetrics: jest.fn(),
    getDemoHomeMetrics: jest.fn(),
    getDemoInsights: jest.fn(),
    getDemoMetricsData: jest.fn(),
    getDemoStatusMetrics: jest.fn(),
    getDemoUsageMetrics: jest.fn(),
  } as unknown as DashboardService;

  it('returns demo workspaces when demo data is enabled', () => {
    const controller = new DemoController(dashboardService, {
      get: jest.fn(() => 'true'),
    } as unknown as ConfigService);

    expect(controller.getWorkspaces()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Production',
          organization: expect.objectContaining({
            name: 'Lynx Demo Organization',
          }),
        }),
      ]),
    );
  });

  it('returns debug root cause demo data when demo data is enabled', () => {
    const controller = new DemoController(dashboardService, {
      get: jest.fn(() => 'true'),
    } as unknown as ConfigService);

    expect(controller.getDebugRootCause('session-1')).toMatchObject({
      sessionId: 'session-1',
      primaryCandidateId: 'candidate-1',
      candidates: [
        expect.objectContaining({
          category: 'TOOL',
          severity: 'CRITICAL',
        }),
      ],
    });
  });

  it('hides demo endpoints when demo data is disabled', () => {
    const controller = new DemoController(dashboardService, {
      get: jest.fn(() => 'false'),
    } as unknown as ConfigService);

    expect(() => controller.getOrganizations()).toThrow(NotFoundException);
  });
});
