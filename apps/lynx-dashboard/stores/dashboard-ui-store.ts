"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type DashboardSection =
  | "home"
  | "status"
  | "metrics"
  | "usage"
  | "cost"
  | "insights";

interface PanelMetric {
  firstRenderedAt?: number;
  lastDataUpdatedAt?: number;
}

interface DashboardUiState {
  selectedWorkspaceId: string | undefined;
  activeSection: DashboardSection;
  panelMetrics: Record<string, PanelMetric>;
  setSelectedWorkspaceId: (workspaceId: string | undefined) => void;
  setActiveSection: (section: DashboardSection) => void;
  markPanelRendered: (panelId: string, renderedAt?: number) => void;
  markPanelDataReady: (panelId: string, dataUpdatedAt: number) => void;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeWorkspaceId(workspaceId: unknown): string | undefined {
  if (typeof workspaceId !== "string") return undefined;
  return uuidPattern.test(workspaceId) ? workspaceId : undefined;
}

const defaultWorkspaceId = normalizeWorkspaceId(
  process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID,
);

export const useDashboardUiStore = create<DashboardUiState>()(
  persist(
    (set) => ({
      selectedWorkspaceId: defaultWorkspaceId,
      activeSection: "home",
      panelMetrics: {},
      setSelectedWorkspaceId: (workspaceId) =>
        set({ selectedWorkspaceId: normalizeWorkspaceId(workspaceId) }),
      setActiveSection: (activeSection) => set({ activeSection }),
      markPanelRendered: (panelId, renderedAt = Date.now()) =>
        set((state) => {
          const current = state.panelMetrics[panelId] ?? {};
          return {
            panelMetrics: {
              ...state.panelMetrics,
              [panelId]: {
                ...current,
                firstRenderedAt: current.firstRenderedAt ?? renderedAt,
              },
            },
          };
        }),
      markPanelDataReady: (panelId, lastDataUpdatedAt) =>
        set((state) => ({
          panelMetrics: {
            ...state.panelMetrics,
            [panelId]: {
              ...(state.panelMetrics[panelId] ?? {}),
              lastDataUpdatedAt,
            },
          },
        })),
    }),
    {
      name: "lynx-dashboard-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedWorkspaceId: state.selectedWorkspaceId,
        activeSection: state.activeSection,
      }),
      version: 1,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState;
        }

        const state = persistedState as Partial<DashboardUiState>;
        return {
          ...state,
          selectedWorkspaceId: normalizeWorkspaceId(state.selectedWorkspaceId),
        };
      },
    },
  ),
);
