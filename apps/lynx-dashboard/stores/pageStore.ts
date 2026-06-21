import { create } from "zustand";

export interface BreadcrumbItem {
  title: string;
  url: string;
}

interface PageInfo {
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
}

export const usePageStore = create<PageInfo>((set) => ({
  breadcrumbs: [],
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
}));

