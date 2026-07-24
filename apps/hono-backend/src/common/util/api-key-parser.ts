import { ParsedApiKey } from "../types/app-env.js";

export function apiKeyParser(key: string): ParsedApiKey {
  // secret에는 base64url의 밑줄이 포함될 수 있으므로 앞의 두 구분자만 분리합니다.
  const match = key.match(/^lynx_([^_]+)_([^_]+)_(.+)$/);

  if (!match) {
    throw new Error("Invalid API Key format.");
  }

  const [, environment, id, secret] = match;

  return {
    environment,
    id,
    secret,
  };
}

export function generateApiKey(parsedApiKey: ParsedApiKey) {
  return `lynx_${parsedApiKey.environment}_${parsedApiKey.id}_${parsedApiKey.secret}`;
}
