"use client";
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Messages } from "./index";

export type MessageValue = string | ((values?: Record<string, string | number>) => string);
export type MessageMap = Record<string, MessageValue>;

const I18nContext = createContext<MessageMap | null>(null);
const LocaleContext = createContext<{
  locale: string;
  setLocale: (locale: string) => void;
} | null>(null);

export function I18nProvider({
  messages,
  locale,
  children,
}: {
  messages: Messages;
  locale: string;
  children: React.ReactNode;
}) {
  // Sync state with prop (useState only reads initialValue on first render)
  const [currentLocale, setCurrentLocale] = useState(locale);
  useEffect(() => {
    setCurrentLocale(locale);
  }, [locale]);

  const handleSetLocale = useCallback((newLocale: string) => {
    setCurrentLocale(newLocale);
    // Persist to cookie
    document.cookie = `clawplay_locale=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
    window.location.reload();
  }, []);

  return (
    <LocaleContext.Provider value={{ locale: currentLocale, setLocale: handleSetLocale }}>
      <I18nContext.Provider value={messages as unknown as MessageMap}>{children}</I18nContext.Provider>
    </LocaleContext.Provider>
  );
}

// Client Component 使用，等价于 getT 但从 Context 读取消息
export function useT<K extends keyof Messages>(namespace: K) {
  const messages = useContext(I18nContext) as Record<string, Record<string, MessageValue>> | null;
  if (!messages) throw new Error("useT must be used within I18nProvider");
  const ns = messages[namespace] ?? {};
  return (key: string, values?: Record<string, string | number>): string => {
    const entry = ns[key];
    if (typeof entry === "function") return entry(values);
    if (typeof entry === "string") {
      if (!values) return entry;
      return entry.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
    }
    return key;
  };
}

// 获取/设置当前语言
export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within I18nProvider");
  return ctx;
}
