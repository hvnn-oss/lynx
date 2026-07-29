import { z } from "zod";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** SDK가 보내는 Agent 식별자의 안전한 문자열 형식을 검증합니다. */
export const AgentIdentifierSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => value === value.trim(), {
    message: "Agent identifier must not have leading or trailing whitespace.",
  })
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
    message: "Agent identifier must not contain control characters.",
  });

/** 문자열이 UUID 형식인지 확인합니다. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
