import zh from "../../messages/zh.json";
import en from "../../messages/en.json";

export type Messages = typeof zh;

const MESSAGES: Record<string, Messages> = { zh, en };

export function getLocale(): string {
  return (process.env.NEXT_LOCALE as string) || "zh";
}

export function getMessages(locale?: string): Messages {
  const l = locale ?? getLocale();
  return MESSAGES[l] ?? MESSAGES.zh;
}

// Server Component 直接调用，无需 await
export function getT<K extends keyof Messages>(namespace: K) {
  const ns = getMessages()[namespace] as Record<string, string>;
  return (key: string, values?: Record<string, string | number>): string => {
    let str = ns[key] ?? key;
    if (values) {
      str = str.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
    }
    return str;
  };
}
