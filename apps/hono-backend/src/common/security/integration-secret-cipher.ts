import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { env } from "../config/config.js";

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";
const IV_BYTES = 12;

/** 외부 Integration 비밀값을 인증된 암호문으로 저장하고 복호화합니다. */
export class IntegrationSecretCipher {
  /** 평문을 매번 새로운 IV로 암호화해 동일 값도 다른 암호문으로 저장합니다. */
  encrypt(value: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.getKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      FORMAT_VERSION,
      iv.toString("base64url"),
      authTag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  /** 버전과 인증 태그를 검증한 뒤 저장된 Integration 비밀값을 복호화합니다. */
  decrypt(value: string): string {
    const [version, ivValue, authTagValue, ciphertextValue, extra] =
      value.split(".");
    if (
      version !== FORMAT_VERSION ||
      !ivValue ||
      !authTagValue ||
      !ciphertextValue ||
      extra
    ) {
      throw new Error("INVALID_INTEGRATION_SECRET_FORMAT");
    }

    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        this.getKey(),
        Buffer.from(ivValue, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new Error("INTEGRATION_SECRET_DECRYPTION_FAILED");
    }
  }

  private getKey(): Buffer {
    if (env.INTEGRATION_ENCRYPTION_KEY) {
      return Buffer.from(env.INTEGRATION_ENCRYPTION_KEY, "base64");
    }

    // 개발·테스트에서는 재시작 후에도 복호화할 수 있도록 JWT 비밀값에서 별도 키를 파생합니다.
    return createHash("sha256")
      .update("lynx/integration-secret/development/v1\0", "utf8")
      .update(env.JWT_SECRET, "utf8")
      .digest();
  }
}

export const integrationSecretCipher = new IntegrationSecretCipher();
