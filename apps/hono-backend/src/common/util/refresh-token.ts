import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const SESSION_ID_SCHEMA = z.uuid();
const REFRESH_SECRET_PATTERN = /^[A-Za-z0-9_-]{48}$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

/** 형식 검증을 통과한 Refresh Token 구성 요소입니다. */
export type ParsedRefreshToken = {
  sessionId: string;
  secret: string;
};

/**
 * Refresh Token을 세션 식별자와 secret으로 분리하고 형식을 검증합니다.
 * @param refreshToken 클라이언트가 전달한 Refresh Token입니다.
 * @returns 검증된 세션 식별자와 secret이며, 형식이 잘못되면 null입니다.
 */
export function parseRefreshToken(
  refreshToken: string,
): ParsedRefreshToken | null {
  const parts = refreshToken.split(".");
  if (parts.length !== 2) return null;

  const [sessionId, secret] = parts;
  if (!SESSION_ID_SCHEMA.safeParse(sessionId).success) return null;
  if (!REFRESH_SECRET_PATTERN.test(secret)) return null;

  return { sessionId, secret };
}

/**
 * Refresh Token secret을 저장된 SHA-256 해시와 상수 시간으로 비교합니다.
 * @param secret 클라이언트가 전달한 원문 secret입니다.
 * @param storedHashHex Redis에 저장된 SHA-256 hex 문자열입니다.
 * @returns secret과 저장된 해시가 일치하는지 여부입니다.
 */
export function verifyRefreshTokenSecret(
  secret: string,
  storedHashHex: string,
): boolean {
  if (!REFRESH_SECRET_PATTERN.test(secret)) return false;
  if (!SHA256_HEX_PATTERN.test(storedHashHex)) return false;

  const receivedHash = createHash("sha256").update(secret).digest();
  const storedHash = Buffer.from(storedHashHex, "hex");

  return (
    receivedHash.length === storedHash.length &&
    timingSafeEqual(receivedHash, storedHash)
  );
}

/**
 * Refresh Token 원문 secret을 저장 및 비교 가능한 SHA-256 hex로 변환합니다.
 * @param secret 클라이언트에 전달할 Refresh Token secret입니다.
 * @returns Redis에 저장할 SHA-256 hex 문자열입니다.
 */
export function hashRefreshTokenSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
