"use client";

import { usePageStore } from "@/stores/pageStore";

export function UsePageInfo({ title }: { title?: string }) {
  const setTitle = usePageStore((state) => state.setTitle);

  setTitle(title || "");
  return <></>;
}
