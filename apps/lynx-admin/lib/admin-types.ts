export interface AdminMe {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export interface AdminPlan {
  code: string;
  name: string;
  retentionDays: number;
  monthlyEventLimit?: number;
  includedLogCount?: number;
  logOverageUnitPrice?: number;
  features: Record<string, unknown>;
  isActive: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AdminOrganization {
  id: string;
  name: string;
  useSso: boolean;
  forceSSO: boolean;
  oidcIssuer?: string;
  oidcClientId?: string;
  memberCount: number;
  workspaceCount: number;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  plan: string;
  organization: {
    id: string;
    name: string;
  };
  planConfig?: AdminPlan;
}

export interface AdminOrganizationSearchItem extends AdminOrganization {
  workspaces: AdminWorkspace[];
}

export interface AdminOrganizationSearchResponse {
  query: string;
  limit: number;
  organizations: AdminOrganizationSearchItem[];
}

export interface AdminDashboard {
  me: AdminMe;
  counts: {
    plans: number;
    users: number;
    organizations: number;
    workspaces: number;
  };
  plans: AdminPlan[];
  users: AdminUser[];
  organizations: AdminOrganization[];
  workspaces: AdminWorkspace[];
}

export interface AdminUpdatePlan {
  name: string;
  retentionDays: number;
  monthlyEventLimit?: number;
  includedLogCount?: number;
  logOverageUnitPrice?: number;
  features: Record<string, unknown>;
  isActive: boolean;
}

export interface AdminCreatePlan extends AdminUpdatePlan {
  code: string;
}

export interface AdminUpdateUser {
  email: string;
  name: string;
}

export interface AdminUpdateOrganization {
  name: string;
  useSso: boolean;
  forceSSO: boolean;
  oidcIssuer?: string;
  oidcClientId?: string;
}

export interface AdminUpdateWorkspace {
  name: string;
  organizationId: string;
  plan: string;
}
