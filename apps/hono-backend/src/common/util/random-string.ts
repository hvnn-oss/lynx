import { randomBytes } from "node:crypto";

/**
 * 암호학적으로 안전한 URL-safe 임의 문자열을 생성합니다.
 * @param length 생성할 문자열 길이입니다.
 * @returns 지정한 길이의 임의 문자열입니다.
 */
export const generateRandomString = (length = 8) => {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new RangeError("length must be a positive safe integer");
  }

  // base64url은 한 바이트당 최소 한 글자 이상을 생성합니다.
  return randomBytes(length).toString("base64url").slice(0, length);
};
