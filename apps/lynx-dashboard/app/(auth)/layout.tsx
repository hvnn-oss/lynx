"use client";
import AuthLayout from "@/components/layout/auth/layout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div>
      <AuthLayout>{children}</AuthLayout>
    </div>
  );
}
