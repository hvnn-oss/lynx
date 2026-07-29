import { z } from "zod";

/** 인증 완료 뒤 이동할 수 있는 동일 사이트 내부 경로만 허용합니다. */
export const SafeRedirectPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine((value) => {
    try {
      const decoded = decodeURIComponent(value);
      return (
        value.startsWith("/") &&
        !value.startsWith("//") &&
        !decoded.startsWith("//") &&
        !decoded.includes("\\")
      );
    } catch {
      return false;
    }
  }, "Redirect must be a safe internal path.");
