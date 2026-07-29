import { env } from "../config/config.js";
import { logger } from "../logger/logger.js";
import {
  DataRetentionService,
  dataRetentionService,
} from "./data-retention.service.js";

/** 조직별 데이터 보존 기간을 주기적으로 실제 저장 데이터에 적용합니다. */
export class DataRetentionWorker {
  private timer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly service: DataRetentionService = dataRetentionService,
  ) {}

  /** 프로세스 시작 직후 한 번 실행한 뒤 설정된 주기로 반복합니다. */
  start(): void {
    if (this.timer || !env.DATA_RETENTION_ENABLED) return;

    this.timer = setInterval(() => {
      void this.runOnce();
    }, env.DATA_RETENTION_POLL_INTERVAL_MS);
    void this.runOnce();
  }

  /** 새 삭제 작업 예약을 중단하고 진행 중인 배치가 끝나기를 기다립니다. */
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
      await this.service.runOnce();
    } catch (error) {
      logger.error(
        { event: "data_retention.worker.failed", err: error },
        "data retention worker failed",
      );
    } finally {
      this.isProcessing = false;
    }
  }
}

export const dataRetentionWorker = new DataRetentionWorker();
