"use client";

import type { ReactNode } from "react";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onValueChange,
  children,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="tabs" role="tablist">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={value === item.value}
            className={value === item.value ? "tab tab-active" : "tab"}
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
            {item.count !== undefined && <span>{item.count}</span>}
          </button>
        ))}
      </div>
      <div className="tab-content">{children}</div>
    </div>
  );
}
