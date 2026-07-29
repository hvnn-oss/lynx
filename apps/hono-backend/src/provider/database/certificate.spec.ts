import { normalizeCertificateBundle } from "@repo/database";

describe("normalizeCertificateBundle", () => {
  it("한 줄로 저장된 인증서 번들을 PEM 형식으로 복원한다", () => {
    const firstCertificate = "A".repeat(70);
    const secondCertificate = "B".repeat(12);
    const bundle = [
      `-----BEGIN CERTIFICATE----- ${firstCertificate} -----END CERTIFICATE-----`,
      `-----BEGIN CERTIFICATE----- ${secondCertificate} -----END CERTIFICATE-----`,
    ].join(" ");

    expect(normalizeCertificateBundle(bundle)).toBe(
      [
        "-----BEGIN CERTIFICATE-----",
        "A".repeat(64),
        "A".repeat(6),
        "-----END CERTIFICATE-----",
        "-----BEGIN CERTIFICATE-----",
        secondCertificate,
        "-----END CERTIFICATE-----",
      ].join("\n"),
    );
  });

  it("문자열로 저장된 줄바꿈을 실제 줄바꿈으로 변환한다", () => {
    const bundle =
      "-----BEGIN CERTIFICATE-----\\nQUJD\\n-----END CERTIFICATE-----";

    expect(normalizeCertificateBundle(bundle)).toBe(
      [
        "-----BEGIN CERTIFICATE-----",
        "QUJD",
        "-----END CERTIFICATE-----",
      ].join("\n"),
    );
  });
});
