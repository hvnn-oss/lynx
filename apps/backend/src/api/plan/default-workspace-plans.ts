import type { WorkspacePlanEntity } from '@repo/database';

export type DefaultWorkspacePlan = Pick<
  WorkspacePlanEntity,
  | 'code'
  | 'name'
  | 'retentionDays'
  | 'monthlyEventLimit'
  | 'includedLogCount'
  | 'logOverageUnitPrice'
  | 'features'
  | 'isActive'
>;

export const DEFAULT_WORKSPACE_PLANS: DefaultWorkspacePlan[] = [
  {
    code: 'FREE',
    name: 'Free',
    retentionDays: 3,
    monthlyEventLimit: 100_000,
    includedLogCount: 100_000,
    logOverageUnitPrice: 0,
    features: { demo: true, advancedDebug: false },
    isActive: true,
  },
  {
    code: 'PRO',
    name: 'Pro',
    retentionDays: 30,
    monthlyEventLimit: 5_000_000,
    includedLogCount: 5_000_000,
    logOverageUnitPrice: 0.000001,
    features: { demo: true, advancedDebug: true },
    isActive: true,
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    retentionDays: 365,
    monthlyEventLimit: undefined,
    includedLogCount: undefined,
    logOverageUnitPrice: undefined,
    features: { demo: true, advancedDebug: true, sso: true },
    isActive: true,
  },
];
