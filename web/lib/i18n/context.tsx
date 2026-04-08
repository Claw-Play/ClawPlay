"use client";
import { createContext, useContext } from "react";
import type { Messages } from "./index";

const I18nContext = createContext<Messages | null>(null);

export function I18nProvider({
  messages,
  children,
}: {
  messages: Messages;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={messages}>{children}</I18nContext.Provider>;
}

// Client Component 使用，等价于 getT 但从 Context 读取消息
export function useT<K extends keyof Messages>(namespace: K) {
  const messages = useContext(I18nContext);
  if (!messages) throw new Error("useT must be used within I18nProvider");
  const ns = (messages[namespace] ?? {}) as Record<string, string>;
  return (key: string, values?: Record<string, string | number>): string => {
    let str = ns[key] ?? key;
    if (values) {
      str = str.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
    }
    return str;
  };
}
