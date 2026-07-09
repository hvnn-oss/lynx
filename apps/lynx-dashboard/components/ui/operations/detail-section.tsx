import {
  DashboardPanel,
  DashboardListRow,
} from "@repo/ui/components/dashboard/panel";

export function OperationsDetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardPanel>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </DashboardPanel>
  );
}

export function OperationsInfoList({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <dl className="grid gap-4 text-sm md:grid-cols-2">
      {items.map((item) => (
        <div className="min-w-0" key={item.label}>
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OperationsCompactList({
  items,
}: {
  items: { title: string; description?: string; value?: string }[];
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <DashboardListRow
          description={item.description}
          key={`${item.title}-${item.value ?? ""}`}
          title={item.title}
          value={item.value}
        />
      ))}
    </div>
  );
}
