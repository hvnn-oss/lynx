import { env } from "../config/config.js";
import { logger } from "../logger/logger.js";
import {
  OperationalHealthService,
  operationalHealthService,
} from "./operational-health.service.js";

/** 운영 적체 상태를 주기적으로 점검하고 CloudWatch Alarm용 구조화 로그를 남깁니다. */
export class OperationalHealthWorker {
  private timer?: NodeJS.Timeout;
  private isProcessing = false;
  private previousStatus?: "healthy" | "degraded";

  constructor(
    private readonly service: OperationalHealthService = operationalHealthService,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, env.OPERATIONAL_HEALTH_POLL_INTERVAL_MS);
    void this.runOnce();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;

    const deadline = Date.now() + 30_000;
    while (this.isProcessing && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  async runOnce(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      await this.service.recordWorkerHeartbeat();
      const snapshot = await this.service.inspect();
      if (snapshot.status === "degraded") {
        logger.warn(
          { event: "operational.health.degraded", ...snapshot },
          "operational health degraded",
        );
      } else if (this.previousStatus === "degraded") {
        logger.info(
          { event: "operational.health.recovered", ...snapshot },
          "operational health recovered",
        );
      } else {
        logger.debug(
          { event: "operational.health.checked", ...snapshot },
          "operational health checked",
        );
      }
      this.previousStatus = snapshot.status;
    } catch (error) {
      logger.error(
        { event: "operational.health.check_failed", err: error },
        "operational health check failed",
      );
    } finally {
      this.isProcessing = false;
    }
  }
}

export const operationalHealthWorker = new OperationalHealthWorker();
