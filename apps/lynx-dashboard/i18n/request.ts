import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const DEFAULT_LOCALE = "ko";
const SUPPORTED_LOCALES = new Set(["ko", "en"]);

function readMessages(locale: string): Record<string, unknown> {
  const messages: Record<string, unknown> = {};
  const localeDirectory = path.join(process.cwd(), "messages", locale);

  if (!fs.existsSync(localeDirectory)) {
    return messages;
  }

  for (const fileName of fs.readdirSync(localeDirectory)) {
    if (!fileName.endsWith(".json")) {
      continue;
    }

    const namespace = path.basename(fileName, ".json");

    try {
      const content = fs.readFileSync(
        path.join(localeDirectory, fileName),
        "utf-8",
      );
      messages[namespace] = JSON.parse(content);
    } catch (error) {
      console.error(`Failed to parse translation file ${fileName}:`, error);
    }
  }

  return messages;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestedLocale =
    cookieStore.get("NEXT_LOCALE")?.value ?? DEFAULT_LOCALE;
  const locale = SUPPORTED_LOCALES.has(requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE;
  const fallbackMessages = readMessages(DEFAULT_LOCALE);
  const localeMessages =
    locale === DEFAULT_LOCALE ? {} : readMessages(locale);

  return {
    locale,
    // 아직 번역되지 않은 namespace는 한국어를 유지해 화면이 깨지지 않게 합니다.
    messages: {
      ...fallbackMessages,
      ...localeMessages,
    },
  };
});
