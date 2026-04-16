import { cookies } from "next/headers";
import zh from "../../messages/zh.json";
import en from "../../messages/en.json";

export type Messages = typeof zh;

const MESSAGES: Record<string, Messages> = { zh: zh as unknown as Messages, en: en as unknown as Messages };

export async function getLocaleFromCookies(): Promise<string> {
  const cookieStore = await cookies();
  return (
    cookieStore.get("clawplay_locale")?.value ||
    (process.env.NEXT_LOCALE as string)
  );
}

export function getLocale(): string {
  return process.env.NEXT_LOCALE as string;
}

export function getMessages(locale?: string): Messages {
  return MESSAGES[locale ?? "zh"] ?? MESSAGES.zh;
}

// Server Component 直接调用，从 cookie 读取语言
export async function getT<K extends keyof Messages>(namespace: K) {
  const locale = await getLocaleFromCookies();
  const ns = getMessages(locale)[namespace] as Record<string, string>;
  return (key: string, values?: Record<string, string | number>): string => {
    let str = ns[key] ?? key;
    if (values) {
      str = str.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
    }
    return str;
  };
}
