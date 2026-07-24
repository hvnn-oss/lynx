/**
 * 현재 시각을 JWT NumericDate 형식으로 반환합니다.
 * @param now 기준 시각입니다.
 * @returns 초 단위 Unix timestamp입니다.
 */
export function getJwtNumericDate(now = Date.now()): number {
  return Math.floor(now / 1000);
}
