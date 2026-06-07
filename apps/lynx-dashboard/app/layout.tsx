import type { Metadata } from "next";
import localFont from "next/font/local";
import DashboardHeader from "@/components/layouts/dashboard/header";
import "@/styles/globals.css";

const pretendard = localFont({
  variable: "--pretendard",
  src: "../fonts/PretendardVariable.woff2",
});

export const metadata: Metadata = {
  title: "링스",
  description: "AI 옵저빌리티 서비스, 링스의 대시보드입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko-KR" className={`${pretendard.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <DashboardHeader />
        {children}
      </body>
    </html>
  );
}
