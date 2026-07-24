import { z } from "zod";
import { coreRedis } from "../../provider/redis/redis-config.js";

const SIGNUP_STAGE_PREFIX = "signup:stage";
const SIGNUP_EMAIL_TTL_SECONDS = 60 * 30;
const VERIFIED_SIGNUP_TTL_SECONDS = 60 * 10;

const SignupStageSchema = z.object({
  email: z.email().transform((email) => email.trim().toLowerCase()),
  domain: z.string(),
  email_verified: z.boolean(),
  invited_organization: z.uuid().optional(),
});

/** 이메일 확인부터 최종 가입 사이에 임시로 유지하는 상태입니다. */
export type SignupStage = z.infer<typeof SignupStageSchema>;

type SignupRedis = Pick<typeof coreRedis, "get" | "set" | "del">;

/** 만료 가능한 회원가입 단계를 Redis에 저장합니다. */
export class SignupStageStore {
  constructor(private readonly redis: SignupRedis = coreRedis) {}

  /**
   * 이메일 확인 전 가입 단계를 제한된 시간 동안 저장합니다.
   * @param token 새로 발급한 가입 토큰입니다.
   * @param stage 이메일과 초대 조직 정보를 포함한 가입 단계입니다.
   */
  async save(token: string, stage: SignupStage): Promise<void> {
    await this.redis.set(
      this.getKey(token),
      JSON.stringify(stage),
      "EX",
      SIGNUP_EMAIL_TTL_SECONDS,
    );
  }

  /**
   * 가입 토큰에 연결된 단계를 조회하고 저장 형식을 검증합니다.
   * @param token 이메일 확인 링크에 포함된 가입 토큰입니다.
   * @returns 유효한 가입 단계이며 없거나 손상된 경우 null입니다.
   */
  async get(token: string): Promise<SignupStage | null> {
    const rawStage = await this.redis.get(this.getKey(token));
    if (!rawStage) return null;

    const parsed = SignupStageSchema.safeParse(JSON.parse(rawStage));
    return parsed.success ? parsed.data : null;
  }

  /**
   * 이메일 확인 상태를 저장하고 최종 가입을 위한 TTL을 다시 설정합니다.
   * @param token 이메일 확인을 마친 가입 토큰입니다.
   * @param stage 기존 가입 단계입니다.
   */
  async markEmailVerified(token: string, stage: SignupStage): Promise<void> {
    await this.redis.set(
      this.getKey(token),
      JSON.stringify({ ...stage, email_verified: true }),
      "EX",
      VERIFIED_SIGNUP_TTL_SECONDS,
    );
  }

  /**
   * 사용이 끝난 가입 단계를 제거합니다.
   * @param token 제거할 가입 토큰입니다.
   */
  async remove(token: string): Promise<void> {
    await this.redis.del(this.getKey(token));
  }

  /** 가입 토큰에 대응하는 Redis key를 생성합니다. */
  private getKey(token: string): string {
    return `${SIGNUP_STAGE_PREFIX}:${token}`;
  }
}

/** 애플리케이션에서 공유하는 회원가입 단계 저장소입니다. */
export const signupStageStore = new SignupStageStore();
