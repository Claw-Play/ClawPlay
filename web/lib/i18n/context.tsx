"use client";
import { createContext, useContext } from "react";
import type { Messages } from "./index";

export type MessageValue = string | ((values?: Record<string, string | number>) => string);
export type MessageMap = Record<string, MessageValue>;

const I18nContext = createContext<MessageMap | null>(null);

export function I18nProvider({
  messages,
  children,
}: {
  messages: Messages;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={messages as unknown as MessageMap}>{children}</I18nContext.Provider>;
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
