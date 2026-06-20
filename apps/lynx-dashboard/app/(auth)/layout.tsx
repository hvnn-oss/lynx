"use client";
import AuthLayout from "@/components/layouts/auth/layout";
import { useEffect, useState } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isAnonymous, setIsAnonymous] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("_uid");
    if (token) {
      window.location.href = "/dashboard";
    } else {
      setIsAnonymous(true);
    }
  }, []);

  if (isAnonymous === null) {
    return null;
  }

  return (
    <div>
      <AuthLayout>{children}</AuthLayout>
    </div>
  );
}
