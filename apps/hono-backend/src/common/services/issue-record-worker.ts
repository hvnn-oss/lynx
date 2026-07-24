import { issueRecordService } from "../../api/issue-record/issue-record.service.js";
import { logger } from "../logger/logger.js";

const POLL_INTERVAL_MS = 1_000;

/** 접수된 IssueRecord를 짧은 단위로 claim해 비동기 평가하는 worker입니다. */
export class IssueRecordWorker {
  private timer?: NodeJS.Timeout;
  private isProcessing = false;

  /** 중복 실행 없이 주기적인 record 평가를 시작합니다. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    this.timer.unref?.();
    void this.tick();
  }

  /** 새 평가 예약을 중단하고 현재 처리 중인 작업은 자연스럽게 끝냅니다. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** 한 번에 하나씩 처리해 단일 프로세스의 DB 부하를 제한합니다. */
  private async tick(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      while (await issueRecordService.processNext()) {
        // 대기열이 비워질 때까지 한 record씩 claim합니다.
      }
    } catch (error) {
      logger.error(
        { event: "issue_record.worker.failed", err: error },
        "issue record worker failed",
      );
    } finally {
      this.isProcessing = false;
    }
  }
}

/** 애플리케이션 생명주기에 연결하는 기본 IssueRecord worker입니다. */
export const issueRecordWorker = new IssueRecordWorker();
