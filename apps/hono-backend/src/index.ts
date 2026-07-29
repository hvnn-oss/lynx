import "reflect-metadata";

import { serve, type ServerType } from "@hono/node-server";

import { AppDataSource } from "./provider/database/typeorm-config.js";
import { app } from "./app.js";
import { logger } from "./common/logger/logger.js";
import { env } from "./common/config/config.js";
import { issueRecordWorker } from "./common/services/issue-record-worker.js";
import { webhookDeliveryWorker } from "./common/services/webhook-delivery-worker.js";

let server: ServerType | undefined;

/** 데이터베이스 연결을 초기화하고 HTTP 서버를 시작합니다. */
async function bootstrap(): Promise<void> {
  logger.info(
    {
      event: "database.initialization.started",
    },
    "initializing database connection",
  );
  await AppDataSource.initialize();
  issueRecordWorker.start();
  webhookDeliveryWorker.start();

  logger.info(
    {
      event: "database.initialized",
    },
    "database connection initialized",
  );

  server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info(
      {
        event: "application.started",
        port: info.port,
      },
      "application started",
    );
  });
}

/**
 * 새 요청 수신을 중단하고 데이터베이스 연결을 정리합니다.
 * @param signal 종료를 요청한 운영체제 신호입니다.
 */
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info(
    {
      event: "application.shutdown.started",
      signal,
    },
    "application shutdown started",
  );

  issueRecordWorker.stop();
  await webhookDeliveryWorker.stop();
  server?.close();

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();

    logger.info(
      {
        event: "database.disconnected",
      },
      "database connection closed",
    );
  }

  logger.info(
    {
      event: "application.shutdown.completed",
    },
    "application shutdown completed",
  );

  process.exit(0);
}

// 종료 신호는 한 번만 처리해 중복 정리와 연결 종료 경합을 막습니다.
process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

// 기동 실패 시 남아 있는 데이터베이스 연결을 정리한 뒤 종료합니다.
bootstrap().catch(async (error: unknown) => {
  logger.fatal(
    {
      event: "application.startup.failed",
      err: error,
    },
    "failed to start application",
  );

  issueRecordWorker.stop();
  await webhookDeliveryWorker.stop();
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  process.exit(1);
});
