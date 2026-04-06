import { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import zhMessages from "./messages/zh.json";

export function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="zh" messages={zhMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
