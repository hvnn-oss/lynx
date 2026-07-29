import { env } from "../config/config.js";
import { SystemHealthService } from "./system-health.service.js";

describe("SystemHealthService", () => {
  it("DB와 Redis가 응답하면 ready 상태를 반환한다", async () => {
    const service = new SystemHealthService(
      {
        isInitialized: true,
        query: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
      },
      {
        ping: jest.fn().mockResolvedValue("PONG"),
      },
    );

    const result = await service.checkReadiness();

    expect(result.status).toBe("ok");
    expect(result.processRole).toBe(env.LYNX_PROCESS_ROLE);
    expect(result.checks.database.status).toBe("up");
    expect(result.checks.redis.status).toBe("up");
  });

  it("의존성 하나라도 실패하면 unavailable 상태를 반환한다", async () => {
    const service = new SystemHealthService(
      {
        isInitialized: false,
        query: jest.fn(),
      },
      {
        ping: jest.fn().mockResolvedValue("PONG"),
      },
    );

    const result = await service.checkReadiness();

    expect(result.status).toBe("unavailable");
    expect(result.checks.database.status).toBe("down");
    expect(result.checks.redis.status).toBe("up");
  });
});
