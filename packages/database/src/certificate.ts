const CERTIFICATE_PATTERN =
  /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;
const PEM_LINE_LENGTH = 64;

/**
 * 실제 줄바꿈, `\n` 문자열, 한 줄로 저장된 인증서 번들을 모두 PEM 형식으로 정규화합니다.
 */
export function normalizeCertificateBundle(value: string): string {
  const expandedValue = value.replace(/\\n/g, "\n").trim();
  const certificates = [...expandedValue.matchAll(CERTIFICATE_PATTERN)];

  if (certificates.length === 0) {
    return expandedValue;
  }

  return certificates
    .map((certificate) => {
      const encodedCertificate = (certificate[1] ?? "").replace(/\s+/g, "");
      const encodedLines =
        encodedCertificate.match(new RegExp(`.{1,${PEM_LINE_LENGTH}}`, "g")) ??
        [];

      return [
        "-----BEGIN CERTIFICATE-----",
        ...encodedLines,
        "-----END CERTIFICATE-----",
      ].join("\n");
    })
    .join("\n");
}
