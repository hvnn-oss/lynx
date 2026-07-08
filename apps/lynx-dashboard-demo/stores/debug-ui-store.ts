"use client";

import type { DebugSeverity } from "@repo/dto";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type DebugTab =
  | "sessions"
  | "timeline"
  | "logs"
  | "root-cause"
  | "patterns"
  | "latency"
  | "memory";

interface DebugFilters {
  from?: string;
  to?: string;
  severity?: DebugSeverity;
  errorsOnly?: boolean;
  includePayload?: boolean;
}

interface DebugUiState {
  selectedSessionId?: string;
  activeTab: DebugTab;
  filters: DebugFilters;
  setSelectedSessionId: (sessionId?: string) => void;
  setActiveTab: (tab: DebugTab) => void;
  setFilters: (filters: Partial<DebugFilters>) => void;
  resetFilters: () => void;
}

const defaultFilters: DebugFilters = {
  errorsOnly: false,
  includePayload: false,
};

export const useDebugUiStore = create<DebugUiState>()(
  persist(
    (set) => ({
      activeTab: "sessions",
      filters: defaultFilters,
      setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),
      resetFilters: () => set({ filters: defaultFilters }),
    }),
    {
      name: "lynx-debug-ui",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
