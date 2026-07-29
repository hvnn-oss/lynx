import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppProviders } from "./providers";
import "@/styles/globals.css";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";

const pretendard = localFont({
  variable: "--pretendard",
  src: "../fonts/PretendardVariable.woff2",
});

export const metadata: Metadata = {
  title: "링스",
  description: "AI 옵저빌리티 서비스, 링스의 대시보드입니다.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${pretendard.className} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <TooltipProvider>
            <AppProviders>{children}</AppProviders>
          </TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
