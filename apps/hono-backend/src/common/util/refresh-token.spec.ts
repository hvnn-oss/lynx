import { createHash, randomUUID } from "node:crypto";

import {
  parseRefreshToken,
  verifyRefreshTokenSecret,
} from "./refresh-token.js";

const SECRET = "A".repeat(48);

describe("parseRefreshToken", () => {
  it("정상 Refresh Token을 파싱한다", () => {
    const sessionId = randomUUID();

    expect(parseRefreshToken(`${sessionId}.${SECRET}`)).toEqual({
      sessionId,
      secret: SECRET,
    });
  });

  it("잘못된 세션 ID와 secret 형식을 거부한다", () => {
    expect(parseRefreshToken(`invalid.${SECRET}`)).toBeNull();
    expect(parseRefreshToken(`${randomUUID()}.short`)).toBeNull();
    expect(parseRefreshToken(`${randomUUID()}.${SECRET}.extra`)).toBeNull();
  });
});

describe("verifyRefreshTokenSecret", () => {
  it("일치하는 secret을 검증한다", () => {
    const hash = createHash("sha256").update(SECRET).digest("hex");

    expect(verifyRefreshTokenSecret(SECRET, hash)).toBe(true);
  });

  it("다른 secret과 잘못된 hash 형식을 거부한다", () => {
    const hash = createHash("sha256").update(SECRET).digest("hex");

    expect(verifyRefreshTokenSecret("B".repeat(48), hash)).toBe(false);
    expect(verifyRefreshTokenSecret(SECRET, "invalid")).toBe(false);
  });
});
