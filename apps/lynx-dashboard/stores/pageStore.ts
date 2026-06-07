import { create } from "zustand";

interface PageInfo {
  title: string;
  setTitle: (title: string) => void;
}

export const usePageStore = create<PageInfo>((set) => ({
  title: "",
  setTitle: (title: string) => set({ title: title }),
}));
