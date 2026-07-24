/** 일일 제한 계산에 사용할 UTC 자정 시각을 반환합니다. */
export function getUtcDayStartedAt(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
