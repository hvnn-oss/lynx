"use client";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@repo/ui/components/ui/combobox";
import { type ChartConfig } from "@repo/ui/components/ui/chart";
import DashboardOverviewIssueNeedHandle from "./issues-need-handle";
import { DashboardAreaChart } from "@/components/ui/dashboard/area-chart";
import { useTranslations } from "next-intl";

const chartDemoData = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
];

const chartConfig = {
  desktop: {
    label: "이슈 수",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const dates = ["일주일", "한 달", "3개월", "6개월", "1년"] as const;

export function DashboardOverviewIssues() {
  const t = useTranslations("dashboard.overview.issues");
  return (
    <div className="grid grid-cols-4 px-3 gap-3">
      <div className="bg-background col-start-1 col-end-3 rounded-md p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("chart.title")}</h3>
          <Combobox items={dates} defaultValue={"일주일"}>
            <ComboboxInput className="w-32" />
            <ComboboxContent>
              <ComboboxList>
                {(item) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
        <DashboardAreaChart
          categoryKey="month"
          className="w-full mt-5 h-80"
          chartConfig={chartConfig}
          chartData={chartDemoData}
          gradient
        />
      </div>
      <DashboardOverviewIssueNeedHandle />
    </div>
  );
}
