import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import { I18nProvider } from "@/lib/i18n/context";
import { getMessages } from "@/lib/i18n";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ClawPlay — AI Skills Ecosystem",
  description:
    "Build, share, and discover social entertainment Skills for X Claw. Unified multimodal CLI, free tier, one-click setup.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("clawplay_locale")?.value
    || (process.env.NEXT_LOCALE as string);
  const messages = getMessages(locale);

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider messages={messages} locale={locale}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
