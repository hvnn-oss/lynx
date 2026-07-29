import { app } from "./app.js";
import { env } from "./common/config/config.js";

describe("system health endpoints", () => {
  it.each(["/health", "/health/live"])(
    "%s 응답에 배포 버전 정보를 포함한다",
    async (path) => {
      const response = await app.request(path);
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        status: "ok",
        releaseSha: env.RELEASE_SHA,
        deployedAt: env.DEPLOYED_AT,
      });
    },
  );
});
