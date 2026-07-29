import { IntegrationSecretCipher } from "./integration-secret-cipher.js";

describe("IntegrationSecretCipher", () => {
  it("비밀값을 평문 없이 저장하고 다시 복호화한다", () => {
    const cipher = new IntegrationSecretCipher();
    const secret =
      "https://hooks.slack.com/services/T000/B000/secret-value-for-test";

    const encrypted = cipher.encrypt(secret);

    expect(encrypted).not.toContain(secret);
    expect(cipher.decrypt(encrypted)).toBe(secret);
  });

  it("암호문이 변경되면 인증 태그 검증에 실패한다", () => {
    const cipher = new IntegrationSecretCipher();
    const encrypted = cipher.encrypt(
      "https://hooks.slack.com/services/T000/B000/secret",
    );
    const parts = encrypted.split(".");
    const authTag = Buffer.from(parts[2]!, "base64url");
    authTag[0] = authTag[0]! ^ 0xff;
    parts[2] = authTag.toString("base64url");
    const tampered = parts.join(".");

    expect(() => cipher.decrypt(tampered)).toThrow(
      "INTEGRATION_SECRET_DECRYPTION_FAILED",
    );
  });
});
