interface NoDataScreenProps {
  title?: string;
  description?: string;
}

export default function NoDataScreen({
  title = "수집된 데이터가 없습니다.",
  description = "SDK를 연결하고 이벤트가 수집되면 이 화면에 실제 운영 데이터가 표시됩니다.",
}: NoDataScreenProps) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
