export function JsonViewer({
  value,
  emptyLabel = "기록된 데이터가 없습니다.",
}: {
  value: unknown;
  emptyLabel?: string;
}) {
  if (value === null || value === undefined) {
    return <div className="json-empty">{emptyLabel}</div>;
  }
  return (
    <pre className="json-viewer">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}
