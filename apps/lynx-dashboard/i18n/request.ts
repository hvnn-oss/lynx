import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import fs from "fs";
import path from "path";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  // 쿠키에서 언어 설정을 가져오고, 없으면 기본값 'ko' 사용
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "ko";

  const messages: Record<string, unknown> = {};
  const localeDir = path.join(process.cwd(), "messages", locale);

  if (fs.existsSync(localeDir)) {
    const files = fs.readdirSync(localeDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const namespace = path.basename(file, ".json");
        try {
          const content = fs.readFileSync(path.join(localeDir, file), "utf-8");
          messages[namespace] = JSON.parse(content);
        } catch (error) {
          console.error(`Failed to parse translation file ${file}:`, error);
        }
      }
    }
  }

  return {
    locale,
    messages,
  };
});
