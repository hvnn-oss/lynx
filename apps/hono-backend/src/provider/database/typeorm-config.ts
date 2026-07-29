import { DataSource } from "typeorm";
import { env } from "../../common/config/config.js";
import { AppDataSource as BaseDataSource } from "@repo/database";
import type { DataSourceOptions } from "typeorm/browser";

type PostgresDataSourceOptions = Extract<
  DataSourceOptions,
  { type: "postgres" }
>;

const baseOptions = BaseDataSource.options;

// 공유 DB 패키지가 PostgreSQL 설정을 제공한다는 전제를 기동 시 확인합니다.
if (baseOptions.type !== "postgres") {
  throw new Error(
    `BaseDataSource must use postgres, but received "${baseOptions.type}"`,
  );
}

const dbOptions = {
  ...baseOptions,

  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT,
  username: env.DATABASE_USERNAME,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  logging: env.DATABASE_LOGGING,
  synchronize: env.DATABASE_SYNCHRONIZE,
  poolSize: env.DATABASE_POOL_SIZE,
  ssl: env.DATABASE_SSL
    ? {
        rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED,
        ...(env.DATABASE_SSL_CA
          ? { ca: env.DATABASE_SSL_CA.replace(/\\n/g, "\n") }
          : {}),
      }
    : false,
} satisfies PostgresDataSourceOptions;

/** Hono 백엔드 환경 설정을 적용한 PostgreSQL 데이터 소스입니다. */
export const AppDataSource = new DataSource(dbOptions);
