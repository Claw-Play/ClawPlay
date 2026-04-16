import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";
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

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin"],
  variable: "--font-vietnam",
  weight: ["400", "500", "600", "700"],
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
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable} ${beVietnamPro.variable} antialiased`}
      >
        <I18nProvider messages={messages} locale={locale}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
