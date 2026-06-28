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
  selectedWorkspaceId: string;
  activeSection: DashboardSection;
  panelMetrics: Record<string, PanelMetric>;
  setSelectedWorkspaceId: (workspaceId: string) => void;
  setActiveSection: (section: DashboardSection) => void;
  markPanelRendered: (panelId: string, renderedAt?: number) => void;
  markPanelDataReady: (panelId: string, dataUpdatedAt: number) => void;
}

const defaultWorkspaceId =
  process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ?? "ws-1";

export const useDashboardUiStore = create<DashboardUiState>()(
  persist(
    (set) => ({
      selectedWorkspaceId: defaultWorkspaceId,
      activeSection: "home",
      panelMetrics: {},
      setSelectedWorkspaceId: (workspaceId) =>
        set({ selectedWorkspaceId: workspaceId }),
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
    },
  ),
);
