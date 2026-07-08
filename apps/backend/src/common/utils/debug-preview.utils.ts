const MAX_PREVIEW_LENGTH = 240;

export const createPreview = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;

  const raw =
    typeof value === 'string'
      ? value
      : JSON.stringify(value, (_key: string, nestedValue: unknown): unknown =>
          typeof nestedValue === 'bigint'
            ? nestedValue.toString()
            : nestedValue,
        );
  if (!raw) return undefined;

  const masked = maskSensitiveText(raw);
  return masked.length > MAX_PREVIEW_LENGTH
    ? `${masked.slice(0, MAX_PREVIEW_LENGTH)}...`
    : masked;
};

export const toDebugString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : createPreview(value);

const maskSensitiveText = (value: string): string =>
  value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[MASKED_EMAIL]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [MASKED_SECRET]')
    .replace(
      /(api[-_]?key|token|password|secret)["']?\s*[:=]\s*["']?[^"',\s}]+/gi,
      '$1:[MASKED_SECRET]',
    );
