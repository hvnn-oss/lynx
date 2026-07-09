export function formatDateTime(value: string | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDelta(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}
