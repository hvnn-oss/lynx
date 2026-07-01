import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import fs from "fs";
import path from "path";

const DEFAULT_LOCALE = "ko";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestedLocale = cookieStore.get("NEXT_LOCALE")?.value || DEFAULT_LOCALE;
  const locale = hasLocaleMessages(requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: loadMessages(locale),
  };
});

function hasLocaleMessages(locale: string) {
  return fs.existsSync(path.join(process.cwd(), "messages", locale));
}

function loadMessages(locale: string) {
  const messages: Record<string, unknown> = {};
  const localeDir = path.join(process.cwd(), "messages", locale);

  if (!fs.existsSync(localeDir)) {
    return messages;
  }

  const files = fs.readdirSync(localeDir);

  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const namespace = path.basename(file, ".json");
    const content = fs.readFileSync(path.join(localeDir, file), "utf-8");
    messages[namespace] = JSON.parse(content);
  }

  return messages;
}
