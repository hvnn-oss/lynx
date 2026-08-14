import { getRequestConfig } from "next-intl/server";

const DEFAULT_LOCALE = "ko";

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages: (await import(`../messages/${DEFAULT_LOCALE}.json`)).default,
}));
