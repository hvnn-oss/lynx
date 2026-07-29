import type {
  DashboardBootstrapResponseDto,
  UserProfileResponseDto,
} from "@repo/dto";
import { create } from "zustand";

type Organization = DashboardBootstrapResponseDto["organizations"][number];
type Workspace = DashboardBootstrapResponseDto["workspaces"][number];
type ProductAccess = DashboardBootstrapResponseDto["access"];

interface UserStoreState {
  user: UserProfileResponseDto | null;
  access: ProductAccess | null;
  organizations: Organization[];
  workspaces: Workspace[];
  activeOrganizationId: string | null;
  activeWorkspaceId: string | null;
  setContext: (context: DashboardBootstrapResponseDto) => void;
  setActiveOrganization: (organizationId: string) => void;
  updateUser: (user: UserProfileResponseDto) => void;
  updateOrganization: (organization: Organization) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  access: null as ProductAccess | null,
  organizations: [] as Organization[],
  workspaces: [] as Workspace[],
  activeOrganizationId: null,
  activeWorkspaceId: null,
};

/**
 * Holds the authenticated user's dashboard-wide identity and tenant context.
 *
 * Server data is loaded once by DashboardBootstrap and updated optimistically
 * after profile settings are saved.
 */
export const useUserStore = create<UserStoreState>((set) => ({
  ...initialState,
  setContext: (context) =>
    set((state) => {
      const hasActiveOrganization = context.organizations.some(
        (organization) => organization.id === state.activeOrganizationId,
      );
      const activeOrganizationId = hasActiveOrganization
        ? state.activeOrganizationId
        : (context.workspaces[0]?.orgId ??
          context.organizations[0]?.id ??
          null);
      const hasActiveWorkspace = context.workspaces.some(
        (workspace) =>
          workspace.id === state.activeWorkspaceId &&
          workspace.orgId === activeOrganizationId,
      );
      const activeWorkspaceId = hasActiveWorkspace
        ? state.activeWorkspaceId
        : (context.workspaces.find(
            (workspace) => workspace.orgId === activeOrganizationId,
          )?.id ?? null);

      return {
        user: context.user,
        access: context.access,
        organizations: context.organizations,
        workspaces: context.workspaces,
        activeOrganizationId,
        activeWorkspaceId,
      };
    }),
  setActiveOrganization: (organizationId) =>
    set((state) => ({
      activeOrganizationId: organizationId,
      activeWorkspaceId:
        state.workspaces.find((workspace) => workspace.orgId === organizationId)
          ?.id ?? null,
    })),
  updateUser: (user) => set({ user }),
  updateOrganization: (organization) =>
    set((state) => ({
      organizations: state.organizations.map((current) =>
        current.id === organization.id ? organization : current,
      ),
    })),
  reset: () => set(initialState),
}));
