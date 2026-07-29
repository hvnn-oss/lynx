import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const envFileCandidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), "apps/hono-backend/.env"),
  resolve(process.cwd(), "apps/hono-backend/.env.local"),
  resolve(process.cwd(), "apps/backend/.env"),
  resolve(process.cwd(), "apps/backend/.env.local"),
  resolve(process.cwd(), "../../apps/hono-backend/.env"),
  resolve(process.cwd(), "../../apps/hono-backend/.env.local"),
  resolve(process.cwd(), "../../apps/backend/.env"),
  resolve(process.cwd(), "../../apps/backend/.env.local"),
  resolve(__dirname, "../../../apps/hono-backend/.env"),
  resolve(__dirname, "../../../apps/hono-backend/.env.local"),
  resolve(dirname(__dirname), "../../apps/backend/.env"),
  resolve(dirname(__dirname), "../../apps/backend/.env.local"),
];

/** 실행 위치와 관계없이 서버의 DB 환경 변수를 한 번만 로드합니다. */
export function loadDatabaseEnv() {
  for (const envFilePath of envFileCandidates) {
    if (!existsSync(envFilePath)) {
      continue;
    }

    const envFile = readFileSync(envFilePath, "utf8");
    for (const line of envFile.split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmedLine.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

      if (!key || process.env[key] !== undefined) {
        continue;
      }

      process.env[key] = unwrapEnvValue(rawValue);
    }
  }
}

function unwrapEnvValue(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
