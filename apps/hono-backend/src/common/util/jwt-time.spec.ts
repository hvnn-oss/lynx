
import { getJwtNumericDate } from "./jwt-time.js";

describe("getJwtNumericDate", () => {
  it("밀리초를 초 단위 JWT NumericDate로 변환한다", () => {
    expect(getJwtNumericDate(1_700_000_000_999)).toBe(1_700_000_000);
  });
});
