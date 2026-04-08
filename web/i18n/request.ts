import { getRequestConfig } from "next-intl/server";
import zhMessages from "../messages/zh.json";
import enMessages from "../messages/en.json";

const messages: Record<string, Record<string, unknown>> = {
  zh: zhMessages,
  en: enMessages,
};

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) || process.env.NEXT_LOCALE || "zh";

  return {
    locale: messages[locale] ? locale : "zh",
    messages: messages[locale] ?? messages.zh,
  };
});
