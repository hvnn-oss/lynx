
import { generateRandomString } from "./random-string.js";

describe("generateRandomString", () => {
  it("요청한 길이의 URL-safe 문자열을 생성한다", () => {
    const value = generateRandomString(48);

    expect(value).toHaveLength(48);
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("연속 호출에서 서로 다른 문자열을 생성한다", () => {
    expect(generateRandomString(48)).not.toBe(generateRandomString(48));
  });

  it("유효하지 않은 길이를 거부한다", () => {
    expect(() => generateRandomString(0)).toThrow(RangeError);
  });
});
