import { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/context";
import zhMessages from "./messages/zh.json";

export function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider messages={zhMessages}>
      {children}
    </I18nProvider>
  );
}
